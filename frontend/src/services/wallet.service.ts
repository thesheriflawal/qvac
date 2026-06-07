import api from "./api";
import { cacheGet, cacheSet } from "@/utils/cache";

export const walletService = {
  getWallets: async () => {
    const r = await api.get("/users/me/wallets");
    return r.data;
  },
  getTransactions: async (currency?: string, page = 1, pageSize = 10, category?: string, startDate?: string, endDate?: string) => {
    const params: Record<string, unknown> = { page, page_size: pageSize };
    if (currency) params.currency = currency;
    if (category) params.category = category;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const r = await api.get("/users/me/wallet-transactions", { params });
    return r.data;
  },
  getTransaction: async (id: string) => {
    const r = await api.get(`/users/me/wallet-transactions/${id}`);
    return r.data;
  },
  getWalletAddress: async (chain: string, currency: string) => {
    const r = await api.get("/users/me/wallet-address", { params: { chain, currency } });
    return r.data;
  },
  getCurrencyNetworks: async (currencyId: string) => {
    const key = `networks:${currencyId}`;
    const cached = cacheGet<any>(key);
    if (cached) return cached;
    const r = await api.get(`/currencies/${currencyId}/networks`);
    cacheSet(key, r.data, 10 * 60_000);
    return r.data;
  },
  getCurrencies: async () => {
    const cached = cacheGet<any>("currencies");
    if (cached) return cached;
    const r = await api.get("/currencies");
    cacheSet("currencies", r.data, 5 * 60_000);
    return r.data;
  },
  getCurrencyPrice: async (currencyId: string) => {
    const r = await api.get(`/currencies/${currencyId}/price`);
    return r.data;
  },
  withdrawCrypto: async (chain: string, currency: string, address: string, amount: string, pin: string, auth_code: string) => {
    const r = await api.post("/users/me/crypto-withdrawals", { chain, currency, address, amount: amount.trim(), pin, auth_code }, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return r.data;
  },
  getDepositAccount: async () => {
    const r = await api.get("/users/me/deposit-account");
    return r.data;
  },
  getFiatBanks: async () => {
    const r = await api.get("/users/me/fiat-banks");
    return r.data;
  },
  lookupFiatBank: async (accountNumber: string, bankCode: string) => {
    const r = await api.post("/users/me/fiat-bank-lookup", { account_number: accountNumber, bank_code: bankCode });
    return r.data;
  },
  withdrawFiat: async (data: { account_name: string; account_number: string; amount: string; auth_code: string; bank_code: string; bank_name: string; pin: string; narration?: string }) => {
    const r = await api.post("/users/me/fiat-withdrawals", { ...data, narration: data.narration || "" }, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return r.data;
  },
  getCryptoWithdrawalFee: async (currency: string, chain: string) => {
    const r = await api.get("/withdrawal-fees/crypto", { params: { currency: currency.toLowerCase(), chain: chain.toLowerCase() } });
    return r.data;
  },
  getWithdrawalFees: async () => {
    const cached = cacheGet<any>("withdrawal-fees");
    if (cached) return cached;
    const r = await api.get("/withdrawal-fees");
    cacheSet("withdrawal-fees", r.data, 5 * 60_000);
    return r.data;
  },
  internalTransfer: async (data: { amount: string; auth_code: string; currency_id: string; pin: string; receiver_email?: string; receiver_uid?: string }) => {
    const r = await api.post("/users/me/internal-transfer", data, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return r.data;
  },
};
