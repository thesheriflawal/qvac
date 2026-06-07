"use client";
import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { useOTPTimer } from "@/hooks/useOTPTimer";

function ForgotPasswordOTPContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    timeLeft,
    canResend,
    isLimitReached,
    startTimer,
    formatTime,
  } = useOTPTimer();

  const handleChange = (val: string, i: number) => {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      digits.forEach((d, idx) => { next[idx] = d; });
      setOtp(next);
      inputs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const next = [...otp];
    next[i] = val.replace(/\D/g, "");
    setOtp(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = ["", "", "", "", "", ""];
    digits.forEach((d, idx) => { next[idx] = d; });
    setOtp(next);
    inputs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length !== 6) { setError("Please enter a valid 6-digit OTP"); return; }
    if (!email) { setError("Email not found. Please restart reset process."); return; }
    setLoading(true);
    try {
      const res = await authService.forgotPasswordVerifyOtp(email, code);
      const token = res?.data?.reset_token || res?.data?.token || Object.values(res?.data || {})[0];
      if (!token) throw new Error("Reset token not received. Please request a new OTP.");
      router.push(`/forgot-password/reset?token=${encodeURIComponent(token as string)}`);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError("");
    try {
      await authService.forgotPasswordRequestOtp(email);
      startTimer();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F5F5] flex flex-col px-4 pt-4 pb-8">
      <button onClick={() => router.push("/forgot-password")} className="flex items-center gap-1 text-gray-700 mb-6 cursor-pointer self-start p-2">
        <ArrowLeft size={22} />
      </button>
      <div className="flex-1 flex flex-col items-center px-2 pt-8">
        <h1 className="text-xl font-bold text-center text-[#1D3B53] mb-2">Verify your email address</h1>
        <p className="text-sm text-gray-500 text-center mb-8">Enter OTP Sent to <strong>{email || "your mail"}</strong></p>

        <form onSubmit={handleVerify} className="w-full max-w-sm">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">{error}</div>}

          <div className="flex gap-2 justify-between mb-8">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                value={digit}
                onChange={e => handleChange(e.target.value, i)}
                onKeyDown={e => handleKeyDown(e, i)}
                onPaste={handlePaste}
                className="w-11 h-14 border border-primary rounded-lg text-center text-xl font-bold bg-white text-[#1D3B53] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-lg text-base disabled:opacity-60 mb-6"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Didn&apos;t receive the code?{" "}
            {isLimitReached ? (
              <span className="text-red-500 font-medium whitespace-nowrap">Resend limit reached</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className={`font-bold transition-colors ${
                  canResend ? "text-primary cursor-pointer hover:underline" : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {timeLeft > 0 ? `Resend in ${formatTime}` : "Resend"}
              </button>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

export default function ForgotPasswordOTPPage() {
  return <Suspense><ForgotPasswordOTPContent /></Suspense>;
}
