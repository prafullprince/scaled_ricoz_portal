# Production deployment

This setup runs the Express API and Redis in Docker on EC2, serves the API through Nginx with HTTPS, and deploys the Next.js client on Vercel.

For an existing PM2 deployment, use the PM2 section below instead of Docker. The Nginx and Vercel sections apply to both approaches.

## Workspace data requirements

Leave submissions use an atomic per-user lock in `WorkspaceData`, compatible with the existing MongoDB deployment without transactions. A concurrent request receives HTTP 409 and can be retried; locks left behind by a crashed process expire after 60 seconds. Retain the unique company/user index on `WorkspaceData`.

Ensure database indexes are created for `LeavePolicy` (company and department), `PlannerHistory` (`expiresAt`, TTL of zero), and `Notification` (company, user, created date). Planner reads exclude expired entries immediately; MongoDB's asynchronous TTL monitor physically deletes them shortly afterward. Task notifications remain stored until the recipient deletes them. Redis pub/sub and the authenticated `/ws/chat` connection provide live delivery; the inbox remains available after reconnecting.

## PM2 deployment (without Docker)

Install Node.js 22, PM2, Redis, Nginx, and Certbot on EC2. From the repository's `server` directory:

```bash
npm ci
npm run build
cp .env.example .env
# Edit .env with production values before starting PM2.
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

The API reads `server/.env` through `dotenv`. Its production origin must exactly match the browser origin, with no trailing slash:

```dotenv
NODE_ENV=production
CLIENT_URL=https://innovation.ricoz.in
REDIS_URL=redis://127.0.0.1:6379
BULLMQ_PREFIX={bull}
```

For Valkey Serverless or any Redis Cluster endpoint, keep `BULLMQ_PREFIX={bull}`. BullMQ runs Lua scripts against multiple queue keys, and the braces force those keys into the same cluster hash slot. The API's pub/sub and call-state keys do not use BullMQ's prefix.

After changing `.env` or shell environment variables, restart with updated environment state:

```bash
npm run build
pm2 restart ricoz-api --update-env
pm2 save
```

The server now indexes chat history as `{ conversationId: 1, createdAt: -1, _id: -1 }`, matching latest-message reads and older-message cursor pagination. After the first restart, verify MongoDB created it:

```javascript
db.chatmessages.getIndexes()
```

The index name should be similar to `conversationId_1_createdAt_-1__id_-1`. If production disables Mongoose auto-indexing later, create it once manually:

```javascript
db.chatmessages.createIndex({ conversationId: 1, createdAt: -1, _id: -1 })
```

Confirm the production CORS response contains the frontend origin before testing login again:

```bash
curl -sS -D - -o /dev/null -X OPTIONS \
	https://innovationapi.ricoz.in/api/v1/auth/refresh \
	-H 'Origin: https://innovation.ricoz.in' \
	-H 'Access-Control-Request-Method: POST' \
	-H 'Access-Control-Request-Headers: content-type'
```

The response must include:

```text
Access-Control-Allow-Origin: https://innovation.ricoz.in
Access-Control-Allow-Credentials: true
```

After switching from the old default `bull` prefix, stop the API before removing abandoned old queue keys. Only do this if no old chat jobs need to be recovered:

```bash
pm2 stop ricoz-api
redis-cli --tls -h <valkey-endpoint> -p 6379 -a '<valkey-auth-token>' --scan --pattern 'bull:chat-message-persistence:*' | while read -r key; do redis-cli --tls -h <valkey-endpoint> -p 6379 -a '<valkey-auth-token>' DEL "$key"; done
pm2 start ricoz-api --env production --update-env
```

If this is a new Nginx site, copy the example, replace its domain, and reload only after validation:

```bash
sudo cp nginx.ec2.conf.example /etc/nginx/sites-available/ricoz-api
sudo sed -i 's/api\.example\.com/innovationapi.ricoz.in/g' /etc/nginx/sites-available/ricoz-api
sudo ln -sfn /etc/nginx/sites-available/ricoz-api /etc/nginx/sites-enabled/ricoz-api
sudo nginx -t
sudo systemctl reload nginx
```

If Certbot has already configured HTTPS, do not overwrite that active file. Add the `map` block from `nginx.ec2.conf.example` above its `server` blocks, then add or replace the `/ws/chat` location inside the existing HTTPS `server_name innovationapi.ricoz.in` block. Preserve all `listen 443 ssl`, certificate, and Certbot directives. Validate and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Verify that no older enabled Nginx site owns the same hostname:

```bash
sudo nginx -T | grep -nE 'server_name|ws/chat|proxy_set_header (Upgrade|Connection)'
```

The WebSocket location must appear in the active `server_name innovationapi.ricoz.in` block.

Use placeholders such as `api.example.com` only as examples. Replace them with the real domain before deployment.

## 1. Prepare external services

1. Create a MongoDB Atlas database and database user.
2. Allow the EC2 public IP in Atlas Network Access. A fixed EC2 Elastic IP is recommended.
3. Create the Cloudinary, ZeptoMail, LiveKit, Gemini/OpenAI, and invoice API credentials required by `server/.env.example`.
4. Create a DNS `A` record for `api.example.com` pointing to the EC2 Elastic IP.

## 2. Prepare EC2

Use Ubuntu 24.04 LTS or a current equivalent. A `t3.small` is a practical minimum when the API, BullMQ worker, and Redis share one host.

In the EC2 security group allow:

- TCP 22 from an administrator IP only.
- TCP 80 from `0.0.0.0/0` and `::/0`.
- TCP 443 from `0.0.0.0/0` and `::/0`.
- Do not expose ports 4000, 6379, or 27017.

Install Docker, the Compose plugin, Nginx, and Certbot:

```bash
sudo apt update
sudo apt install -y ca-certificates curl nginx certbot python3-certbot-nginx
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and back in after adding the Docker group.

## 3. Configure and start the API

Clone the repository and enter the server directory:

```bash
git clone <repository-url> ricoz_portals
cd ricoz_portals/server
cp .env.example .env.production
```

Offer PDFs use `server/assets/offer-letter-template.pdf`, a bundled copy of the supplied `Offer letter template.pdf`. Its two 612 x 792 panels are split into exactly two letter-sized pages, excluding the 40-point centre gutter. The original company branding, signature, footer, and terms are preserved; recipient and engagement fields are substituted. Inputs that cannot fit legibly are rejected rather than overflowing or adding pages. The Docker image includes the template and fallback fonts. For non-Docker deployments, keep the `assets` directory next to `dist`; no secret-file mount is required.

Edit `.env.production`. At minimum, production startup requires:

```dotenv
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
CLIENT_URL=https://your-project.vercel.app
PUBLIC_API_URL=https://your-real-api-domain.com
OFFER_CLIENT_URL=https://your-project.vercel.app
```

Offer emails use `PUBLIC_API_URL` for a signed, offer-specific PDF link that expires after 30 days. The link permits reading that document only; opening it does not record acceptance. The same PDF is attached to the email. Treat links as private, and avoid logging query strings on the `/api/v1/recruitment/offer-document` route. Set `OFFER_HR_EMAIL`, `OFFER_PRIVACY_URL`, and `OFFER_TERMS_URL` to the approved HR inbox and published policies; otherwise the contact page and the offer's own terms are used. HR should approve the supplied company branding, signature, and terms before sending. Existing saved PDFs remain unchanged until the offer is generated or sent again.

For a local sample without sending mail or accessing candidate records, run `npx tsx src/scripts/preview-offer.ts` from `server` and open `http://localhost:3101`. Set `OFFER_PREVIEW_PORT` to use another port. Sending requires an `endDate` in `YYYY-MM-DD` format (or `employmentTerms.endDate`), selected in the admin confirmation dialog and later than the sending date. The server stamps the start date immediately before sending, uses India calendar dates to calculate inclusive duration, and fixes the payment cycle to Monthly. The offer end date is distinct from the account's role-expiry date; changing one does not modify the other. Other unspecified details display as "To be confirmed" rather than inferred contractual terms.

Generate secrets without putting them in shell history:

```bash
openssl rand -base64 48
```

Complete all other values documented in `.env.example`. `CLIENT_URL` accepts comma-separated HTTPS origins, for example a Vercel domain and a custom frontend domain, without trailing slashes.

Build and launch:

```bash
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
curl http://127.0.0.1:4000/health
```

Inspect logs with:

```bash
docker compose -f compose.production.yml logs -f api
```

## 4. Configure Nginx and HTTPS

Copy the example and replace `api.example.com`:

```bash
sudo cp nginx.ec2.conf.example /etc/nginx/sites-available/ricoz-api
sudo sed -i 's/api\.example\.com/your-real-api-domain.com/g' /etc/nginx/sites-available/ricoz-api
sudo ln -s /etc/nginx/sites-available/ricoz-api /etc/nginx/sites-enabled/ricoz-api
sudo nginx -t
sudo systemctl reload nginx
```

After DNS resolves to EC2, obtain a certificate:

```bash
sudo certbot --nginx -d your-real-api-domain.com
```

Verify both endpoints:

```bash
curl https://your-real-api-domain.com/health
curl -I https://your-real-api-domain.com/api/v1
```

HTTPS is required. The refresh cookie is secure and cross-site, and browser chat connects over `wss://`. The Nginx example forwards WebSocket upgrades for `/ws/chat`.

## 5. Deploy the client on Vercel

1. Import the repository into Vercel.
2. Set **Root Directory** to `client`.
3. Keep the detected framework as Next.js and the standard build command.
4. Add these variables to Production, Preview, and Development as appropriate:

```dotenv
NEXT_PUBLIC_API_URL=https://your-real-api-domain.com/api/v1
NEXT_PUBLIC_CHAT_WS_URL=wss://your-real-api-domain.com/ws/chat
NEXT_PUBLIC_API_TIMEOUT_MS=30000
```

5. Deploy the project.
6. Copy the final Vercel production origin into the server's `CLIENT_URL` value.
7. Restart the API after changing the origin:

```bash
cd ricoz_portals/server
docker compose -f compose.production.yml up -d --force-recreate api
```

For Vercel preview deployments, add only the specific preview origins that need API access. Do not use a wildcard for credentialed CORS.

## 6. Smoke test

1. Open the Vercel application and sign in.
2. Refresh the page and confirm the session survives through the refresh cookie.
3. Open browser developer tools and confirm API requests use HTTPS without CORS errors.
4. Open chat and confirm the WebSocket connects to the `wss://` endpoint.
5. Upload a supported attachment and generate an offer letter.
6. Check API and Redis health:

```bash
cd ricoz_portals/server
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 api
```

## Updating

```bash
cd ricoz_portals
git pull
cd server
docker compose -f compose.production.yml up -d --build
docker image prune -f
```

Back up MongoDB through Atlas. The Compose Redis volume persists queued/realtime state across container recreation, but Redis is not the system of record for application data.
