"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { Eye, EyeOff } from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/wallet";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter email and password"); return; }
    try {
      await login(email, password);
      router.replace(returnTo);
    } catch (err: any) {
      if (err?.requires2FA) {
        sessionStorage.setItem("pre_auth_token", err.pre_auth_token);
        const returnParam = returnTo !== "/wallet" ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
        router.replace(`/login/2fa?email=${encodeURIComponent(err.email)}${returnParam}`);
        return;
      }
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/iconletter.png" alt="Kynettic" width={180} height={48} priority className="mb-6 object-contain w-auto h-auto" />
      <h1 className="text-2xl font-bold mb-2 text-center">Hey, Welcome back</h1>
      <p className="text-gray-500 mb-8 text-center">Pick up right where you left off</p>
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-5 flex-1">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Email Address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email Address" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter Password" className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-primary pr-12" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
          <Link href="/forgot-password" className="block text-right text-xs text-gray-500 mt-1">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[#4472B7] text-white py-3.5 rounded-lg font-bold text-base disabled:opacity-60">{loading ? "Loading..." : "Login"}</button>
        
        <div className="flex items-center gap-4 my-2">
          <div className="flex-1 h-[1px] bg-gray-200"></div>
          <span className="text-gray-400 text-xs font-medium uppercase">OR</span>
          <div className="flex-1 h-[1px] bg-gray-200"></div>
        </div>

        <SocialLoginButtons mode="login" />

        <p className="text-center text-sm text-gray-500">I don&apos;t have an account. <Link href="/signup" className="text-[#4472B7] font-bold">Sign up</Link></p>
      </form>
      <p className="text-xs text-gray-500 mt-6">By continuing, you agree to the <Link href="/terms-of-service" className="text-[#4472B7]">Terms and Privacy Policy.</Link></p>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
