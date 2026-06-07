"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft, Smartphone, Copy, CheckCircle2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<"intro" | "qr" | "verify" | "success">("intro");
  const [setupData, setSetupData] = useState<{ otpauth_url: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true); setError("");
    try {
      const data = await securityService.setup2FA();
      setSetupData(data);
      setStep("qr");
    } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  const verify = async () => {
    if (code.length !== 6) return;
    setLoading(true); setError("");
    try {
      await securityService.enable2FA(code);
      await updateUser({ ...(user || {}), is_2fa_enabled: true });
      setStep("success");
    } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      {step !== "success" && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/security-settings")} className="p-1 cursor-pointer">
            <ArrowLeft size={22} className="text-[#1D3B53]" />
          </button>
          <h1 className="text-lg font-bold text-[#1D3B53]">Two-Factor Authentication</h1>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {/* Intro */}
      {step === "intro" && (
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#EBF4FF] flex items-center justify-center mb-5">
            <Smartphone size={36} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold text-[#1D3B53] mb-3">Secure Your Account</h2>
          <p className="text-sm text-[#8E8E93] mb-2 leading-relaxed">
            Enable 2FA using an authenticator app for an extra layer of security.
          </p>
          <p className="text-xs text-[#8E8E93] mb-8">
            Recommended: Google Authenticator, Authy, or Microsoft Authenticator
          </p>

          <div className="w-full space-y-3 mb-6">
            {[
              "Download an authenticator app",
              "Scan the QR code we provide",
              "Enter the 6-digit code to confirm",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#F7F9FC] rounded-xl px-4 py-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm text-[#1D3B53]">{s}</span>
              </div>
            ))}
          </div>

          <button
            onClick={startSetup}
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Enable 2FA"}
          </button>
        </div>
      )}

      {/* QR Code */}
      {step === "qr" && setupData && (
        <div className="bg-white rounded-2xl p-6">
          <p className="text-sm text-[#555] mb-5 text-center leading-relaxed">
            Scan this QR code with your authenticator app, or enter the secret key manually.
          </p>

          <div className="flex justify-center mb-5 p-4 bg-white rounded-2xl border border-[#E2E8F0]">
            <QRCodeSVG value={setupData.otpauth_url} size={200} />
          </div>

          <p className="text-xs text-[#8E8E93] text-center mb-2">Manual entry key:</p>
          <div className="bg-[#F0F4F8] rounded-xl p-3 flex items-center justify-between mb-6">
            <code className="text-sm font-mono break-all flex-1 text-[#1D3B53] select-all">{setupData.secret}</code>
            <button onClick={copySecret} className="ml-3 text-primary cursor-pointer shrink-0">
              {copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>

          <button
            onClick={() => setStep("verify")}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold cursor-pointer"
          >
            I&apos;ve scanned it →
          </button>
        </div>
      )}

      {/* Verify */}
      {step === "verify" && (
        <div className="bg-white rounded-2xl p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#EBF4FF] flex items-center justify-center mb-3">
              <Smartphone size={28} className="text-primary" />
            </div>
            <h2 className="text-base font-bold text-[#1D3B53] mb-1">Enter Verification Code</h2>
            <p className="text-sm text-[#8E8E93] text-center">
              Enter the 6-digit code displayed in your authenticator app
            </p>
          </div>

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full text-center text-3xl tracking-[0.4em] border-2 border-[#E2E8F0] focus:border-primary rounded-xl p-4 mb-6 font-mono outline-none transition-colors"
            autoFocus
          />

          <button
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Confirm & Enable"}
          </button>

          <button
            onClick={() => setStep("qr")}
            className="w-full mt-3 py-3 text-sm text-[#8E8E93] cursor-pointer hover:text-[#1D3B53]"
          >
            ← Back to QR code
          </button>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <ShieldCheck size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#1D3B53] mb-3">2FA Enabled!</h2>
          <p className="text-sm text-[#8E8E93] max-w-xs leading-relaxed mb-2">
            Your account is now more secure. You&apos;ll be asked for a 6-digit code each time you log in.
          </p>
          <p className="text-xs text-[#8E8E93] max-w-xs mb-10">
            Keep your authenticator app safe — you&apos;ll need it to access your account.
          </p>
          <button
            onClick={() => router.push("/security-settings")}
            className="w-full max-w-xs bg-primary text-white py-4 rounded-xl font-bold cursor-pointer"
          >
            Okay
          </button>
        </div>
      )}
    </div>
  );
}
