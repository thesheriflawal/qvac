"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { kycService } from "@/services/kyc.service";
import { invalidateKYCCache } from "@/hooks/useVerificationGate";
import { getErrorMessage } from "@/utils/errorHandler";

export default function Tier2AddressPage() {
  const router = useRouter();

  // What Tier 2 needs — determined by reading tier1_identity_type from status
  const [requiredType, setRequiredType] = useState<"bvn" | "nin" | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    kycService.getKYCStatus()
      .then(res => {
        const t1type = res?.data?.tier1_identity_type || res?.tier1_identity_type || "";
        // Tier 2 needs the opposite of Tier 1
        if (t1type === "bvn") setRequiredType("nin");
        else if (t1type === "nin") setRequiredType("bvn");
        else setRequiredType("nin"); // fallback: default to NIN
      })
      .catch(() => setRequiredType("nin"))
      .finally(() => setStatusLoading(false));
  }, []);

  const label = requiredType === "bvn" ? "BVN" : "NIN";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value.length < 11) {
      setError(`Please enter a valid 11-digit ${label}`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await kycService.submitTier2(
        requiredType === "bvn" ? { bvn: value } : { nin: value }
      );
      invalidateKYCCache();
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
          <h2 className="text-xl font-bold text-[#1D3B53] mb-2">Tier 2 Verified!</h2>
          <p className="text-sm text-[#8E8E93] mb-10">Your {label} has been verified successfully.</p>
          <button
            onClick={() => router.push("/tier3-advanced")}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer mb-3"
          >
            Continue to Tier 3
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
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/verification-dashboard")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Tier 2 Verification</h1>
      </div>

      {statusLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div className="bg-[#EBF4FF] border border-primary/20 rounded-xl px-4 py-3 mb-2">
            <p className="text-xs text-primary">
              You verified Tier 1 with your <strong>{requiredType === "bvn" ? "NIN" : "BVN"}</strong>. Tier 2 requires your <strong>{label}</strong>.
            </p>
          </div>

          <div>
            <label className="block text-sm text-[#555] mb-2">Enter Your {label}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={value}
              onChange={e => setValue(e.target.value.replace(/\D/g, ""))}
              placeholder={`Enter 11-digit ${label}`}
              className="w-full h-12 border border-[#E0E0E0] rounded-lg px-4 text-base text-[#333] outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => setConsent(!consent)}
            className="w-full flex items-start gap-3 bg-[#F9FAFB] border border-[#E2E8F0] rounded-xl px-4 py-4 cursor-pointer text-left"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consent ? "bg-primary border-primary" : "bg-white border-gray-300"}`}>
              {consent && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <p className="text-xs text-[#555] leading-relaxed">
              I consent to Kynettic collecting and processing my {label === "NIN" ? "National Identification Number (NIN)" : "Bank Verification Number (BVN)"} for identity verification under the{" "}
              <span className="font-semibold text-[#1D3B53]">Nigeria Data Protection Act 2023 (NDPA)</span>.
              This data may be shared with licensed verification service providers. I have read and agree to the{" "}
              <a href="/privacy-policy" target="_blank" className="text-primary underline" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
            </p>
          </button>

          <button
            type="submit"
            disabled={loading || value.length < 11 || !consent}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60 mt-2"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
