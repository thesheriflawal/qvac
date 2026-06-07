import api from "./api";

export interface Setup2FAResponse {
  enabled: boolean;
  otpauth_url: string;
  secret: string;
}

export const securityService = {
  setup2FA: async (): Promise<Setup2FAResponse> => {
    const r = await api.post("/users/me/2fa/setup");
    return r.data.data;
  },
  enable2FA: async (code: string) => {
    const r = await api.post("/users/me/2fa/enable", { code });
    return r.data.data;
  },
  disable2FA: async (code: string, pin: string) => {
    const r = await api.post("/users/me/2fa/disable", { code, pin });
    return r.data;
  },
  setupPin: async (pin: string, confirm_pin: string) => {
    const r = await api.post("/users/me/pin/setup", { pin, confirm_pin });
    return r.data;
  },
  changePin: async (old_pin: string, new_pin: string, confirm_new_pin: string) => {
    const r = await api.post("/users/me/pin/change", { old_pin, new_pin, confirm_new_pin });
    return r.data;
  },
  changePassword: async (old_password: string, new_password: string) => {
    const r = await api.post("/users/me/change-password", { old_password, new_password });
    return r.data;
  },
};
