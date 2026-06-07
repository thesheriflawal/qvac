"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";

function ResetPasswordPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{12,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 12) { setError("Password must be at least 12 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!PW_REGEX.test(password)) { setError("Password must include uppercase, lowercase, a number, and a special character (!@#$%^&*)"); return; }
    setLoading(true);
    try {
      await authService.forgotPasswordReset(token, password);
      router.push("/forgot-password/success");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/KynetticLogo.png" alt="Kynettic" width={150} height={40} className="mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2 text-center">Create New Password</h1>
      <p className="text-gray-500 mb-8 text-center text-sm">Your new password must be at least 12 characters</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary pr-12" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[#4472B7] text-white py-3.5 rounded-lg font-bold text-base disabled:opacity-60">{loading ? "Resetting..." : "Reset Password"}</button>
      </form>
    </div>
  );
}
export default function ResetPasswordPage() { return <Suspense><ResetPasswordPageContent/></Suspense>; }
