"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudUpload, Trash2, Scan, FileText } from "lucide-react";

import { kycService } from "@/services/kyc.service";
import { invalidateKYCCache } from "@/hooks/useVerificationGate";
import { getErrorMessage } from "@/utils/errorHandler";

type Step = "nin" | "address" | "selfie" | "processing";

export default function Tier3AdvancedPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("nin");

  // NIN step
  const [nin, setNin] = useState("");
  const [consent, setConsent] = useState(false);

  // Address step
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [addressDoc, setAddressDoc] = useState<File | null>(null);
  const addressFileRef = useRef<HTMLInputElement>(null);

  // Selfie step
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNinNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (nin.length < 11) { setError("Please enter a valid 11-digit NIN"); return; }
    setStep("address");
  };

  const handleAddressNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!address.trim() || !state.trim() || !lga.trim() || !country.trim()) { setError("Please fill in all address fields"); return; }
    if (!addressDoc) { setError("Please upload your address verification document"); return; }
    if (addressDoc.size > 5 * 1024 * 1024) { setError("The address document exceeds the 5MB limit."); return; }
    setStep("selfie");
  };

  const handleSubmit = async () => {
    setError("");
    if (!selfieFile) { setError("Please take or upload a selfie photo"); return; }
    if (selfieFile.size > 5 * 1024 * 1024) { setError("The selfie image exceeds the 5MB limit."); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("nin", nin.trim());
      formData.append("address_street", address.trim());
      formData.append("address_city", lga.trim());
      formData.append("address_state", state.trim());
      formData.append("address_country", country.trim());
      if (addressDoc) formData.append("utility_bill", addressDoc, addressDoc.name);
      formData.append("selfie_image", selfieFile, selfieFile.name);

      await kycService.submitTier3(formData);
      invalidateKYCCache();
      setStep("processing");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Processing screen
  if (step === "processing") {
    return (
      <div className="max-w-lg mx-auto pb-10">
        <div className="flex items-center gap-3 mb-10">
          <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
            <ArrowLeft size={22} className="text-[#1D3B53]" />
          </button>
          <h1 className="text-lg font-bold text-[#1D3B53]">Verification</h1>
        </div>
        <div className="flex flex-col items-center py-12 px-6 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-orange-100 rounded-full blur-2xl opacity-60 animate-pulse"></div>
            <div className="relative w-48 h-48 rounded-full bg-gradient-to-tr from-[#FFF8F0] to-white flex items-center justify-center shadow-inner">
              <FileText size={80} className="text-orange-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#1D3B53] mb-3">Submission Received</h2>
          <p className="text-sm text-[#8E8E93] leading-relaxed max-w-xs mb-12">
            Your Tier 3 verification documents have been submitted successfully. Our team will review them shortly.
          </p>
          <div className="w-full space-y-4">
            <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              Go to Wallet
            </button>
            <button onClick={() => router.push("/verification-dashboard")} className="w-full bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer hover:bg-[#D1E3FF] transition-all">
              Check Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { if (step === "nin") router.push("/verification-dashboard"); else setStep(step === "selfie" ? "address" : "nin"); }} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">
          {step === "nin" ? "NIN Verification" : step === "address" ? "Address Verification" : "Facial Recognition"}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(["nin", "address", "selfie"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? "bg-primary text-white" : (["nin","address","selfie"].indexOf(step) > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400")}`}>
              {["nin","address","selfie"].indexOf(step) > i ? "✓" : i + 1}
            </div>
            {i < 2 && <div className="h-px bg-gray-200 w-6" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {/* Step 1: NIN Photo */}
      {step === "nin" && (
        <form onSubmit={handleNinNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Enter Your NIN</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={nin}
              onChange={e => setNin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 11-digit NIN"
              className="w-full h-12 border border-[#E2E8F0] rounded-lg px-4 text-sm text-[#1D3B53] outline-none focus:border-primary"
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
              I consent to Kynettic collecting and processing my NIN, address details, and biometric data (facial image) as sensitive personal data for identity verification under the{" "}
              <span className="font-semibold text-[#1D3B53]">Nigeria Data Protection Act 2023 (NDPA)</span>.
              This data may be shared with licensed verification service providers. I have read and agree to the{" "}
              <a href="/privacy-policy" target="_blank" className="text-primary underline" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
            </p>
          </button>
          <button type="submit" disabled={!consent} className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-40 mt-2">Next</button>
        </form>
      )}

      {/* Step 2: Address */}
      {step === "address" && (
        <form onSubmit={handleAddressNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Enter Your Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address"
              className="w-full h-12 border border-[#E2E8F0] rounded-lg px-4 text-sm text-[#1D3B53] outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">State</label>
              <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="State"
                className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">City / LGA</label>
              <input type="text" value={lga} onChange={e => setLga(e.target.value)} placeholder="City or LGA"
                className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1D3B53] mb-1.5">Country</label>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Country"
              className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1D3B53] mb-1">Upload Address Verification Document</label>
            <p className="text-xs text-[#8E8E93] mb-2">JPG, PNG or PDF only. (Should not exceed 5MB)</p>
            <input ref={addressFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setAddressDoc(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => addressFileRef.current?.click()}
              className="w-full h-14 border border-dashed border-[#D1D5DB] rounded-lg flex items-center justify-center gap-2 text-[#8E8E93] text-sm hover:bg-gray-50 cursor-pointer">
              <CloudUpload size={22} />
              {addressDoc ? "Change Document" : "Click to Upload"}
            </button>
            {addressDoc && (
              <div className="mt-2 bg-[#EBF4FF] border border-[#D1E3FF] rounded-lg p-3 flex items-center gap-2">
                <span className="text-xs text-[#1D3B53] flex-1 truncate">{addressDoc.name}</span>
                <button type="button" onClick={() => setAddressDoc(null)} className="cursor-pointer"><Trash2 size={16} className="text-gray-500" /></button>
              </div>
            )}
          </div>
          <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer mt-2">Continue</button>
        </form>
      )}

      {/* Step 3: Selfie */}
      {step === "selfie" && (
        <div className="space-y-4">
          <div className="flex justify-center py-6">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <Scan size={140} className="text-[#8fb4e8] opacity-70" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-[#1D3B53] text-center">Ready For Facial Recognition?</h2>
          <p className="text-sm text-[#8E8E93] text-center leading-relaxed">
            Be in a well-lit environment. Upload a clear selfie photo of your face.
          </p>
          <div>
            <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e => setSelfieFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => selfieRef.current?.click()}
              className="w-full h-14 border border-dashed border-[#D1D5DB] rounded-lg flex items-center justify-center gap-2 text-[#8E8E93] text-sm hover:bg-gray-50 cursor-pointer mb-2">
              <CloudUpload size={22} />
              {selfieFile ? "Change Selfie" : "Upload Selfie Photo"}
            </button>
            {selfieFile && (
              <div className="bg-[#EBF4FF] border border-[#D1E3FF] rounded-lg p-3 flex items-center gap-2 mb-4">
                <span className="text-xs text-[#1D3B53] flex-1 truncate">{selfieFile.name}</span>
                <button type="button" onClick={() => setSelfieFile(null)} className="cursor-pointer"><Trash2 size={16} className="text-gray-500" /></button>
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || !selfieFile}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60"
          >
            {loading ? "Uploading & Verifying..." : "Begin Facial Recognition"}
          </button>
        </div>
      )}
    </div>
  );
}
