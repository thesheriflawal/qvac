"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
import SocialLoginButtons from "@/components/SocialLoginButtons";

function SignupPageContent() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();

  const ref = params.get("ref") || "";

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email"); return; }
    setLoading(true);
    try {
      await authService.registerRequestOtp(email);
      const next = `/signup/otp?email=${encodeURIComponent(email)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;
      router.push(next);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/iconletter.png" alt="Kynettic" width={180} height={48} priority className="mb-6 object-contain w-auto h-auto" />
      <h1 className="text-2xl font-bold mb-2 text-center">Create an account for free</h1>
      <p className="text-gray-500 mb-4 text-center">Start trading on the p2p market.</p>
      <div className="flex gap-2 w-24 mb-8"><div className="flex-[7] h-1 bg-[#4472B7] rounded" /><div className="flex-[3] h-1 bg-gray-300 rounded" /></div>
      <form onSubmit={handleContinue} className="w-full max-w-md space-y-5 flex-1">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div><label className="block text-sm font-medium mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email address" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary" /></div>
        <button type="submit" disabled={loading} className="w-full bg-[#4472B7] text-white py-3.5 rounded-lg font-bold text-base disabled:opacity-60">{loading ? "Loading..." : "Continue"}</button>
        
        <div className="flex items-center gap-4 my-2">
          <div className="flex-1 h-[1px] bg-gray-200"></div>
          <span className="text-gray-400 text-xs font-medium uppercase">OR</span>
          <div className="flex-1 h-[1px] bg-gray-200"></div>
        </div>

        <SocialLoginButtons mode="signup" />

        <p className="text-center text-sm text-gray-500">I already have an account. <Link href="/login" className="text-[#4472B7] font-bold">Sign in</Link></p>
      </form>
      <p className="text-xs text-gray-500 mt-6">By continuing, you agree to the <Link href="/terms-of-service" className="text-[#4472B7]">Terms and Privacy Policy.</Link></p>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense><SignupPageContent /></Suspense>;
}
