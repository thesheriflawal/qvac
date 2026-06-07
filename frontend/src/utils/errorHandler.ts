const MSG_MAP: Record<string,string> = {"invalid credentials":"Incorrect email or password.","invalid otp":"Incorrect OTP. Please try again.","otp expired":"OTP expired. Request a new one.","insufficient balance":"Insufficient balance.","email already exists":"Account already exists. Please sign in.","too many attempts":"Too many attempts. Please wait.","pin already set":"PIN already set. Use Change PIN.","invalid pin":"Incorrect PIN."};
const STATUS_MAP: Record<number,string> = {400:"Invalid request.",401:"Session expired. Please log in.",403:"Permission denied.",404:"Not found.",422:"Check your input.",429:"Too many requests. Please wait a moment.",500:"Server error. This swap pair may not be supported yet — please try again or contact support."};
export const getErrorMessage = (error: unknown, fallback?: string): string => {
  const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
  if (!err?.response) { if (err?.message?.toLowerCase().includes("network")) return "No internet connection."; return fallback || "Connection failed."; }
  const msg = (err.response.data?.message || err.response.data?.error || "").toLowerCase().trim();
  if (msg) { if (MSG_MAP[msg]) return MSG_MAP[msg]; for (const [k,v] of Object.entries(MSG_MAP)) { if (msg.includes(k)) return v; } if (msg.length < 200) return err.response.data?.message || msg; }
  if (err.response.status && STATUS_MAP[err.response.status]) return STATUS_MAP[err.response.status];
  return fallback || "Something went wrong.";
};
