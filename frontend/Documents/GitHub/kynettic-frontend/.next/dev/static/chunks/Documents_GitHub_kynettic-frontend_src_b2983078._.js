(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/Documents/GitHub/kynettic-frontend/src/services/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authEvents",
    ()=>authEvents,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/axios/lib/axios.js [app-client] (ecmascript)");
;
const BASE_URL = "/api/v1";
const api = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].create({
    baseURL: BASE_URL,
    timeout: 60000
});
// Request interceptor — attach token from localStorage and idempotency key for mutating requests
api.interceptors.request.use((config)=>{
    if ("TURBOPACK compile-time truthy", 1) {
        const token = localStorage.getItem("accessToken");
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    if ([
        "post",
        "put",
        "patch"
    ].includes((config.method || "").toLowerCase()) && !config.headers["Idempotency-Key"]) {
        config.headers["Idempotency-Key"] = crypto.randomUUID();
    }
    return config;
}, (error)=>Promise.reject(error));
let _isRefreshing = false;
let _refreshQueue = [];
const processRefreshQueue = (token)=>{
    _refreshQueue.forEach((cb)=>cb(token));
    _refreshQueue = [];
};
// Response interceptor — handle 401 with token refresh
api.interceptors.response.use((response)=>{
    if (response.config?.url?.includes("/auth/logout")) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
    }
    return response;
}, async (error)=>{
    const originalRequest = error.config;
    if (error.response?.status === 401) {
        const isAuthRoute = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/logout") || originalRequest?.url?.includes("/auth/register") || originalRequest?.url?.includes("/auth/refresh") || originalRequest?.url?.includes("/auth/2fa") || originalRequest?.url?.includes("/auth/google") || originalRequest?.url?.includes("/auth/apple");
        if (isAuthRoute) return Promise.reject(error);
        if (!originalRequest._retry) {
            if (_isRefreshing) {
                return new Promise((resolve)=>{
                    _refreshQueue.push((token)=>{
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
                const res = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post(`${BASE_URL}/auth/refresh`, {
                    refresh_token: storedRefreshToken
                }, {
                    timeout: 30000
                });
                const newAccessToken = res.data?.data?.access_token || res.data?.access_token;
                const newRefreshToken = res.data?.data?.refresh_token || res.data?.refresh_token;
                if (!newAccessToken) throw new Error("Invalid refresh response");
                localStorage.setItem("accessToken", newAccessToken);
                if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
                processRefreshQueue(newAccessToken);
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                _refreshQueue = [];
                const err = refreshError;
                const isAuthRejection = err?.response?.status === 401 || err?.response?.status === 403 || err?.message === "No refresh token" || err?.message === "Invalid refresh response";
                if (isAuthRejection) {
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                    localStorage.removeItem("user");
                    if (authEvents.onUnauthorized) authEvents.onUnauthorized();
                }
            } finally{
                _isRefreshing = false;
            }
        }
    }
    return Promise.reject(error);
});
const authEvents = {
    onUnauthorized: null
};
const __TURBOPACK__default__export__ = api;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/services/auth.service.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "authService",
    ()=>authService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/api.ts [app-client] (ecmascript)");
;
const authService = {
    login: async (email, password)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/login", {
            email,
            password,
            device_type: "web"
        });
        return r.data;
    },
    logout: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/logout");
        return r.data;
    },
    registerRequestOtp: async (email)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/register/request-otp", {
            email
        });
        return r.data;
    },
    registerVerifyOtp: async (email, otp)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/register/verify-otp", {
            email,
            otp
        });
        return r.data;
    },
    registerSetPassword: async (token, password, referralCode)=>{
        const payload = {
            registration_token: token,
            password
        };
        if (referralCode) payload.referral_code = referralCode;
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/register/set-password", payload);
        return r.data;
    },
    forgotPasswordRequestOtp: async (email)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/forgot-password/request-otp", {
            email
        });
        return r.data;
    },
    forgotPasswordVerifyOtp: async (email, otp)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/forgot-password/verify-otp", {
            email,
            otp
        });
        return r.data;
    },
    forgotPasswordReset: async (token, newPassword)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/forgot-password/reset", {
            reset_token: token,
            new_password: newPassword
        });
        return r.data;
    },
    refreshToken: async (refreshToken)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/refresh", {
            refresh_token: refreshToken
        });
        return r.data;
    },
    verify2FA: async (preAuthToken, code)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/2fa/verify", {
            pre_auth_token: preAuthToken,
            code
        });
        return r.data;
    },
    loginWithGoogle: async (idToken)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/google", {
            id_token: idToken,
            device_type: "web"
        });
        return r.data;
    },
    loginWithApple: async (idToken, nonce)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/auth/apple", {
            id_token: idToken,
            device_type: "web",
            nonce: nonce || crypto.randomUUID()
        });
        return r.data;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/context/AuthContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/axios/lib/axios.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$auth$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/auth.service.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    loading: false,
    isInitializing: true,
    login: async ()=>{},
    loginWithGoogle: async ()=>{},
    logout: async ()=>{},
    updateUser: async ()=>{},
    isAuthenticated: false,
    setAuthData: ()=>{}
});
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
function getTokenExpiry(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp ? payload.exp * 1000 : null;
    } catch  {
        return null;
    }
}
const AuthProvider = ({ children })=>{
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isInitializing, setIsInitializing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [isAuthenticated, setIsAuthenticated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const lastActivity = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(Date.now());
    const inactivityTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const refreshTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isAuthenticatedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    // Keep ref in sync so callbacks don't capture stale state
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            isAuthenticatedRef.current = isAuthenticated;
        }
    }["AuthProvider.useEffect"], [
        isAuthenticated
    ]);
    const doLogout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[doLogout]": async ()=>{
            if (refreshTimer.current) {
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
            }
            try {
                await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$auth$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authService"].logout();
            } catch  {} finally{
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                localStorage.removeItem("user");
                setUser(null);
                setIsAuthenticated(false);
            }
        }
    }["AuthProvider.useCallback[doLogout]"], []);
    const scheduleProactiveRefresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[scheduleProactiveRefresh]": (accessToken)=>{
            if (refreshTimer.current) clearTimeout(refreshTimer.current);
            const exp = getTokenExpiry(accessToken);
            if (!exp) return;
            // Refresh 60s before expiry (minimum 5s delay to avoid loops)
            const delay = Math.max(5000, exp - Date.now() - 60_000);
            refreshTimer.current = setTimeout({
                "AuthProvider.useCallback[scheduleProactiveRefresh]": async ()=>{
                    if (!isAuthenticatedRef.current) return;
                    const storedRefresh = localStorage.getItem("refreshToken");
                    if (!storedRefresh) return;
                    try {
                        const res = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/api/v1/auth/refresh", {
                            refresh_token: storedRefresh
                        }, {
                            timeout: 15000
                        });
                        const newAccess = res.data?.data?.access_token || res.data?.access_token;
                        const newRefresh = res.data?.data?.refresh_token || res.data?.refresh_token;
                        if (!newAccess) return;
                        localStorage.setItem("accessToken", newAccess);
                        if (newRefresh) localStorage.setItem("refreshToken", newRefresh);
                        scheduleProactiveRefresh(newAccess);
                    } catch  {
                    // Silent — reactive refresh on next 401 will handle it
                    }
                }
            }["AuthProvider.useCallback[scheduleProactiveRefresh]"], delay);
        }
    }["AuthProvider.useCallback[scheduleProactiveRefresh]"], []);
    // Restore session from localStorage on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            try {
                const token = localStorage.getItem("accessToken");
                const userData = localStorage.getItem("user");
                if (token && userData) {
                    setUser(JSON.parse(userData));
                    setIsAuthenticated(true);
                    scheduleProactiveRefresh(token);
                }
            } catch  {
            // Corrupted storage — start fresh
            } finally{
                setIsInitializing(false);
            }
            // Listen for forced logout from API interceptor
            __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authEvents"].onUnauthorized = ({
                "AuthProvider.useEffect": ()=>{
                    doLogout();
                }
            })["AuthProvider.useEffect"];
            return ({
                "AuthProvider.useEffect": ()=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authEvents"].onUnauthorized = null;
                }
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], [
        doLogout,
        scheduleProactiveRefresh
    ]);
    // 30-minute inactivity logout
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            if (!isAuthenticated) return;
            const resetActivity = {
                "AuthProvider.useEffect.resetActivity": ()=>{
                    lastActivity.current = Date.now();
                }
            }["AuthProvider.useEffect.resetActivity"];
            const activityEvents = [
                "mousedown",
                "mousemove",
                "keydown",
                "touchstart",
                "scroll",
                "click"
            ];
            activityEvents.forEach({
                "AuthProvider.useEffect": (e)=>window.addEventListener(e, resetActivity, {
                        passive: true
                    })
            }["AuthProvider.useEffect"]);
            inactivityTimer.current = setInterval({
                "AuthProvider.useEffect": ()=>{
                    if (Date.now() - lastActivity.current > INACTIVITY_TIMEOUT) {
                        doLogout();
                    }
                }
            }["AuthProvider.useEffect"], 60_000); // check every minute
            return ({
                "AuthProvider.useEffect": ()=>{
                    activityEvents.forEach({
                        "AuthProvider.useEffect": (e)=>window.removeEventListener(e, resetActivity)
                    }["AuthProvider.useEffect"]);
                    if (inactivityTimer.current) clearInterval(inactivityTimer.current);
                }
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], [
        isAuthenticated,
        doLogout
    ]);
    const setAuthData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AuthProvider.useCallback[setAuthData]": (access_token, refresh_token, userData)=>{
            localStorage.setItem("accessToken", access_token);
            localStorage.setItem("refreshToken", refresh_token);
            localStorage.setItem("user", JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            scheduleProactiveRefresh(access_token);
        }
    }["AuthProvider.useCallback[setAuthData]"], [
        scheduleProactiveRefresh
    ]);
    const login = async (email, password)=>{
        setLoading(true);
        try {
            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$auth$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authService"].login(email, password);
            // 202: 2FA required
            const preAuthToken = response?.pre_auth_token || response?.data?.pre_auth_token;
            if (preAuthToken) {
                throw {
                    requires2FA: true,
                    email,
                    pre_auth_token: preAuthToken
                };
            }
            // 200: normal login
            const loginData = response?.data;
            if (!loginData?.access_token || !loginData?.refresh_token) {
                throw new Error("Invalid login response from server.");
            }
            setAuthData(loginData.access_token, loginData.refresh_token, loginData.user);
            return response;
        } catch (error) {
            if (error?.requires2FA) throw error;
            throw error;
        } finally{
            setLoading(false);
        }
    };
    const loginWithGoogle = async (idToken)=>{
        setLoading(true);
        try {
            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$auth$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["authService"].loginWithGoogle(idToken);
            const loginData = response?.data;
            if (!loginData?.access_token || !loginData?.refresh_token) {
                throw new Error("Invalid login response from server.");
            }
            setAuthData(loginData.access_token, loginData.refresh_token, loginData.user);
            return response;
        } finally{
            setLoading(false);
        }
    };
    const logout = doLogout;
    const updateUser = async (userData)=>{
        const fullUser = {
            ...user,
            ...userData
        };
        localStorage.setItem("user", JSON.stringify(fullUser));
        setUser(fullUser);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            user,
            loading,
            isInitializing,
            login,
            loginWithGoogle,
            logout,
            updateUser,
            isAuthenticated,
            setAuthData
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/Documents/GitHub/kynettic-frontend/src/context/AuthContext.tsx",
        lineNumber: 189,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AuthProvider, "wp/PBrahvANkf2hxEiWZqKmiOtE=");
_c = AuthProvider;
const useAuth = ()=>{
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
};
_s1(useAuth, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/services/wallet.service.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "walletService",
    ()=>walletService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/api.ts [app-client] (ecmascript)");
;
const walletService = {
    getWallets: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/users/me/wallets");
        return r.data;
    },
    getTransactions: async (currency, page = 1, pageSize = 10, category, startDate, endDate)=>{
        const params = {
            page,
            page_size: pageSize
        };
        if (currency) params.currency = currency;
        if (category) params.category = category;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/users/me/wallet-transactions", {
            params
        });
        return r.data;
    },
    getTransaction: async (id)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get(`/users/me/wallet-transactions/${id}`);
        return r.data;
    },
    getWalletAddress: async (chain, currency)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/users/me/wallet-address", {
            params: {
                chain,
                currency
            }
        });
        return r.data;
    },
    getCurrencyNetworks: async (currencyId)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get(`/currencies/${currencyId}/networks`);
        return r.data;
    },
    getCurrencies: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/currencies");
        return r.data;
    },
    getCurrencyPrice: async (currencyId)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get(`/currencies/${currencyId}/price`);
        return r.data;
    },
    withdrawCrypto: async (chain, currency, address, amount, pin, auth_code)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/users/me/crypto-withdrawals", {
            chain,
            currency,
            address,
            amount: amount.trim(),
            pin,
            auth_code
        }, {
            headers: {
                "Idempotency-Key": crypto.randomUUID()
            }
        });
        return r.data;
    },
    getDepositAccount: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/users/me/deposit-account");
        return r.data;
    },
    getFiatBanks: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/users/me/fiat-banks");
        return r.data;
    },
    lookupFiatBank: async (accountNumber, bankCode)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/users/me/fiat-bank-lookup", {
            account_number: accountNumber,
            bank_code: bankCode
        });
        return r.data;
    },
    withdrawFiat: async (data)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/users/me/fiat-withdrawals", {
            ...data,
            narration: data.narration || ""
        }, {
            headers: {
                "Idempotency-Key": crypto.randomUUID()
            }
        });
        return r.data;
    },
    getCryptoWithdrawalFee: async (currency, chain)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/withdrawal-fees/crypto", {
            params: {
                currency: currency.toLowerCase(),
                chain: chain.toLowerCase()
            }
        });
        return r.data;
    },
    getWithdrawalFees: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/withdrawal-fees");
        return r.data;
    },
    internalTransfer: async (data)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/users/me/internal-transfer", data, {
            headers: {
                "Idempotency-Key": crypto.randomUUID()
            }
        });
        return r.data;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/context/WalletContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalletProvider",
    ()=>WalletProvider,
    "useWallet",
    ()=>useWallet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$wallet$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/wallet.service.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/context/AuthContext.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
const WalletContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({});
let _cachedCurrencies = null;
const WalletProvider = ({ children })=>{
    _s();
    const { isAuthenticated, user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [wallets, setWallets] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const fetchWallets = async ()=>{
        if (!isAuthenticated) return;
        setLoading(true);
        setError(null);
        try {
            let supportedCurrencies = _cachedCurrencies || [];
            if (!_cachedCurrencies) {
                try {
                    const currenciesRes = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$wallet$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["walletService"].getCurrencies();
                    supportedCurrencies = currenciesRes.data || [];
                    _cachedCurrencies = supportedCurrencies;
                } catch  {}
            }
            let userWallets = [];
            try {
                const walletsRes = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$wallet$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["walletService"].getWallets();
                userWallets = walletsRes.data || [];
            } catch  {
                if (wallets.length > 0) {
                    setLoading(false);
                    return;
                }
            }
            if (userWallets.length > 0) {
                const matchedCurrencies = new Set();
                const fromCurrencies = supportedCurrencies.length > 0 ? supportedCurrencies.map((currency)=>{
                    const sym = (currency.symbol || "").toUpperCase();
                    const existing = userWallets.find((w)=>(w.currency || "").toUpperCase() === sym);
                    if (existing) {
                        matchedCurrencies.add((existing.currency || "").toUpperCase());
                        return {
                            ...existing,
                            currency: (existing.currency || "").toUpperCase()
                        };
                    }
                    return {
                        id: -1,
                        user_id: user?.id || 0,
                        currency: sym,
                        currency_id: currency.id,
                        balance: 0,
                        locked_balance: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_virtual: true
                    };
                }) : [];
                const unmatchedWallets = userWallets.filter((w)=>!matchedCurrencies.has((w.currency || "").toUpperCase())).map((w)=>({
                        ...w,
                        currency: (w.currency || "").toUpperCase()
                    }));
                setWallets(fromCurrencies.length > 0 ? [
                    ...fromCurrencies,
                    ...unmatchedWallets
                ] : userWallets.map((w)=>({
                        ...w,
                        currency: (w.currency || "").toUpperCase()
                    })));
            } else if (supportedCurrencies.length > 0) {
                setWallets(supportedCurrencies.map((currency)=>({
                        id: -1,
                        user_id: user?.id || 0,
                        currency: (currency.symbol || "").toUpperCase(),
                        currency_id: currency.id,
                        balance: 0,
                        locked_balance: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_virtual: true
                    })));
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch wallets");
        } finally{
            setLoading(false);
        }
    };
    const getWalletByCurrency = (currency)=>wallets.find((w)=>(w.currency || "").toUpperCase() === (currency || "").toUpperCase());
    const internalTransfer = async (data)=>{
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$wallet$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["walletService"].internalTransfer(data);
        await fetchWallets();
        return response;
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            if (isAuthenticated) fetchWallets();
            else setWallets([]);
        }
    }["WalletProvider.useEffect"], [
        isAuthenticated
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WalletContext.Provider, {
        value: {
            wallets,
            loading,
            error,
            fetchWallets,
            getWalletByCurrency,
            internalTransfer
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/Documents/GitHub/kynettic-frontend/src/context/WalletContext.tsx",
        lineNumber: 106,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(WalletProvider, "as+iWaJ0ctcKkhZR8pGhRu62LmA=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = WalletProvider;
const useWallet = ()=>{
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(WalletContext);
};
_s1(useWallet, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
var _c;
__turbopack_context__.k.register(_c, "WalletProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/services/p2p.service.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "p2pService",
    ()=>p2pService
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/api.ts [app-client] (ecmascript)");
;
const p2pService = {
    getOrders: async (filters = {})=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/orders", {
            params: {
                currency_id: filters.currency_id,
                status: filters.status,
                page: filters.page || 1,
                page_size: filters.page_size || 50
            }
        });
        return r.data;
    },
    getAdById: async (id)=>{
        // Fallback 1: search user's own ads
        try {
            const mine = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/my-ads", {
                params: {
                    page: 1,
                    page_size: 100
                }
            });
            const found = (mine.data?.data || []).find((a)=>String(a.id) === String(id));
            if (found) return {
                data: found
            };
        } catch  {}
        // Fallback 2: search marketplace (buy + sell sides)
        for (const type of [
            "buy",
            "sell"
        ]){
            try {
                const market = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/ads", {
                    params: {
                        type,
                        mine_only: false,
                        page: 1,
                        page_size: 100
                    }
                });
                const found = (market.data?.data || []).find((a)=>String(a.id) === String(id));
                if (found) return {
                    data: found
                };
            } catch  {}
        }
        throw new Error("Ad not found");
    },
    getMarketplaceAds: async (type, currencyId, page = 1)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/ads", {
            params: {
                type,
                currency_id: currencyId,
                mine_only: false,
                page,
                page_size: 50
            }
        });
        return r.data;
    },
    getMyAds: async (status, page = 1)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/my-ads", {
            params: {
                status,
                page,
                page_size: 50
            }
        });
        return r.data;
    },
    getCurrencies: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/currencies");
        return r.data;
    },
    createAd: async (data)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/p2p/ads", data);
        return r.data;
    },
    updateAd: async (id, data)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].patch(`/p2p/ads/${id}`, data);
        return r.data;
    },
    deleteAd: async (id)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].delete(`/p2p/ads/${id}`);
        return r.data;
    },
    getFees: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/p2p/fees");
        return r.data;
    },
    executeTrade: async (adId, amountInput, inputCurrency, pin)=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].post("/p2p/orders", {
            ad_id: adId,
            amount_input: amountInput,
            input_currency: inputCurrency,
            pin
        }, {
            headers: {
                "Idempotency-Key": crypto.randomUUID()
            }
        });
        return r.data;
    },
    getCommunityLinks: async ()=>{
        const r = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].get("/community-links");
        return r.data;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/context/AdsContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AdsProvider",
    ()=>AdsProvider,
    "useAds",
    ()=>useAds
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/services/p2p.service.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/context/AuthContext.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
const AdsContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
const AdsProvider = ({ children })=>{
    _s();
    const { isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [ads, setAds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [currencies, setCurrencies] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [p2pFeeMultiplier, setP2pFeeMultiplier] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1.003);
    const mapApiAdToAd = (apiAd)=>{
        const isRollover = !!apiAd.rollover_enabled;
        const totalQty = parseFloat(apiAd.total_quantity || "0");
        const remainingQty = parseFloat(apiAd.remaining_quantity || "0") || totalQty;
        // For rollover ads total_quantity is 0 by design — don't cap, use remaining_quantity as-is.
        // For non-rollover: cap remaining at total to handle stale data (e.g. remaining=165 but total=100).
        const displayQuantity = isRollover ? remainingQty : remainingQty > 0 && remainingQty <= totalQty ? remainingQty : totalQty;
        const displayPrice = apiAd.effective_price || apiAd.price;
        return {
            id: apiAd.id.toString(),
            type: apiAd.type === "buy" ? "Buy" : "Sell",
            asset: apiAd.currency || "USDT",
            fiat: "NGN",
            priceType: apiAd.price_type === "fixed" ? "Fixed" : "Relative",
            price: displayPrice?.toString() || "0",
            relativePercent: apiAd.relative_percent?.toString(),
            totalQuantity: totalQty.toString(),
            remainingQuantity: displayQuantity.toString(),
            minLimit: apiAd.min_amount?.toString() || "0",
            active: apiAd.status === "active",
            createdAt: new Date(apiAd.created_at).getTime(),
            rolloverEnabled: apiAd.rollover_enabled,
            currencyId: apiAd.currency_id
        };
    };
    const fetchAds = async ()=>{
        try {
            const data = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].getMyAds();
            if (data?.data) setAds(data.data.map(mapApiAdToAd));
        } catch  {}
    };
    const fetchCurrencies = async ()=>{
        try {
            const data = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].getCurrencies();
            if (data?.data) {
                setCurrencies(data.data.map((c)=>({
                        id: c.id,
                        code: c.symbol,
                        name: c.name,
                        symbol: c.symbol,
                        type: [
                            "NGN",
                            "USD",
                            "EUR",
                            "GBP",
                            "KES",
                            "GHS",
                            "ZAR"
                        ].includes(c.symbol?.toUpperCase()) ? "fiat" : "crypto"
                    })));
            }
        } catch  {}
    };
    const fetchFees = async ()=>{
        try {
            const data = await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].getFees();
            const feeRate = parseFloat(data?.data);
            if (!isNaN(feeRate) && feeRate > 0) setP2pFeeMultiplier(1 + feeRate * 2);
        } catch  {}
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AdsProvider.useEffect": ()=>{
            if (isAuthenticated) {
                setLoading(true);
                Promise.all([
                    fetchAds(),
                    fetchCurrencies(),
                    fetchFees()
                ]).finally({
                    "AdsProvider.useEffect": ()=>setLoading(false)
                }["AdsProvider.useEffect"]);
            } else {
                setLoading(false);
            }
        }
    }["AdsProvider.useEffect"], [
        isAuthenticated
    ]);
    const refreshAds = async ()=>{
        setLoading(true);
        await fetchAds();
        setLoading(false);
    };
    const addAd = async (data)=>{
        await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].createAd(data);
        await fetchAds();
    };
    const updateAd = async (id, updates)=>{
        await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].updateAd(id, updates);
        await fetchAds();
    };
    const deleteAd = async (id)=>{
        setAds((prev)=>prev.filter((ad)=>ad.id !== id));
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$services$2f$p2p$2e$service$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["p2pService"].deleteAd(id);
        } catch  {}
        await fetchAds();
    };
    const toggleAdStatus = async (id, currentStatus)=>{
        const newStatus = currentStatus ? "paused" : "active";
        await updateAd(id, {
            status: newStatus
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AdsContext.Provider, {
        value: {
            ads,
            currencies,
            loading,
            p2pFeeMultiplier,
            refreshAds,
            refreshCurrencies: fetchCurrencies,
            addAd,
            updateAd,
            deleteAd,
            toggleAdStatus
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/Documents/GitHub/kynettic-frontend/src/context/AdsContext.tsx",
        lineNumber: 140,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AdsProvider, "Ent24DU+YlKSOWtYbsRZd3FXgDA=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = AdsProvider;
const useAds = ()=>{
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AdsContext);
    if (!context) throw new Error("useAds must be used within AdsProvider");
    return context;
};
_s1(useAds, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "AdsProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/GitHub/kynettic-frontend/src/app/providers.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Providers",
    ()=>Providers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$WalletContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/context/WalletContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AdsContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/src/context/AdsContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f40$react$2d$oauth$2f$google$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/GitHub/kynettic-frontend/node_modules/@react-oauth/google/dist/index.esm.js [app-client] (ecmascript)");
"use client";
;
;
;
;
;
function Providers({ children }) {
    const googleClientId = ("TURBOPACK compile-time value", "965582041822-i1evrpdkvba1uukeku1dnsov3ev2l4ao.apps.googleusercontent.com");
    const inner = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$WalletContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletProvider"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$src$2f$context$2f$AdsContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdsProvider"], {
                children: children
            }, void 0, false, {
                fileName: "[project]/Documents/GitHub/kynettic-frontend/src/app/providers.tsx",
                lineNumber: 13,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Documents/GitHub/kynettic-frontend/src/app/providers.tsx",
            lineNumber: 12,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/Documents/GitHub/kynettic-frontend/src/app/providers.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$GitHub$2f$kynettic$2d$frontend$2f$node_modules$2f40$react$2d$oauth$2f$google$2f$dist$2f$index$2e$esm$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GoogleOAuthProvider"], {
        clientId: googleClientId,
        children: inner
    }, void 0, false, {
        fileName: "[project]/Documents/GitHub/kynettic-frontend/src/app/providers.tsx",
        lineNumber: 21,
        columnNumber: 5
    }, this);
}
_c = Providers;
var _c;
__turbopack_context__.k.register(_c, "Providers");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=Documents_GitHub_kynettic-frontend_src_b2983078._.js.map