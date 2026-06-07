"use client";
import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from "react";
import { p2pService, CreateP2PAdRequest, UpdateP2PAdRequest } from "@/services/p2p.service";
import { useAuth } from "./AuthContext";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AdType = "Buy" | "Sell";
export type PriceType = "Fixed" | "Relative";

export interface Ad {
  id: string;
  type: AdType;
  asset: string;
  fiat: string;
  priceType: PriceType;
  price: string;
  relativePercent?: string;
  amount?: string;
  totalQuantity: string;
  remainingQuantity: string;
  minLimit: string;
  active: boolean;
  autoReply?: string;
  terms?: string;
  createdAt: number;
  paymentMethod?: string;
  rolloverEnabled?: boolean;
  currencyId: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  type: "crypto" | "fiat";
  symbol: string;
}

interface AdsContextType {
  ads: Ad[];
  currencies: Currency[];
  loading: boolean;
  p2pFeeMultiplier: number;
  makerFeePercent: string;
  takerFeePercent: string;
  refreshAds: () => Promise<void>;
  refreshCurrencies: () => Promise<void>;
  addAd: (data: CreateP2PAdRequest) => Promise<void>;
  updateAd: (id: string, updates: UpdateP2PAdRequest) => Promise<void>;
  deleteAd: (id: string) => Promise<void>;
  toggleAdStatus: (id: string, currentStatus: boolean) => Promise<void>;
}

const AdsContext = createContext<AdsContextType | undefined>(undefined);

export const AdsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [p2pFeeMultiplier, setP2pFeeMultiplier] = useState<number>(1.009); // default 0.90% taker
  const [makerFeePercent, setMakerFeePercent] = useState<string>("0.20");
  const [takerFeePercent, setTakerFeePercent] = useState<string>("0.90");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingAds = useRef(false);

  const mapApiAdToAd = (apiAd: any): Ad => {
    const isRollover = !!apiAd.rollover_enabled;
    const totalQty = parseFloat(apiAd.total_quantity || "0");
    const remainingQty = parseFloat(apiAd.remaining_quantity || "0") || totalQty;
    // For rollover ads total_quantity is 0 by design — don't cap, use remaining_quantity as-is.
    // For non-rollover: cap remaining at total to handle stale data (e.g. remaining=165 but total=100).
    const displayQuantity = isRollover ? remainingQty : (remainingQty > 0 && remainingQty <= totalQty ? remainingQty : totalQty);
    const displayPrice = apiAd.effective_price || apiAd.price;
    return {
      id: apiAd.id.toString(),
      type: apiAd.type === "buy" ? "Buy" : "Sell",
      asset: apiAd.currency || "USDT",
      fiat: "NGN",
      priceType: apiAd.price_type === "fixed" ? "Fixed" : "Relative",
      price: displayPrice?.toString() || "0",
      relativePercent: (apiAd.price_offset ?? apiAd.relative_percent)?.toString(),
      totalQuantity: totalQty.toString(),
      remainingQuantity: displayQuantity.toString(),
      minLimit: apiAd.min_amount?.toString() || "0",
      active: apiAd.status === "active",
      createdAt: new Date(apiAd.created_at).getTime(),
      rolloverEnabled: apiAd.rollover_enabled,
      currencyId: apiAd.currency_id,
    };
  };

  const fetchAds = async () => {
    if (isFetchingAds.current) return; // drop concurrent duplicate calls
    isFetchingAds.current = true;
    try {
      const data = await p2pService.getMyAds();
      if (data?.data) setAds(data.data.map(mapApiAdToAd));
    } catch { /* silently ignore */ }
    finally { isFetchingAds.current = false; }
  };

  const fetchCurrencies = async () => {
    try {
      const data = await p2pService.getCurrencies();
      if (data?.data) {
        setCurrencies(data.data.map((c: any) => ({
          id: c.id,
          code: c.symbol,
          name: c.name,
          symbol: c.symbol,
          type: ["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"].includes(c.symbol?.toUpperCase()) ? "fiat" : "crypto",
        })));
      }
    } catch { /* silently ignore */ }
  };

  const fetchFees = async () => {
    try {
      const data = await p2pService.getFees();
      const fees = data?.data;
      const makerRate = parseFloat(fees?.maker_fee_percent);
      const takerRate = parseFloat(fees?.taker_fee_percent);
      if (!isNaN(makerRate) && makerRate > 0) setMakerFeePercent(fees.maker_fee_percent);
      if (!isNaN(takerRate) && takerRate > 0) {
        setTakerFeePercent(fees.taker_fee_percent);
        setP2pFeeMultiplier(1 + takerRate / 100);
      }
    } catch { /* keep default */ }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      // Stagger fetches to avoid bursting concurrent requests alongside other contexts
      const run = async () => {
        await fetchFees();
        await fetchCurrencies();
        await fetchAds();
      };
      run().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Debounced refresh: multiple calls within 400 ms collapse into one
  const refreshAds = async () => {
    return new Promise<void>(resolve => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(async () => {
        setLoading(true);
        await fetchAds();
        setLoading(false);
        resolve();
      }, 400);
    });
  };

  const addAd = async (data: CreateP2PAdRequest) => { await p2pService.createAd(data); await refreshAds(); };
  const updateAd = async (id: string, updates: UpdateP2PAdRequest) => { await p2pService.updateAd(id, updates); await refreshAds(); };
  const deleteAd = async (id: string) => {
    setAds(prev => prev.filter(ad => ad.id !== id));
    try { await p2pService.deleteAd(id); } catch { /* restore on failure */ }
    await refreshAds();
  };
  const toggleAdStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = currentStatus ? "paused" : "active";
    await updateAd(id, { status: newStatus });
  };

  return (
    <AdsContext.Provider value={{ ads, currencies, loading, p2pFeeMultiplier, makerFeePercent, takerFeePercent, refreshAds, refreshCurrencies: fetchCurrencies, addAd, updateAd, deleteAd, toggleAdStatus }}>
      {children}
    </AdsContext.Provider>
  );
};

export const useAds = () => {
  const context = useContext(AdsContext);
  if (!context) throw new Error("useAds must be used within AdsProvider");
  return context;
};
