import api from "./api";
export const userService = {
  getProfile: async () => { const r = await api.get("/users/me"); return r.data; },
  updateProfile: async (data: Record<string, any>) => { const r = await api.put("/users/me", data); return r.data; },
  setupPin: async (pin: string, confirmPin: string) => { const r = await api.post("/users/me/pin/setup", { pin, confirm_pin: confirmPin }); return r.data; },
  changePassword: async (oldPassword: string, newPassword: string) => { const r = await api.post("/users/me/change-password", { old_password: oldPassword, new_password: newPassword }); return r.data; },
};
