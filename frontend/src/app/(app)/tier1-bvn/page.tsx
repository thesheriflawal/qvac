"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { kycService } from "@/services/kyc.service";
import { userService } from "@/services/user.service";
import { useAuth } from "@/context/AuthContext";
import { invalidateKYCCache } from "@/hooks/useVerificationGate";
import { getErrorMessage } from "@/utils/errorHandler";

const BENEFITS = [
  "Access higher trading limits",
  "Faster withdrawals",
  "Full P2P market access",
];

export default function Tier1IdentityPage() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [identityType, setIdentityType] = useState<"nin" | "bvn">("nin");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  const label = identityType === "bvn" ? "BVN" : "NIN";

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || value.length < 11) {
      setError(`Please enter a valid 11-digit ${label}`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const raw = sessionStorage.getItem("kyc_personal_data");
      if (!raw) {
        setError("Session expired. Please go back and re-enter your details.");
        return;
      }
      const personalData = JSON.parse(raw);
      await kycService.submitTier1({
        ...personalData,
        identity_type: identityType,
        ...(identityType === "bvn" ? { bvn: value } : { nin: value }),
      });
      sessionStorage.removeItem("kyc_personal_data");
      invalidateKYCCache();

      try {
        const profileRes = await userService.getProfile();
        updateUser(profileRes?.data || profileRes);
      } catch { /* non-critical */ }

      setVerified(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8" />
          <h1 className="text-lg font-bold text-[#1D3B53]">Verification</h1>
        </div>
        <div className="flex flex-col items-center py-16 px-6 text-center">
          <CheckCircle2 size={80} className="text-[#4CD964] mb-5" />
          <h2 className="text-xl font-bold text-[#1D3B53] mb-2">Tier 1 Verified!</h2>
          <p className="text-sm text-[#8E8E93] mb-10">Your {label} has been verified successfully.</p>
          <button
            onClick={() => router.push("/tier2-address")}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer mb-3"
          >
            Continue to Tier 2
          </button>
          <button
            onClick={() => router.push("/wallet")}
            className="w-full bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer"
          >
            Return to Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/tier1-basic")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Identity Verification</h1>
      </div>

      {/* Benefits — subtle, light */}
      <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-2xl px-4 py-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-primary shrink-0" />
          <p className="text-sm font-semibold text-[#1D3B53]">Why we verify your identity</p>
        </div>
        <div className="space-y-2">
          {BENEFITS.map(b => (
            <div key={b} className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-green-500 shrink-0" />
              <span className="text-xs text-[#555]">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* NIN / BVN toggle */}
      <p className="text-sm text-[#555] mb-3">Choose a verification method</p>
      <div className="flex bg-[#F0F5FF] rounded-xl p-1 mb-4">
        {(["nin", "bvn"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setIdentityType(t); setValue(""); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${identityType === t ? "bg-white shadow text-primary" : "text-[#8E8E93]"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <form onSubmit={handleContinue} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm text-[#555] mb-2">Enter Your {label}</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={value}
            onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
            placeholder={`Enter 11-digit ${label}`}
            className="w-full h-12 border border-[#E2E8F0] rounded-lg px-4 text-sm text-[#1D3B53] outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading || value.length < 11}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Continue"}
        </button>
      </form>

      {/* Privacy + Dojah notice */}
      <div className="mt-5 flex flex-col items-center gap-2">
        <p className="text-xs text-[#8E8E93] text-center">Your {label} is never stored directly on our servers.</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#8E8E93]">Powered by</span>
          <Image src="/dojah.png" alt="Dojah" width={48} height={16} className="object-contain opacity-70" />
        </div>
      </div>
    </div>
  );
}
