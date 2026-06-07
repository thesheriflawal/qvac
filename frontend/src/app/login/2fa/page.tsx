"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { Delete, ClipboardPaste } from "lucide-react";

function PinDots({ value, length = 6 }: { value: string; length?: number }) {
  return (
    <div className="flex justify-center gap-3 my-6">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-colors ${
            i < value.length ? "bg-primary border-primary" : "bg-transparent border-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","del"];

function NumKeypad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {KEYS.map((k, i) => {
        if (!k) return <div key={i} />;
        if (k === "del") return (
          <button key={i} onClick={() => onPress("del")} className="h-14 flex items-center justify-center rounded-xl bg-white/30 text-[#1D3B53] cursor-pointer active:scale-95 transition-transform">
            <Delete size={20} className="text-[#1D3B53]" />
          </button>
        );
        return (
          <button key={i} onClick={() => onPress(k)} className="h-14 flex items-center justify-center rounded-xl bg-white/30 text-[#1D3B53] font-bold text-xl cursor-pointer active:scale-95 transition-transform hover:bg-white/50">
            {k}
          </button>
        );
      })}
    </div>
  );
}

function TwoFactorLoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const returnTo = params.get("returnTo") || "/wallet";
  const { setAuthData } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Keep hidden input focused so Ctrl/Cmd+V always works
  useEffect(() => { hiddenInputRef.current?.focus(); }, []);

  const applyCode = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) handleVerify(digits);
  };

  const handleKey = (k: string) => {
    if (k === "del") { setCode(v => v.slice(0, -1)); hiddenInputRef.current?.focus(); return; }
    if (code.length >= 6) return;
    const next = code + k;
    applyCode(next);
    hiddenInputRef.current?.focus();
  };

  const handlePasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyCode(text);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    } catch { /* clipboard permission denied */ }
  };

  const handleVerify = async (finalCode?: string) => {
    const c = finalCode || code;
    if (c.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const preAuthToken = sessionStorage.getItem("pre_auth_token") || "";
      const response = await authService.verify2FA(preAuthToken, c);
      const data = response?.data;
      if (!data?.access_token) throw new Error("Invalid 2FA response");
      setAuthData(data.access_token, data.refresh_token, data.user);
      sessionStorage.removeItem("pre_auth_token");
      router.replace(returnTo);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setCode("");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5] flex flex-col items-center px-6 pt-10 pb-8">
      <Image src="/KynetticLogo.png" alt="Kynettic" width={150} height={40} className="mb-8 object-contain" />

      <div className="w-full max-w-md flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4472B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1D3B53] mb-2 text-center">2FA Verification</h1>
        <p className="text-sm text-[#8E8E93] text-center mb-2">
          Enter the 6-digit code from your authenticator app
          {email && <><br /><strong className="text-[#1D3B53]">{email}</strong></>}
        </p>

        {error && (
          <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm text-center mb-2">
            {error}
          </div>
        )}

        {/* Hidden input — always focused to capture Ctrl/Cmd+V and mobile paste */}
        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={e => applyCode(e.target.value)}
          onPaste={e => { e.preventDefault(); applyCode(e.clipboardData.getData("text")); }}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          aria-hidden="true"
        />

        {/* Dots — tap to refocus hidden input on mobile */}
        <div onClick={() => hiddenInputRef.current?.focus()} className="cursor-pointer">
          <PinDots value={code} />
        </div>

        {/* Paste button */}
        <button
          type="button"
          onClick={handlePasteButton}
          className="flex items-center gap-1.5 text-sm text-primary font-semibold mb-4 cursor-pointer"
        >
          <ClipboardPaste size={15} />
          {pasted ? "Pasted!" : "Paste code"}
        </button>

        {loading ? (
          <div className="flex justify-center my-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <NumKeypad onPress={handleKey} />
        )}

        <Link href="/login" className="mt-8 text-sm text-[#8E8E93] hover:text-[#1D3B53]">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}

export default function TwoFactorLoginPage() {
  return <Suspense><TwoFactorLoginPageContent /></Suspense>;
}
