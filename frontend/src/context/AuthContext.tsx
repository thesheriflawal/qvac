"use client";
import React, { createContext, useState, useEffect, useContext, useRef, useCallback, ReactNode } from "react";
import axios from "axios";
import { authService } from "@/services/auth.service";
import { authEvents } from "@/services/api";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AuthContextType {
  user: any | null;
  loading: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<any>;
  loginWithGoogle: (idToken: string, referralCode?: string) => Promise<any>;
  loginWithApple: (idToken: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (userData: any) => Promise<void>;
  isAuthenticated: boolean;
  setAuthData: (access_token: string, refresh_token: string, userData: any) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  isInitializing: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  loginWithApple: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  isAuthenticated: false,
  setAuthData: () => {},
});

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch { return null; }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const lastActivity = useRef<number>(Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthenticatedRef = useRef(false);

  // Keep ref in sync so callbacks don't capture stale state
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);

  const doLogout = useCallback(async () => {
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
    try { await authService.logout(); } catch { /* network error — still clear */ }
    finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const scheduleProactiveRefresh = useCallback((accessToken: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const exp = getTokenExpiry(accessToken);
    if (!exp) return;
    // Refresh 60s before expiry (minimum 5s delay to avoid loops)
    const delay = Math.max(5000, exp - Date.now() - 60_000);
    refreshTimer.current = setTimeout(async () => {
      if (!isAuthenticatedRef.current) return;
      const storedRefresh = localStorage.getItem("refreshToken");
      if (!storedRefresh) return;
      try {
        const res = await axios.post("/api/v1/auth/refresh", { refresh_token: storedRefresh }, { timeout: 15000 });
        const newAccess = res.data?.data?.access_token || res.data?.access_token;
        const newRefresh = res.data?.data?.refresh_token || res.data?.refresh_token;
        if (!newAccess) return;
        localStorage.setItem("accessToken", newAccess);
        if (newRefresh) localStorage.setItem("refreshToken", newRefresh);
        scheduleProactiveRefresh(newAccess);
      } catch {
        // Silent — reactive refresh on next 401 will handle it
      }
    }, delay);
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem("accessToken");
      const userData = localStorage.getItem("user");
      if (token && userData) {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        scheduleProactiveRefresh(token);
      }
    } catch {
      // Corrupted storage — start fresh
    } finally {
      setIsInitializing(false);
    }

    // Listen for forced logout from API interceptor
    authEvents.onUnauthorized = () => { doLogout(); };
    return () => { authEvents.onUnauthorized = null; };
  }, [doLogout, scheduleProactiveRefresh]);

  // 30-minute inactivity logout
  useEffect(() => {
    if (!isAuthenticated) return;

    const resetActivity = () => { lastActivity.current = Date.now(); };
    const activityEvents = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"] as const;
    activityEvents.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    inactivityTimer.current = setInterval(() => {
      if (Date.now() - lastActivity.current > INACTIVITY_TIMEOUT) {
        doLogout();
      }
    }, 60_000); // check every minute

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, resetActivity));
      if (inactivityTimer.current) clearInterval(inactivityTimer.current);
    };
  }, [isAuthenticated, doLogout]);

  const setAuthData = useCallback((access_token: string, refresh_token: string, userData: any) => {
    localStorage.setItem("accessToken", access_token);
    localStorage.setItem("refreshToken", refresh_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    scheduleProactiveRefresh(access_token);
  }, [scheduleProactiveRefresh]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      // 202: 2FA required
      const preAuthToken = response?.pre_auth_token || response?.data?.pre_auth_token;
      if (preAuthToken) {
        throw { requires2FA: true, email, pre_auth_token: preAuthToken };
      }
      // 200: normal login
      const loginData = response?.data;
      if (!loginData?.access_token || !loginData?.refresh_token) {
        throw new Error("Invalid login response from server.");
      }
      setAuthData(loginData.access_token, loginData.refresh_token, loginData.user);
      return response;
    } catch (error: any) {
      if (error?.requires2FA) throw error;
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string, referralCode?: string) => {
    setLoading(true);
    try {
      const response = await authService.loginWithGoogle(idToken, referralCode);
      const loginData = response?.data;
      if (!loginData?.access_token || !loginData?.refresh_token) {
        throw new Error("Invalid login response from server.");
      }
      setAuthData(loginData.access_token, loginData.refresh_token, loginData.user);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const loginWithApple = async (idToken: string) => {
    setLoading(true);
    try {
      const response = await authService.loginWithApple(idToken);
      const loginData = response?.data;
      if (!loginData?.access_token || !loginData?.refresh_token) {
        throw new Error("Invalid login response from server.");
      }
      setAuthData(loginData.access_token, loginData.refresh_token, loginData.user);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const logout = doLogout;

  const updateUser = async (userData: any) => {
    const fullUser = { ...user, ...userData };
    localStorage.setItem("user", JSON.stringify(fullUser));
    setUser(fullUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isInitializing, login, loginWithGoogle, loginWithApple, logout, updateUser, isAuthenticated, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
