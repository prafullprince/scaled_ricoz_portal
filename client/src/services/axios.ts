import axios from "axios";
import { toast } from "sonner";
import { getStoreRef } from "@/redux/store.reference";
import { clearAuth, setSession, type IUser } from "@/redux/slice/auth.slice";
import { getActiveCompanyId, setActiveCompanyId } from "@/lib/company";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 30000),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

function exactErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          errors?: Array<{ field?: string; message?: string }>;
        }
      | undefined;
    const details = data?.errors
      ?.map((item) =>
        item.message
          ? `${item.field ? `${item.field}: ` : ""}${item.message}`
          : "",
      )
      .filter(Boolean)
      .join(" ");
    if (data?.message || details) {
      const message = [data?.message, details].filter(Boolean).join(" ");
      if (
        error.response?.status === 409 &&
        /already applied|duplicate|already exists/i.test(message)
      ) {
        return "You have already applied to this opportunity.";
      }
      return message;
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
      return "The request timed out. Please try again.";
    if (!error.response)
      return "Unable to reach the server. Check your connection and try again.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

let activeRequests = 0;
function broadcastNetworkActivity(active: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ricoz-network-activity", { detail: { active } }),
    );
  }
}

api.interceptors.request.use((config) => {
  activeRequests += 1;
  broadcastNetworkActivity(true);
  const token = getStoreRef().getState().auth.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = getActiveCompanyId();
  if (companyId && !config.headers["X-Company-Id"])
    config.headers["X-Company-Id"] = companyId;
  return config;
});

// intercept response -> refresh
let refreshPromise: Promise<{ access_token: string; user: IUser }> | null =
  null;

api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) broadcastNetworkActivity(false);
    return response;
  },
  async (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) broadcastNetworkActivity(false);
    if (axios.isCancel(error)) return Promise.reject(error);
    const originalRequest = error.config;
    const alreadyKnownLoggedOut =
      getStoreRef().getState().auth.status === "unauthenticated";
    const shouldRefresh =
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes("/refresh") &&
      !alreadyKnownLoggedOut;
    const missingNotificationInbox =
      error.response?.status === 404 &&
      originalRequest?.method?.toLowerCase() === "get" &&
      originalRequest.url?.replace(/\/+$/, "") === "/notifications";
    const unavailableAction =
      error.response?.status === 403 &&
      exactErrorMessage(error) === "This action is currently unavailable.";
    if (
      !shouldRefresh &&
      error.response?.status !== 401 &&
      !missingNotificationInbox &&
      !unavailableAction
    )
      toast.error(exactErrorMessage(error));
    if (
      !shouldRefresh ||
      originalRequest?._retry ||
      originalRequest?.url?.includes("/refresh") ||
      alreadyKnownLoggedOut
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      // Share a single in-flight refresh across concurrent 401s instead of firing one per request.
      refreshPromise ??= api
        .post("/auth/refresh")
        .then((res) => res.data)
        .finally(() => {
          refreshPromise = null;
        });
      const data = await refreshPromise;
      getStoreRef().dispatch(
        setSession({ accessToken: data.access_token, user: data.user }),
      );
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      getStoreRef().dispatch(clearAuth());
      setActiveCompanyId(null);
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
