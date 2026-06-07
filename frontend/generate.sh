#!/bin/bash
set -euo pipefail
cd /Users/home/Desktop/kynettic-web

#=============================================================================
# next.config.ts - CORS proxy for API
#=============================================================================
cat > next.config.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: "https://kynettic-backend.onrender.com/api/v1/:path*" },
    ];
  },
};
export default nextConfig;
NEXTCONFIG

#=============================================================================
# globals.css - Theme with landing-scope override
#=============================================================================
cat > src/app/globals.css << 'GLOBALCSS'
@import "tailwindcss";
@theme {
  --color-primary: #4472B7;
  --color-primary-dark: #2d5a9e;
  --color-secondary: #FBAD45;
  --font-outfit: var(--font-outfit);
}
:root { --background: #ffffff; --foreground: #000000; }
body { font-family: var(--font-outfit), sans-serif; }
.landing-scope { --color-primary: #FBAD45; --color-secondary: #4472B7; background: rgba(68,114,183,0.13); }
GLOBALCSS

#=============================================================================
# SERVICES
#=============================================================================
cat > src/services/api.ts << 'EOF'
import axios from "axios";
const api = axios.create({ baseURL: "/api/v1", headers: { "Content-Type": "application/json" } });
api.interceptors.request.use(async (config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
export default api;
EOF

cat > src/services/auth.service.ts << 'EOF'
import api from "./api";
export const authService = {
  login: async (email: string, password: string) => { const r = await api.post("/auth/login", { email, password }); return r.data; },
  registerRequestOtp: async (email: string) => { const r = await api.post("/auth/register/request-otp", { email }); return r.data; },
  registerVerifyOtp: async (email: string, otp: string) => { const r = await api.post("/auth/register/verify-otp", { email, otp }); return r.data; },
  registerSetPassword: async (token: string, password: string, referralCode?: string) => { const payload: Record<string,string> = { registration_token: token, password }; if (referralCode) payload.referral_code = referralCode; const r = await api.post("/auth/register/set-password", payload); return r.data; },
  forgotPasswordRequestOtp: async (email: string) => { const r = await api.post("/auth/forgot-password/request-otp", { email }); return r.data; },
  forgotPasswordVerifyOtp: async (email: string, otp: string) => { const r = await api.post("/auth/forgot-password/verify-otp", { email, otp }); return r.data; },
  forgotPasswordReset: async (token: string, newPassword: string) => { const r = await api.post("/auth/forgot-password/reset", { reset_token: token, new_password: newPassword }); return r.data; },
  refreshToken: async (refreshToken: string) => { const r = await api.post("/auth/refresh", { refresh_token: refreshToken }); return r.data; },
};
EOF

cat > src/services/wallet.service.ts << 'EOF'
import api from "./api";
export const walletService = {
  getWallets: async () => { const r = await api.get("/users/me/wallets"); return r.data; },
  getTransactions: async (currency?: string, page = 1, pageSize = 10) => { const r = await api.get("/users/me/wallet-transactions", { params: { currency, page, page_size: pageSize } }); return r.data; },
  getWalletAddress: async (chain: string, currency: string, network = "testnet") => { const r = await api.get("/users/me/wallet-address", { params: { chain, currency, network } }); return r.data; },
  getCurrencies: async () => { const r = await api.get("/currencies"); return r.data; },
  withdrawCrypto: async (chain: string, currency: string, address: string, amount: string, pin: string, auth_code: string) => { const r = await api.post("/users/me/crypto-withdrawals", { chain, currency, address, amount, pin, auth_code }); return r.data; },
  getDepositAccount: async () => { const r = await api.get("/users/me/deposit-account"); return r.data; },
  getFiatBanks: async () => { const r = await api.get("/users/me/fiat-banks"); return r.data; },
  lookupFiatBank: async (accountNumber: string, bankCode: string) => { const r = await api.post("/users/me/fiat-bank-lookup", { account_number: accountNumber, bank_code: bankCode }); return r.data; },
  withdrawFiat: async (data: { account_name: string; account_number: string; amount: string; auth_code: string; bank_code: string; bank_name: string; pin: string; narration?: string }) => { const r = await api.post("/users/me/fiat-withdrawals", data); return r.data; },
};
EOF

cat > src/services/p2p.service.ts << 'EOF'
import api from "./api";
export interface P2POrderFilters { currency_id?: number; status?: string; page?: number; page_size?: number; }
export interface CreateP2PAdRequest { currency_id: number; type: "buy" | "sell"; price_type: "fixed" | "relative"; price: string; min_amount: string; max_amount: string; total_quantity?: string; is_private?: boolean; rollover_enabled?: boolean; relative_percent?: string; }
export interface UpdateP2PAdRequest { price?: string; price_type?: "fixed" | "relative"; min_amount?: string; max_amount?: string; is_private?: boolean; is_active?: boolean; rollover_enabled?: boolean; relative_percent?: string; }
export const p2pService = {
  getOrders: async (filters: P2POrderFilters = {}) => { const r = await api.get("/p2p/orders", { params: { currency_id: filters.currency_id, status: filters.status, page: filters.page || 1, page_size: filters.page_size || 50 } }); return r.data; },
  getMarketplaceAds: async (type: "buy" | "sell", currencyId?: number, page = 1) => { const r = await api.get("/p2p/ads", { params: { type, currency_id: currencyId, mine_only: false, page, page_size: 50 } }); return r.data; },
  getMyAds: async (status?: string, page = 1) => { const r = await api.get("/p2p/my-ads", { params: { status, page, page_size: 50 } }); return r.data; },
  getCurrencies: async () => { const r = await api.get("/currencies"); return r.data; },
  createAd: async (data: CreateP2PAdRequest) => { const r = await api.post("/p2p/ads", data); return r.data; },
  updateAd: async (id: number, data: UpdateP2PAdRequest) => { const r = await api.patch(`/p2p/ads/${id}`, data); return r.data; },
  deleteAd: async (id: number) => { const r = await api.delete(`/p2p/ads/${id}`); return r.data; },
  executeTrade: async (adId: number, amount: number, pin: string) => { const r = await api.post("/p2p/orders", { ad_id: adId, amount: amount.toString(), pin }); return r.data; },
};
EOF

cat > src/services/user.service.ts << 'EOF'
import api from "./api";
export const userService = {
  getProfile: async () => { const r = await api.get("/users/me"); return r.data; },
  updateProfile: async (data: { first_name?: string; last_name?: string; email?: string; phone_number?: string; username?: string; gender?: string; dob?: string }) => { const r = await api.put("/users/me", data); return r.data; },
  setupPin: async (pin: string, confirmPin: string) => { const r = await api.post("/users/me/pin/setup", { pin, confirm_pin: confirmPin }); return r.data; },
  changePassword: async (oldPassword: string, newPassword: string) => { const r = await api.post("/users/me/change-password", { old_password: oldPassword, new_password: newPassword }); return r.data; },
};
EOF

cat > src/services/kyc.service.ts << 'EOF'
export interface KYCStatus { tier1: { status: string; data?: unknown }; tier2: { status: string; data?: unknown }; tier3: { status: string; data?: unknown }; }
let mockKYCState: KYCStatus = { tier1: { status: "not_started" }, tier2: { status: "not_started" }, tier3: { status: "not_started" } };
export const kycService = {
  getKYCStatus: async (): Promise<KYCStatus> => new Promise((r) => setTimeout(() => r(mockKYCState), 500)),
  submitTier1Data: async (data: { firstName: string; lastName: string; dob: string; phone: string; bvn: string }) => new Promise((r) => { setTimeout(() => { mockKYCState.tier1 = { status: "approved", data }; r({ success: true }); }, 1000); }),
  submitTier2Data: async (data: { nin: string }) => new Promise((r) => { setTimeout(() => { mockKYCState.tier2 = { status: "pending", data }; r({ success: true }); }, 1000); }),
  uploadIdentityDocument: async (data: FormData) => new Promise((r) => { setTimeout(() => { mockKYCState.tier3 = { status: "pending", data }; r({ success: true }); }, 1000); }),
  uploadAddressDocument: async (data: FormData) => new Promise((r) => { setTimeout(() => { void data; r({ success: true }); }, 1000); }),
};
EOF

cat > src/services/notification.service.ts << 'EOF'
import api from "./api";
export interface NotificationResponse { id: number; title: string; message: string; is_read: boolean; created_at: string; read_at?: string; }
export const notificationService = {
  getNotifications: async (page = 1, status: "all" | "unread" = "all") => { const r = await api.get("/users/me/notifications", { params: { page, status } }); return r.data as { data: NotificationResponse[]; meta?: unknown }; },
  markAsRead: async (id: number) => { const r = await api.patch(`/users/me/notifications/${id}/read`); return r.data; },
  markAllAsRead: async () => { const r = await api.patch("/users/me/notifications/read-all"); return r.data; },
};
EOF

cat > src/services/referral.service.ts << 'EOF'
import api from "./api";
export const referralService = {
  getReferrals: async () => { const r = await api.get("/users/me/referrals"); return r.data; },
  getReferralStats: async () => { const r = await api.get("/users/me/referral-stats"); return r.data; },
  claimPoints: async () => { const r = await api.post("/users/me/referrals/claim"); return r.data; },
};
EOF

cat > src/services/security.service.ts << 'EOF'
import api from "./api";
export const securityService = {
  setup2FA: async () => { const r = await api.post("/users/me/2fa/setup"); return r.data; },
  enable2FA: async (code: string) => { const r = await api.post("/users/me/2fa/enable", { code }); return r.data; },
  setupPin: async (pin: string, confirm_pin: string) => { const r = await api.post("/users/me/pin/setup", { pin, confirm_pin }); return r.data; },
  changePin: async (old_pin: string, new_pin: string, confirm_pin: string) => { const r = await api.post("/users/me/pin/change", { old_pin, new_pin, confirm_pin }); return r.data; },
  changePassword: async (old_password: string, new_password: string) => { const r = await api.post("/users/me/change-password", { old_password, new_password }); return r.data; },
};
EOF

cat > src/utils/errorHandler.ts << 'EOF'
const MSG_MAP: Record<string,string> = {"invalid credentials":"Incorrect email or password.","invalid otp":"Incorrect OTP. Please try again.","otp expired":"OTP expired. Request a new one.","insufficient balance":"Insufficient balance.","email already exists":"Account already exists. Please sign in.","too many attempts":"Too many attempts. Please wait.","pin already set":"PIN already set. Use Change PIN.","invalid pin":"Incorrect PIN."};
const STATUS_MAP: Record<number,string> = {400:"Invalid request.",401:"Session expired. Please log in.",403:"Permission denied.",404:"Not found.",422:"Check your input.",429:"Too many requests.",500:"Server error. Try again."};
export const getErrorMessage = (error: unknown, fallback?: string): string => {
  const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
  if (!err?.response) { if (err?.message?.toLowerCase().includes("network")) return "No internet connection."; return fallback || "Connection failed."; }
  const msg = (err.response.data?.message || err.response.data?.error || "").toLowerCase().trim();
  if (msg) { if (MSG_MAP[msg]) return MSG_MAP[msg]; for (const [k,v] of Object.entries(MSG_MAP)) { if (msg.includes(k)) return v; } if (msg.length < 200) return err.response.data?.message || msg; }
  if (err.response.status && STATUS_MAP[err.response.status]) return STATUS_MAP[err.response.status];
  return fallback || "Something went wrong.";
};
EOF

echo "Services + utils done"

#=============================================================================
# CONTEXTS
#=============================================================================
cat > src/context/AuthContext.tsx << 'EOF'
"use client";
import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { authService } from "@/services/auth.service";

interface AuthContextType { user: unknown | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; updateUser: (userData: unknown) => Promise<void>; isAuthenticated: boolean; }
const AuthContext = createContext<AuthContextType>({ user: null, loading: true, login: async () => {}, logout: async () => {}, updateUser: async () => {}, isAuthenticated: false });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => { const t = localStorage.getItem("accessToken"); const u = localStorage.getItem("user"); if (t && u) { try { setUser(JSON.parse(u)); setIsAuthenticated(true); } catch {} } setLoading(false); }, []);
  const login = async (email: string, password: string) => { const response = await authService.login(email, password); const { access_token, refresh_token, user: userData } = response.data; localStorage.setItem("accessToken", access_token); localStorage.setItem("refreshToken", refresh_token); localStorage.setItem("user", JSON.stringify(userData)); setUser(userData); setIsAuthenticated(true); };
  const logout = async () => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); localStorage.removeItem("user"); setUser(null); setIsAuthenticated(false); };
  const updateUser = async (userData: unknown) => { localStorage.setItem("user", JSON.stringify(userData)); setUser(userData); };
  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isAuthenticated }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
EOF

cat > src/context/WalletContext.tsx << 'EOF'
"use client";
import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { walletService } from "@/services/wallet.service";
import { useAuth } from "./AuthContext";

interface Wallet { id: number; user_id: number; currency: string; currency_id: number; balance: number; locked_balance: number; created_at: string; updated_at: string; }
interface WalletContextData { wallets: Wallet[]; loading: boolean; error: string | null; fetchWallets: () => Promise<void>; getWalletByCurrency: (currency: string) => Wallet | undefined; }
const WalletContext = createContext<WalletContextData>({} as WalletContextData);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const fetchWallets = async () => { if (!isAuthenticated) return; setLoading(true); setError(null); try { const r = await walletService.getWallets(); setWallets(r.data || []); } catch (err: unknown) { const e = err as { response?: { data?: { message?: string } } }; setError(e.response?.data?.message || "Failed to fetch wallets"); } finally { setLoading(false); } };
  const getWalletByCurrency = (currency: string) => wallets.find((w) => w.currency === currency);
  useEffect(() => { if (isAuthenticated) fetchWallets(); else setWallets([]); }, [isAuthenticated]);
  return <WalletContext.Provider value={{ wallets, loading, error, fetchWallets, getWalletByCurrency }}>{children}</WalletContext.Provider>;
};
export const useWallet = () => useContext(WalletContext);
EOF

cat > src/context/AdsContext.tsx << 'EOF'
"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { p2pService, CreateP2PAdRequest, UpdateP2PAdRequest } from "@/services/p2p.service";

export type AdType = "Buy" | "Sell";
export type PriceType = "Fixed" | "Relative";
export interface Ad { id: string; type: AdType; asset: string; fiat: string; priceType: PriceType; price: string; amount?: string; totalQuantity: string; minLimit: string; maxLimit: string; active: boolean; autoReply?: string; terms?: string; createdAt: number; paymentMethod?: string; rolloverEnabled?: boolean; currencyId: number; }
export interface Currency { id: number; code: string; name: string; type: "crypto" | "fiat"; symbol: string; }
interface AdsContextType { ads: Ad[]; currencies: Currency[]; loading: boolean; refreshAds: () => Promise<void>; addAd: (data: CreateP2PAdRequest) => Promise<void>; updateAd: (id: string, updates: UpdateP2PAdRequest) => Promise<void>; deleteAd: (id: string) => Promise<void>; toggleAdStatus: (id: string, currentStatus: boolean) => Promise<void>; }
const AdsContext = createContext<AdsContextType | undefined>(undefined);

export const AdsProvider = ({ children }: { children: ReactNode }) => {
  const [ads, setAds] = useState<Ad[]>([]); const [currencies, setCurrencies] = useState<Currency[]>([]); const [loading, setLoading] = useState<boolean>(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapAd = (a: any): Ad => ({ id: a.id.toString(), type: a.side === "buy" ? "Buy" : "Sell", asset: a.currency?.code || "USDT", fiat: "NGN", priceType: a.price_type === "fixed" ? "Fixed" : "Relative", price: a.price, totalQuantity: a.total_quantity || a.amount || "0", minLimit: a.min_amount, maxLimit: a.max_amount, active: !a.is_paused && !a.is_closed, createdAt: new Date(a.created_at).getTime(), rolloverEnabled: a.rollover_enabled, currencyId: a.currency_id });
  const fetchAds = async () => { try { const d = await p2pService.getMyAds(); if (d?.data) setAds(d.data.map(mapAd)); } catch (e) { console.error(e); } };
  const fetchCurrencies = async () => { try { const d = await p2pService.getCurrencies(); if (d?.data) setCurrencies(d.data); } catch (e) { console.error(e); } };
  useEffect(() => { fetchCurrencies(); setLoading(false); }, []);
  const refreshAds = async () => { setLoading(true); await fetchAds(); setLoading(false); };
  const addAd = async (data: CreateP2PAdRequest) => { await p2pService.createAd(data); await fetchAds(); };
  const updateAd = async (id: string, updates: UpdateP2PAdRequest) => { await p2pService.updateAd(parseInt(id), updates); await fetchAds(); };
  const deleteAd = async (id: string) => { await p2pService.deleteAd(parseInt(id)); await fetchAds(); };
  const toggleAdStatus = async (id: string, currentStatus: boolean) => { await updateAd(id, { is_active: !currentStatus }); };
  return <AdsContext.Provider value={{ ads, currencies, loading, refreshAds, addAd, updateAd, deleteAd, toggleAdStatus }}>{children}</AdsContext.Provider>;
};
export const useAds = () => { const c = useContext(AdsContext); if (!c) throw new Error("useAds must be used within AdsProvider"); return c; };
EOF

cat > src/hooks/useVerificationGate.ts << 'EOF'
"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export const useVerificationGate = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [showGate, setShowGate] = useState(false);
  const kycStatus = (user as Record<string, unknown>)?.kyc_status as string | undefined;
  const isVerified = kycStatus === "verified" || kycStatus === "approved";
  const requireVerification = useCallback((onPass?: () => void): boolean => { if (isVerified) { onPass?.(); return true; } setShowGate(true); return false; }, [isVerified]);
  const handleVerifyNow = useCallback(() => { setShowGate(false); router.push("/verification-dashboard"); }, [router]);
  return { isVerified, showGate, setShowGate, requireVerification, handleVerifyNow };
};
EOF

echo "Contexts + hooks done"
