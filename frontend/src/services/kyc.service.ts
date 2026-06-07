import api from "./api";

export interface KYCStatusResponse {
  tier: number;
  next_tier: number;
  status: string;
  bvn_verified: boolean;
  nin_verified: boolean;
  selfie_verified: boolean;
  address_verified: boolean;
  rejection_reason: string;
  tier1_identity_type: "bvn" | "nin" | "";
}

export interface SubmitTier1Request {
  first_name: string;
  last_name: string;
  other_name?: string;
  middle_name?: string;
  username: string;
  phone_number: string;
  date_of_birth: string;
  display_username_on_p2p?: boolean;
  identity_type: "bvn" | "nin";
  bvn?: string;
  nin?: string;
}

export interface SubmitTier2Request {
  bvn?: string;
  nin?: string;
}

export const kycService = {
  getKYCStatus: async () => {
    const r = await api.get("/users/me/kyc/status");
    return r.data;
  },
  submitTier1: async (data: SubmitTier1Request) => {
    const r = await api.post("/users/me/kyc/tier1", data);
    return r.data;
  },
  submitTier2: async (data: SubmitTier2Request) => {
    const r = await api.post("/users/me/kyc/tier2", data);
    return r.data;
  },
  submitTier3: async (data: FormData) => {
    const r = await api.post("/users/me/kyc/tier3", data);
    return r.data;
  },
};
