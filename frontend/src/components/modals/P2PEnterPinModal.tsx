"use client";
import { useState, useRef, useEffect } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";

const PIN_LENGTH = 6;

function DigitRow({ digits, onChange, onKeyDown, onPaste, inputRefs }: {
  digits: string[];
  onChange: (i: number, v: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}) {
  return (
    <div className="flex justify-center gap-3 mb-6">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          value={d}
          onChange={e => onChange(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={i === 0 ? onPaste : undefined}
          className="w-11 h-12 border border-gray-200 rounded-xl text-center text-lg font-bold text-[#1D3B53] outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      ))}
    </div>
  );
}

export default function P2PEnterPinModal({
  visible,
  onClose,
  onSubmit,
  needs2FA: needs2FAProp,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (pin: string, authCode?: string) => void;
  needs2FA?: boolean;
}) {
  const { user } = useAuth();
  const needs2FA = needs2FAProp ?? !!(user?.is_2fa_enabled || (user as any)?.two_factor_enabled);
  const [step, setStep] = useState<"pin" | "2fa">("pin");
  const [pinDigits, setPinDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [authCode, setAuthCode] = useState("");
  const [pasted, setPasted] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const authInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (visible) {
      setStep("pin");
      setPinDigits(Array(PIN_LENGTH).fill(""));
      setAuthCode("");
      setTimeout(() => pinRefs.current[0]?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    if (step === "2fa") {
      setTimeout(() => authInputRef.current?.focus(), 100);
    }
  }, [step]);

  if (!visible) return null;

  const makeHandleChange = (
    digits: string[],
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const makeHandleKeyDown = (
    digits: string[],
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const makePaste = (
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!text) return;
    const next = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    refs.current[Math.min(text.length, PIN_LENGTH - 1)]?.focus();
  };

  const pin = pinDigits.join("");

  const handleClose = () => {
    setPinDigits(Array(PIN_LENGTH).fill(""));
    setAuthCode("");
    setStep("pin");
    onClose();
  };

  const handlePinNext = async () => {
    if (pin.length < PIN_LENGTH) return;

    // If the cached user doesn't show 2FA enabled, do a quick fresh check
    // to catch users who enabled 2FA in the same session without re-login.
    let is2FAEnabled = needs2FA;
    if (!needs2FA && needs2FAProp === undefined) {
      try {
        const r = await userService.getProfile();
        const p = r?.data || r;
        is2FAEnabled = !!(p?.is_2fa_enabled || p?.two_factor_enabled);
      } catch { /* network error — fall back to cached */ }
    }

    if (is2FAEnabled) {
      setStep("2fa");
    } else {
      onSubmit(pin);
      setPinDigits(Array(PIN_LENGTH).fill(""));
    }
  };

  const handleAuthSubmit = () => {
    if (authCode.length < PIN_LENGTH) return;
    onSubmit(pin, authCode);
    setPinDigits(Array(PIN_LENGTH).fill(""));
    setAuthCode("");
  };

  const handleAuthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setAuthCode(val);
  };

  const handlePasteAuth = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const val = text.replace(/\D/g, "").slice(0, PIN_LENGTH);
      if (val) {
        setAuthCode(val);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch { /* clipboard permission denied */ }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>

        {step === "pin" ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-[#EBF4FF] rounded-full flex items-center justify-center">
                <Lock size={24} className="text-primary" />
              </div>
            </div>
            <h3 className="font-bold text-lg text-[#1D3B53] text-center mb-1">Enter Your PIN</h3>
            <p className="text-sm text-[#8E8E93] text-center mb-6">
              {needs2FA ? "Step 1 of 2 — Enter your transaction PIN" : "Enter your PIN to complete this transaction"}
            </p>
            <DigitRow
              digits={pinDigits}
              onChange={makeHandleChange(pinDigits, setPinDigits, pinRefs)}
              onKeyDown={makeHandleKeyDown(pinDigits, setPinDigits, pinRefs)}
              onPaste={makePaste(setPinDigits, pinRefs)}
              inputRefs={pinRefs}
            />
            <button
              onClick={handlePinNext}
              disabled={pin.length < PIN_LENGTH}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold cursor-pointer disabled:opacity-40 transition-opacity mb-4"
            >
              {needs2FA ? "Next" : "Complete"}
            </button>
            <p className="text-center text-sm text-[#8E8E93]">
              Forgot PIN?{" "}
              <Link href="/change-pin" className="text-primary underline font-medium">Reset PIN</Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-[#EBF4FF] rounded-full flex items-center justify-center">
                <ShieldCheck size={24} className="text-primary" />
              </div>
            </div>
            <h3 className="font-bold text-lg text-[#1D3B53] text-center mb-1">2FA Verification</h3>
            <p className="text-sm text-[#8E8E93] text-center mb-6">
              Step 2 of 2 — Enter the 6-digit code from your authenticator app
            </p>

            <div className="flex items-center bg-[#EBF4FF] border border-primary rounded-xl px-4 h-14 gap-3 mb-6">
              <input
                ref={authInputRef}
                type="text"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={authCode}
                onChange={handleAuthChange}
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                className="flex-1 text-xl font-bold tracking-widest bg-transparent outline-none text-[#1D3B53] placeholder:text-gray-300 placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
              />
              <button
                onClick={handlePasteAuth}
                className="text-primary font-semibold text-sm cursor-pointer shrink-0"
              >
                {pasted ? "Pasted!" : "Paste"}
              </button>
            </div>

            <button
              onClick={handleAuthSubmit}
              disabled={authCode.length < PIN_LENGTH}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold cursor-pointer disabled:opacity-40 transition-opacity mb-4"
            >
              Complete
            </button>
            <button
              onClick={() => { setAuthCode(""); setStep("pin"); }}
              className="w-full text-gray-500 text-sm py-2 cursor-pointer"
            >
              ← Back to PIN
            </button>
          </>
        )}
      </div>
    </div>
  );
}
