"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email"); return; }
    setLoading(true);
    try {
      await authService.forgotPasswordRequestOtp(email);
      router.push(`/forgot-password/otp?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/KynetticLogo.png" alt="Kynettic" width={150} height={40} className="mb-6 object-contain" />
      <h1 className="text-2xl font-bold mb-2 text-center">Forgot Password</h1>
      <p className="text-gray-500 mb-8 text-center text-sm">Enter your email and we&apos;ll send you a verification code</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Email Address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[#4472B7] text-white py-3.5 rounded-lg font-bold text-base disabled:opacity-60">{loading ? "Sending..." : "Send Code"}</button>
        <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-700">← Back to login</Link>
      </form>
    </div>
  );
}
