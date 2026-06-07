"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";

const CHECKS = [
  { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character (!@#$%^&*)", test: (p: string) => /[!@#$%^&*]/.test(p) },
];

function SignupPasswordPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const refFromUrl = params.get("ref") || "";
  const { setAuthData } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [referralFromLink] = useState(!!refFromUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allPass = CHECKS.every(c => c.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!allPass) { setError("Password does not meet all requirements"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const response = await authService.registerSetPassword(token, password, referralCode || undefined);
      const data = response?.data;
      if (data?.access_token) {
        setAuthData(data.access_token, data.refresh_token, data.user);
      }
      router.replace("/signup/success");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/iconletter.png" alt="Kynettic" width={180} height={48} className="mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2 text-center text-[#1D3B53]">Set your password</h1>
      <p className="text-gray-500 mb-4 text-center text-sm">Create a strong password for your account</p>

      {/* Progress bar — all filled */}
      <div className="flex gap-1 w-24 mb-8">
        <div className="flex-[10] h-1 bg-primary rounded" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#1D3B53]">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 12 characters"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary bg-white pr-12"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Password strength checklist */}
        {password.length > 0 && (
          <div className="bg-white rounded-xl px-4 py-3 space-y-1.5 border border-gray-100">
            {CHECKS.map(c => {
              const ok = c.test(password);
              return (
                <div key={c.label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${ok ? "bg-green-500" : "bg-gray-200"}`}>
                    {ok ? <Check size={10} className="text-white" strokeWidth={3} /> : <X size={10} className="text-gray-400" strokeWidth={3} />}
                  </div>
                  <span className={`text-xs ${ok ? "text-green-600" : "text-gray-400"}`}>{c.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#1D3B53]">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary bg-white pr-12"
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer">
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        {/* Referral Code */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[#1D3B53]">
            Referral Code <span className="text-gray-400">(Optional)</span>
            {referralFromLink && <span className="ml-2 text-xs text-green-600 font-normal">Applied from referral link</span>}
          </label>
          <input
            type="text"
            value={referralCode}
            onChange={e => !referralFromLink && setReferralCode(e.target.value)}
            readOnly={referralFromLink}
            placeholder="Enter referral code"
            className={`w-full border rounded-lg px-4 py-3 text-sm outline-none bg-white ${referralFromLink ? "border-green-300 bg-green-50 text-green-700 cursor-not-allowed" : "border-gray-200 focus:border-primary"}`}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3.5 rounded-lg font-bold text-base disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default function SignupPasswordPage() {
  return <Suspense><SignupPasswordPageContent /></Suspense>;
}
