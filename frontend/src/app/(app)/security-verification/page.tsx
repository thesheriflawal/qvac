"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Delete, Shield } from "lucide-react";

function PinBox({ value, isActive }: { value: string; isActive: boolean }) {
  return (
    <div className="flex gap-2.5 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <div
          key={i}
          className={`w-11 h-12 border rounded-lg flex items-center justify-center bg-white ${isActive ? "border-primary" : "border-primary/40"}`}
        >
          <span className="text-xl font-bold text-[#1D3B53]">{value[i] ? "●" : ""}</span>
        </div>
      ))}
    </div>
  );
}

function NumKeypad({ onKey, onDelete }: { onKey: (k: string) => void; onDelete: () => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
  return (
    <div className="grid grid-cols-3 bg-gray-200">
      {keys.map((k, i) => {
        if (k === "") return <div key={i} className="py-5" />;
        if (k === "del") return (
          <button key={i} onClick={onDelete} className="py-5 flex items-center justify-center cursor-pointer active:bg-gray-300">
            <Delete size={22} className="text-[#1D3B53]" />
          </button>
        );
        return (
          <button key={i} onClick={() => onKey(k)} className="py-5 text-xl font-semibold text-[#1D3B53] cursor-pointer active:bg-gray-300 border-r border-t border-gray-300">
            {k}
          </button>
        );
      })}
    </div>
  );
}

type Step = "pin" | "2fa";

function SecurityVerificationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const description = params.get("description") || "";
  const amount = params.get("amount") || "";
  const currency = params.get("currency") || "";
  const returnUrl = params.get("returnUrl") || "";

  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");

  const handleKey = (val: string) => {
    if (step === "pin" && pin.length < 6) {
      const updated = pin + val;
      setPin(updated);
    }
  };

  const handleDelete = () => {
    if (step === "pin") setPin(p => p.slice(0, -1));
  };

  const handleContinue = () => {
    setError("");
    if (step === "pin") {
      if (pin.length < 6) { setError("Please enter your 6-digit PIN"); return; }
      setStep("2fa");
    } else {
      if (totpCode.length < 6) { setError("Please enter your 6-digit authenticator code"); return; }
      // Build callback URL with pin and totp
      const dest = returnUrl
        ? `${returnUrl}?pin=${encodeURIComponent(pin)}&totp=${encodeURIComponent(totpCode)}`
        : "/wallet";
      router.replace(dest);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Security Verification</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 px-5 pt-6 pb-4">
        {/* Shield icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#EBF4FF] flex items-center justify-center">
            <Shield size={28} className="text-primary" />
          </div>
        </div>

        {/* Transaction summary card */}
        {(description || amount) && (
          <div className="bg-[#EBF4FF] rounded-2xl p-4 mb-6">
            <p className="text-xs text-[#8E8E93] mb-1">Transaction</p>
            {description && <p className="text-sm font-semibold text-[#1D3B53]">{description}</p>}
            {amount && (
              <p className="text-2xl font-bold text-primary mt-1">
                {amount}{currency ? ` ${currency}` : ""}
              </p>
            )}
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(["pin", "2fa"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s || (step === "2fa" && s === "pin") ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}>
                {s === "pin" && step === "2fa" ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === s ? "text-primary" : "text-[#8E8E93]"}`}>
                {s === "pin" ? "Transaction PIN" : "Authenticator Code"}
              </span>
              {i === 0 && <div className="flex-1 h-px bg-gray-200 mx-2 w-8" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {step === "pin" ? (
          <>
            <p className="font-bold text-base text-[#1D3B53] text-center mb-1">Enter Transaction PIN</p>
            <p className="text-xs text-[#8E8E93] text-center mb-5">Enter your 6-digit transaction PIN to confirm</p>
            <PinBox value={pin} isActive />
          </>
        ) : (
          <>
            <p className="font-bold text-base text-[#1D3B53] text-center mb-1">Authenticator Code</p>
            <p className="text-xs text-[#8E8E93] text-center mb-5">Enter the 6-digit code from your authenticator app</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={e => { e.preventDefault(); setTotpCode(e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }}
              placeholder="000000"
              autoFocus
              className="w-full border border-primary/40 rounded-xl p-3 text-center text-2xl tracking-[0.5em] font-bold text-[#1D3B53] outline-none focus:border-primary"
            />
          </>
        )}

        <button
          onClick={handleContinue}
          disabled={step === "pin" ? pin.length < 6 : totpCode.length < 6}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60 mt-6"
        >
          {step === "pin" ? "Next" : "Confirm"}
        </button>
      </div>

      {step === "pin" && <NumKeypad onKey={handleKey} onDelete={handleDelete} />}
    </div>
  );
}

export default function SecurityVerificationPage() {
  return <Suspense><SecurityVerificationContent /></Suspense>;
}
