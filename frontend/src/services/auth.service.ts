import api from "./api";

export const authService = {
  login: async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password, device_type: "web" });
    return r.data;
  },
  logout: async () => {
    const r = await api.post("/auth/logout");
    return r.data;
  },
  registerRequestOtp: async (email: string) => {
    const r = await api.post("/auth/register/request-otp", { email });
    return r.data;
  },
  registerVerifyOtp: async (email: string, otp: string) => {
    const r = await api.post("/auth/register/verify-otp", { email, otp });
    return r.data;
  },
  registerSetPassword: async (token: string, password: string, referralCode?: string) => {
    const payload: Record<string, string> = { 
      registration_token: token, 
      password 
    };
    if (referralCode) payload.referral_code = referralCode;
    const r = await api.post("/auth/register/set-password", payload);
    return r.data;
  },
  forgotPasswordRequestOtp: async (email: string) => {
    const r = await api.post("/auth/forgot-password/request-otp", { email });
    return r.data;
  },
  forgotPasswordVerifyOtp: async (email: string, otp: string) => {
    const r = await api.post("/auth/forgot-password/verify-otp", { email, otp });
    return r.data;
  },
  forgotPasswordReset: async (token: string, newPassword: string) => {
    const r = await api.post("/auth/forgot-password/reset", { reset_token: token, new_password: newPassword });
    return r.data;
  },
  refreshToken: async (refreshToken: string) => {
    const r = await api.post("/auth/refresh", { refresh_token: refreshToken });
    return r.data;
  },
  verify2FA: async (preAuthToken: string, code: string) => {
    const r = await api.post("/auth/2fa/verify", { pre_auth_token: preAuthToken, code });
    return r.data;
  },
  loginWithGoogle: async (idToken: string, referralCode?: string) => {
    const r = await api.post("/auth/google", {
      id_token: idToken,
      device_type: "web",
      ...(referralCode ? { referral_code: referralCode } : {}),
    });
    return r.data;
  },
  loginWithApple: async (idToken: string, nonce?: string) => {
    const r = await api.post("/auth/apple", { id_token: idToken, device_type: "web", nonce: nonce || crypto.randomUUID() });
    return r.data;
  },
};
