import axios from "axios";

const BASE_URL = "/api/v1";

// ── Request concurrency limiter ──────────────────────────────────────────────
// Prevents bursting too many requests at once and triggering backend rate limits.
const MAX_CONCURRENT = 3;
const MIN_INTERVAL_MS = 150; // min gap between request starts
let _active = 0;
let _lastStart = 0;
const _queue: Array<() => void> = [];

function drainQueue() {
  if (_queue.length === 0 || _active >= MAX_CONCURRENT) return;
  const now = Date.now();
  const wait = Math.max(0, _lastStart + MIN_INTERVAL_MS - now);
  setTimeout(() => {
    if (_queue.length === 0 || _active >= MAX_CONCURRENT) return;
    const next = _queue.shift();
    if (next) { _active++; _lastStart = Date.now(); next(); }
  }, wait);
}

function acquireSlot(): Promise<void> {
  return new Promise(resolve => {
    _queue.push(resolve);
    drainQueue();
  });
}

function releaseSlot() {
  _active = Math.max(0, _active - 1);
  drainQueue();
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// Request interceptor — attach token, idempotency key, and acquire concurrency slot
api.interceptors.request.use(
  async (config) => {
    await acquireSlot();
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    if (["post", "put", "patch"].includes((config.method || "").toLowerCase()) && !config.headers["Idempotency-Key"]) {
      config.headers["Idempotency-Key"] = crypto.randomUUID();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

const processRefreshQueue = (token: string) => {
  _refreshQueue.forEach((cb) => cb(token));
  _refreshQueue = [];
};

// Response interceptor — release concurrency slot, handle 401 with token refresh
api.interceptors.response.use(
  (response) => {
    releaseSlot();
    if (response.config?.url?.includes("/auth/logout")) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401) {
      const isAuthRoute =
        originalRequest?.url?.includes("/auth/login") ||
        originalRequest?.url?.includes("/auth/logout") ||
        originalRequest?.url?.includes("/auth/register") ||
        originalRequest?.url?.includes("/auth/refresh") ||
        originalRequest?.url?.includes("/auth/2fa") ||
        originalRequest?.url?.includes("/auth/google") ||
        originalRequest?.url?.includes("/auth/apple");
      if (isAuthRoute) return Promise.reject(error);

      if (!originalRequest._retry) {
        if (_isRefreshing) {
          return new Promise((resolve) => {
            _refreshQueue.push((token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }
        originalRequest._retry = true;
        _isRefreshing = true;
        try {
          const storedRefreshToken = localStorage.getItem("refreshToken");
          if (!storedRefreshToken) throw new Error("No refresh token");
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: storedRefreshToken }, { timeout: 30000 });
          const newAccessToken = res.data?.data?.access_token || res.data?.access_token;
          const newRefreshToken = res.data?.data?.refresh_token || res.data?.refresh_token;
          if (!newAccessToken) throw new Error("Invalid refresh response");
          localStorage.setItem("accessToken", newAccessToken);
          if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
          processRefreshQueue(newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError: unknown) {
          _refreshQueue = [];
          const err = refreshError as { response?: { status?: number }; message?: string };
          const isAuthRejection = err?.response?.status === 401 || err?.response?.status === 403 || err?.message === "No refresh token" || err?.message === "Invalid refresh response";
          if (isAuthRejection) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
            if (authEvents.onUnauthorized) authEvents.onUnauthorized();
          }
        } finally {
          _isRefreshing = false;
        }
      }
    }
    releaseSlot();
    return Promise.reject(error);
  }
);

export const authEvents = { onUnauthorized: null as (() => void) | null };

export default api;
