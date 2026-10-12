# Deploy the API on AWS EKS

This deployment runs the Express API as two or more stateless pods behind an AWS Application Load Balancer. The HPA scales API pods from 2 to 10 based on CPU and memory. A single worker pod runs scheduled tasks and BullMQ workers so scaling the API does not run duplicate schedules. MongoDB and Redis must be managed, reachable services outside these pods; do not use pod-local storage for application data.

## Before you start

You need:

- An AWS account and AWS CLI configured for the target account and region.
- `kubectl`, `eksctl`, Docker with buildx, and `helm`.
- A DNS name for the API and an ACM certificate in the same AWS region as the ALB.
- A MongoDB Atlas database and a Redis/Valkey-compatible endpoint. Use TLS for a managed Redis endpoint and set the correct TLS URL in `REDIS_URL`.
- All required production values from `.env.example`. In particular, keep the JWT secrets and integration encryption key stable across deployments.

The manifests assume an EKS cluster with at least two worker nodes in separate availability zones, the AWS Load Balancer Controller, and Kubernetes Metrics Server. Configure EKS worker networking/security groups to allow the ALB to reach pod targets. Restrict MongoDB and Redis ingress to the EKS worker/network security groups rather than the public internet. Configure EKS Auto Mode, Karpenter, or Cluster Autoscaler if you expect the cluster to add nodes when the API HPA creates pods that do not fit on the existing nodes.

## 1. Create the EKS cluster

Create or choose a VPC spanning at least two availability zones. Tag public subnets with `kubernetes.io/role/elb=1` and private subnets with `kubernetes.io/role/internal-elb=1`; also tag them for cluster discovery as required by your EKS setup. Put worker nodes in private subnets. A small production starting point is two `t3.large` nodes; adjust capacity after observing CPU, memory, and request latency.

For example, with `eksctl`, set your region and cluster name, then create a managed node group across the cluster's availability zones:

```bash
AWS_REGION=us-east-1
CLUSTER_NAME=ricoz-prod
eksctl create cluster \
  --name "$CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --nodegroup-name api-workers \
  --node-type t3.large \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 6 \
  --managed \
  --node-private-networking
aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
kubectl get nodes
```

This creates the EKS cluster and managed nodes, but does not install the AWS Load Balancer Controller or set up cluster node autoscaling. Install the AWS Load Balancer Controller following the current AWS EKS guide for your cluster; it requires an IAM role/service account with the controller policy. Install Metrics Server if it is not already available:

```bash
kubectl top nodes
```

Do not continue until `kubectl get nodes` lists Ready nodes and `kubectl top nodes` returns metrics.

## 2. Build and push the API image to ECR

Create a private ECR repository once, then build the server image from the `server` directory:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ricoz-portals-api"
IMAGE_TAG=$(date -u +%Y%m%d%H%M%S)

aws ecr describe-repositories --repository-names ricoz-portals-api --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name ricoz-portals-api --region "$AWS_REGION"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker build --platform linux/amd64 -t "${ECR_URI}:${IMAGE_TAG}" server
docker push "${ECR_URI}:${IMAGE_TAG}"
```

Use the same AWS region as your cluster and ACM certificate. If your EKS nodes are ARM-based, build for `linux/arm64` instead. Use a unique immutable tag for each release; do not deploy `latest`.

## 3. Create the application environment Secret

On a trusted machine, create `server/.env.production` with the production settings from `.env.example`. Set at least `NODE_ENV=production`, `PORT=4000`, `MONGO_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CLIENT_URL`. Also provide credentials required by enabled features, such as SMTP, Cloudinary, LiveKit, and integrations. Use the real HTTPS frontend origin(s) in `CLIENT_URL`. For Redis/Valkey TLS, use a `rediss://` URL and configure the endpoint's authentication and certificates as required by the provider.

Create the Kubernetes Secret without adding the env file to Git:

```bash
kubectl create namespace ricoz --dry-run=client -o yaml | kubectl apply -f -
kubectl -n ricoz create secret generic ricoz-api-env \
  --from-env-file=server/.env.production \
  --dry-run=client -o yaml | kubectl apply -f -
```

Do not paste secret values into a manifest, command history, or support logs. Kubernetes Secrets are not encrypted in etcd by default: enable EKS envelope encryption and tightly restrict IAM/Kubernetes access. For production secret rotation and centralized audit, prefer AWS Secrets Manager with the AWS Secrets and Configuration Provider/Secrets Store CSI Driver or External Secrets Operator; update the Kubernetes Secret whenever a value changes.

## 4. Set the image and install the API/workers

Replace `REPLACE_WITH_ECR_IMAGE_URI` in both `k8s/api.yaml` and `k8s/workers.yaml` with the versioned image URI, for example `<account-id>.dkr.ecr.<region>.amazonaws.com/ricoz-portals-api:<tag>`. Do not commit private credentials or the production environment file.

Apply the API, worker, and ingress resources:

```bash
kubectl apply -n ricoz -f server/k8s/api.yaml
kubectl apply -n ricoz -f server/k8s/workers.yaml
```

In `server/k8s/ingress.yaml`, set `REPLACE_WITH_ACM_CERTIFICATE_ARN` to your issued ACM certificate ARN and `REPLACE_WITH_API_HOSTNAME` to the DNS hostname. Then apply it:

```bash
kubectl apply -n ricoz -f server/k8s/ingress.yaml
kubectl -n ricoz get pods,service,hpa,pdb,ingress
kubectl -n ricoz rollout status deployment/ricoz-api
kubectl -n ricoz rollout status deployment/ricoz-workers
```

Create a DNS `A`/alias record for the API hostname pointing to the ALB hostname shown by:

```bash
kubectl -n ricoz get ingress ricoz-api
```

The ALB terminates HTTPS using ACM and forwards HTTP to the in-cluster service. The ALB idle timeout is set to one hour to support the app's WebSocket endpoint. The API's `/health` endpoint is used for liveness and ALB target health; `/ready` only returns success after MongoDB is connected.

## 5. Verify, scale, and update

Check rollout, pod health, worker logs, and HPA metrics:

```bash
API_HOSTNAME=api.example.com
kubectl -n ricoz get pods,hpa
kubectl -n ricoz logs deployment/ricoz-api --all-pods=true --tail=100
kubectl -n ricoz logs deployment/ricoz-workers --tail=100
kubectl -n ricoz describe hpa ricoz-api
curl -fsS "https://${API_HOSTNAME}/health"
curl -fsS "https://${API_HOSTNAME}/ready"
```

`/ready` returning HTTP 503 means MongoDB is not connected; inspect the API logs and check Atlas network access, DNS, credentials, and EKS egress. HPA needs working Metrics Server data. It scales between 2 and 10 API pods; set safe per-pod capacity and database connection limits before raising that ceiling. The single worker deployment intentionally stays at one replica because application timers are not distributed leader-elected. It uses a `Recreate` strategy so its old and new pods do not intentionally run together.

For a temporary manual scale adjustment, edit `minReplicas`/`maxReplicas` in the HPA (not the Deployment's replica count, which the HPA controls). For a new release, build and push a new image tag, update the image in both manifests, then apply and wait for rollouts:

```bash
kubectl apply -n ricoz -f server/k8s/api.yaml
kubectl apply -n ricoz -f server/k8s/workers.yaml
kubectl -n ricoz rollout status deployment/ricoz-api
kubectl -n ricoz rollout status deployment/ricoz-workers
```

## Operational notes

- This deploys the API only. It does not deploy the Next.js client, MongoDB, Redis/Valkey, LiveKit, TURN, or external mail/media providers.
- API pods need outbound access to MongoDB, Redis, and any external APIs used by enabled features.
- Chat WebSocket connections are balanced across API pods by the ALB; Redis provides cross-pod fanout. Reconnecting clients may land on a different pod.
- The API and worker pods have CPU/memory requests and limits. Tune them against observed load; PDF generation and concurrent uploads may be memory intensive.
- The API Deployment has an HPA, rolling-update limits, readiness/liveness probes, zone spreading, and a PodDisruptionBudget. None of these replace backups, monitoring, alerting, database capacity planning, or load testing.
- Do not rely on container-local storage for uploads or user files; use the configured Cloudinary/external object storage.
