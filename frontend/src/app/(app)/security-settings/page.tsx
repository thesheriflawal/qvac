"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft, ChevronRight } from "lucide-react";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [is2FA, setIs2FA] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showDisable, setShowDisable] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [disablePin, setDisablePin] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState("");

  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    setStatusLoading(true);
    try {
      const r = await userService.getProfile();
      const p = r?.data || r;
      setIs2FA(!!(p?.is_2fa_enabled || p?.two_factor_enabled));
      setHasPin(!!p?.is_pin_enabled);
      if (p) await updateUser(p);
    } catch {
      setIs2FA(!!(user?.is_2fa_enabled || user?.two_factor_enabled));
      setHasPin(!!user?.is_pin_enabled);
    } finally { setStatusLoading(false); }
  };

  const toggle2FA = () => { if (!is2FA) router.push("/two-factor-setup"); else { setTotpCode(""); setDisablePin(""); setDisableError(""); setShowDisable(true); } };

  const confirmDisable = async () => {
    if (disablePin.length !== 6) { setDisableError("Enter your 6-digit PIN"); return; }
    if (totpCode.length !== 6) { setDisableError("Enter your 6-digit authenticator code"); return; }
    setDisableLoading(true); setDisableError("");
    try {
      await securityService.disable2FA(totpCode, disablePin);
      setIs2FA(false); setShowDisable(false);
      if (user) await updateUser({ ...user, is_2fa_enabled: false });
    } catch (e) { setDisableError(getErrorMessage(e)); } finally { setDisableLoading(false); }
  };

  return (
    <div>
      <button onClick={() => router.push("/profile")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Pin and 2FA Settings</h1>
      <div className="bg-white rounded-2xl overflow-hidden max-w-lg">
        {/* 2FA Toggle */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Two-Factor Authentication</span>
            {!statusLoading && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${is2FA ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>{is2FA ? "Enabled" : "Disabled"}</span>}
          </div>
          <button onClick={toggle2FA} disabled={statusLoading} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${is2FA ? "bg-primary" : "bg-gray-300"}`}>
            <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${is2FA ? "translate-x-4" : "translate-x-0"}`}/>
          </button>
        </div>
        {/* Setup PIN */}
        <button onClick={() => { if (!hasPin) router.push("/pin-setup"); }} className={`w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${hasPin ? "opacity-50" : ""}`}>
          <div><p className="text-sm font-medium">Setup Transaction PIN</p>{hasPin && <p className="text-xs text-gray-400">PIN already configured</p>}</div>
          <ChevronRight size={16} className="text-gray-300"/>
        </button>
        {/* Change PIN */}
        <button onClick={() => { if (hasPin) router.push("/change-pin"); else router.push("/pin-setup"); }} className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50">
          <div>
            <p className="text-sm font-medium">Change PIN</p>
            {!hasPin && !statusLoading && <p className="text-xs text-orange-400">No PIN set — tap to create one</p>}
          </div>
          <ChevronRight size={16} className="text-gray-300"/>
        </button>
        {/* Change Password */}
        <button onClick={() => router.push("/change-password")} className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50">
          <span className="text-sm font-medium">Change Login Password</span>
          <ChevronRight size={16} className="text-gray-300"/>
        </button>
      </div>

      {/* Disable 2FA Modal */}
      {showDisable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDisable(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Confirm Disable 2FA</h3>
            <p className="text-sm text-gray-500 mb-4">Enter your transaction PIN and authenticator code to confirm.</p>
            {disableError && <p className="text-red-500 text-sm mb-3 bg-red-50 p-2 rounded-lg">{disableError}</p>}
            <label className="text-xs text-gray-500 block mb-1">Transaction PIN</label>
            <input type="password" maxLength={6} value={disablePin} onChange={e => setDisablePin(e.target.value.replace(/\D/g, ""))} placeholder="6-digit PIN" className="w-full border border-gray-200 rounded-xl p-3 text-sm text-center tracking-widest mb-3"/>
            <label className="text-xs text-gray-500 block mb-1">Authenticator Code</label>
            <input type="text" inputMode="numeric" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="w-full border border-gray-200 rounded-xl p-3 text-sm text-center tracking-widest mb-4"/>
            <button onClick={confirmDisable} disabled={disableLoading} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{disableLoading ? "Disabling..." : "Disable 2FA"}</button>
            <button onClick={() => setShowDisable(false)} className="w-full text-gray-500 text-sm mt-2 py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
