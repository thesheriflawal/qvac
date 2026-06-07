import api from "./api";
import { cacheGet, cacheSet, cacheDelete, cacheDeletePrefix } from "@/utils/cache";

const TTL = {
  currencies: 5 * 60_000,       // 5 min  — rarely changes
  fees: 5 * 60_000,              // 5 min
  communityLinks: 10 * 60_000,   // 10 min
  marketplaceAds: 30_000,        // 30 s   — live market data
  myAds: 20_000,                 // 20 s   — own ads
  adById: 2 * 60_000,            // 2 min
};

export interface P2POrderFilters { currency_id?: string; status?: string; page?: number; page_size?: number; }
export interface CreateP2PAdRequest {
  currency_id: string;
  type: "buy" | "sell";
  price_type: "fixed" | "relative";
  price?: string;
  min_amount: string;
  max_amount: string;
  total_quantity?: string;
  is_private?: boolean;
  rollover_enabled?: boolean;
  price_offset?: string;
  pin: string;
}
export interface UpdateP2PAdRequest {
  price?: string;
  price_type?: "fixed" | "relative";
  min_amount?: string;
  max_amount?: string;
  total_quantity?: string;
  is_private?: boolean;
  status?: "active" | "paused" | "closed";
  price_offset?: string;
  pin?: string;
}

export const p2pService = {
  getOrders: async (filters: P2POrderFilters = {}) => {
    const r = await api.get("/p2p/orders", { params: { currency_id: filters.currency_id, status: filters.status, page: filters.page || 1, page_size: filters.page_size || 50 } });
    return r.data;
  },

  getAdById: async (id: string) => {
    const key = `ad:${id}`;
    const cached = cacheGet<any>(key);
    if (cached) return cached;

    // Fallback 1: search user's own ads
    try {
      const mine = await api.get("/p2p/my-ads", { params: { page: 1, page_size: 100 } });
      const found = (mine.data?.data || []).find((a: any) => String(a.id) === String(id));
      if (found) { const result = { data: found }; cacheSet(key, result, TTL.adById); return result; }
    } catch { /* fall through */ }

    // Fallback 2: search marketplace (buy + sell sides)
    for (const type of ["buy", "sell"]) {
      try {
        const market = await api.get("/p2p/ads", { params: { type, mine_only: false, page: 1, page_size: 100 } });
        const found = (market.data?.data || []).find((a: any) => String(a.id) === String(id));
        if (found) { const result = { data: found }; cacheSet(key, result, TTL.adById); return result; }
      } catch { /* fall through */ }
    }

    throw new Error("Ad not found");
  },

  getMarketplaceAds: async (type: "buy" | "sell", currencyId?: string, page = 1) => {
    const key = `market:${type}:${currencyId || "all"}:${page}`;
    const cached = cacheGet<any>(key);
    if (cached) return cached;
    const r = await api.get("/p2p/ads", { params: { type, currency_id: currencyId, mine_only: false, page, page_size: 50 } });
    cacheSet(key, r.data, TTL.marketplaceAds);
    return r.data;
  },

  getMyAds: async (status?: string, page = 1) => {
    const key = `myads:${status || "all"}:${page}`;
    const cached = cacheGet<any>(key);
    if (cached) return cached;
    const r = await api.get("/p2p/my-ads", { params: { status, page, page_size: 50 } });
    cacheSet(key, r.data, TTL.myAds);
    return r.data;
  },

  getCurrencies: async () => {
    const cached = cacheGet<any>("currencies");
    if (cached) return cached;
    const r = await api.get("/currencies");
    cacheSet("currencies", r.data, TTL.currencies);
    return r.data;
  },

  getFees: async () => {
    const cached = cacheGet<any>("p2p:fees");
    if (cached) return cached;
    const r = await api.get("/p2p/fees");
    cacheSet("p2p:fees", r.data, TTL.fees);
    return r.data;
  },

  getCommunityLinks: async () => {
    const cached = cacheGet<any>("community-links");
    if (cached) return cached;
    const r = await api.get("/community-links");
    cacheSet("community-links", r.data, TTL.communityLinks);
    return r.data;
  },

  createAd: async (data: CreateP2PAdRequest) => {
    const r = await api.post("/p2p/ads", data);
    // Invalidate my-ads and marketplace cache after mutation
    cacheDeletePrefix("myads:");
    cacheDeletePrefix("market:");
    return r.data;
  },

  updateAd: async (id: string, data: UpdateP2PAdRequest) => {
    const r = await api.patch(`/p2p/ads/${id}`, data);
    cacheDelete(`ad:${id}`);
    cacheDeletePrefix("myads:");
    cacheDeletePrefix("market:");
    return r.data;
  },

  deleteAd: async (id: string) => {
    const r = await api.delete(`/p2p/ads/${id}`);
    cacheDelete(`ad:${id}`);
    cacheDeletePrefix("myads:");
    cacheDeletePrefix("market:");
    return r.data;
  },

  executeTrade: async (adId: string, amountInput: string, inputCurrency: "fiat" | "crypto", pin: string) => {
    const r = await api.post("/p2p/orders", { ad_id: adId, amount_input: amountInput, input_currency: inputCurrency, pin }, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    // Invalidate marketplace cache so quantity updates are visible
    cacheDeletePrefix("market:");
    return r.data;
  },
};
