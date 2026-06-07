import api from "./api";

export const referralService = {
  getReferralProfile: async () => {
    const r = await api.get("/users/me/referral");
    return r.data;
  },
  getReferrals: async (page = 1, pageSize = 10) => {
    const r = await api.get("/users/me/referrals", { params: { page, page_size: pageSize } });
    return r.data;
  },
  getClaims: async (page = 1, pageSize = 20) => {
    const r = await api.get("/users/me/referral/claims", { params: { page, page_size: pageSize } });
    return r.data;
  },
  claim: async () => {
    const r = await api.post("/users/me/referral/claim", undefined, {
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    return r.data;
  },
  getLeaderboard: async (period: "alltime" | "month" | "week" = "alltime", limit = 50) => {
    const r = await api.get("/users/me/referral/leaderboard", { params: { period, limit } });
    return r.data;
  },
  // kept for backwards compat if used elsewhere
  getReferralPoints: async () => {
    const r = await api.get("/users/me/referral/points");
    return r.data;
  },
  getReferralLeaderboard: async () => referralService.getLeaderboard(),
  claimPoints: async () => referralService.claim(),
};
