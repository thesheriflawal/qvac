"use client";
import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { walletService } from "@/services/wallet.service";
import { useAuth } from "./AuthContext";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Wallet {
  id: string | number;
  user_id: string | number;
  currency: string;
  currency_id: string | number;
  balance: string | number;
  locked_balance: string | number;
  created_at: string;
  updated_at: string;
  is_virtual?: boolean;
}

interface WalletContextData {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  fetchWallets: () => Promise<void>;
  getWalletByCurrency: (currency: string) => Wallet | undefined;
  internalTransfer: (data: { amount: string; auth_code: string; currency_id: string; pin: string; receiver_email?: string; receiver_uid?: string }) => Promise<any>;
}

const WalletContext = createContext<WalletContextData>({} as WalletContextData);

let _cachedCurrencies: any[] | null = null;

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch currencies (cached) and wallets in parallel
      const [currenciesRes, walletsRes] = await Promise.allSettled([
        _cachedCurrencies ? Promise.resolve({ data: _cachedCurrencies }) : walletService.getCurrencies(),
        walletService.getWallets(),
      ]);

      let supportedCurrencies: any[] = _cachedCurrencies || [];
      if (currenciesRes.status === "fulfilled") {
        supportedCurrencies = currenciesRes.value?.data || [];
        _cachedCurrencies = supportedCurrencies;
      }

      let userWallets: any[] = [];
      if (walletsRes.status === "fulfilled") {
        userWallets = walletsRes.value?.data || [];
      } else {
        if (wallets.length > 0) { setLoading(false); return; }
      }

      if (userWallets.length > 0) {
        const matchedCurrencies = new Set<string>();
        const fromCurrencies = supportedCurrencies.length > 0
          ? supportedCurrencies.map((currency: any) => {
              const sym = (currency.symbol || "").toUpperCase();
              const existing = userWallets.find((w: any) => (w.currency || "").toUpperCase() === sym);
              if (existing) {
                matchedCurrencies.add((existing.currency || "").toUpperCase());
                return { ...existing, currency: (existing.currency || "").toUpperCase() };
              }
              return { id: -1, user_id: user?.id || 0, currency: sym, currency_id: currency.id, balance: 0, locked_balance: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_virtual: true };
            })
          : [];

        const unmatchedWallets = userWallets
          .filter((w: any) => !matchedCurrencies.has((w.currency || "").toUpperCase()))
          .map((w: any) => ({ ...w, currency: (w.currency || "").toUpperCase() }));

        setWallets(fromCurrencies.length > 0 ? [...fromCurrencies, ...unmatchedWallets] : userWallets.map((w: any) => ({ ...w, currency: (w.currency || "").toUpperCase() })));
      } else if (supportedCurrencies.length > 0) {
        setWallets(supportedCurrencies.map((currency: any) => ({
          id: -1, user_id: user?.id || 0, currency: (currency.symbol || "").toUpperCase(), currency_id: currency.id, balance: 0, locked_balance: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_virtual: true,
        })));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch wallets");
    } finally {
      setLoading(false);
    }
  };

  const getWalletByCurrency = (currency: string) =>
    wallets.find((w) => (w.currency || "").toUpperCase() === (currency || "").toUpperCase());

  const internalTransfer = async (data: { amount: string; auth_code: string; currency_id: string; pin: string; receiver_email?: string; receiver_uid?: string }) => {
    const response = await walletService.internalTransfer(data);
    await fetchWallets();
    return response;
  };

  useEffect(() => {
    if (!isAuthenticated) { setWallets([]); return; }
    fetchWallets();
    const interval = setInterval(fetchWallets, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <WalletContext.Provider value={{ wallets, loading, error, fetchWallets, getWalletByCurrency, internalTransfer }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
