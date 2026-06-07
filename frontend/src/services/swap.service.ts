import api from "./api";

export const swapService = {
  getRate: async (from_currency: string, to_currency: string, from_amount: string) => {
    const r = await api.post("/swap/rate", { from_currency, to_currency, from_amount });
    return r.data;
  },
  executeSwap: async (from_currency: string, to_currency: string, from_amount: string, pin: string, auth_code?: string) => {
    const body: Record<string, string> = { from_currency, to_currency, from_amount, pin };
    if (auth_code) body.auth_code = auth_code;
    const r = await api.post("/swap", body, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return r.data;
  },
  getHistory: async (page = 1, pageSize = 10) => {
    const r = await api.get("/swap", { params: { page, page_size: pageSize } });
    return r.data;
  },
};
