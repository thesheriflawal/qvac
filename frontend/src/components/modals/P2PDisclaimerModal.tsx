"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function P2PDisclaimerModal({
  visible, onClose, onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-[#FFF3E0] rounded-full flex items-center justify-center">
            <AlertTriangle size={28} className="text-[#F5A623]" />
          </div>
        </div>

        <h3 className="font-bold text-lg text-[#1D3B53] text-center mb-3">Disclaimer</h3>

        <p className="text-sm text-[#555] leading-relaxed mb-5">
          This is an automated order. Once confirmed, the system will process an instant exchange between your
          crypto and fiat balances. Depending on the trade type, crypto or fiat will be transferred automatically to
          the other party&apos;s wallet or account within the platform. Please review all details carefully before confirming, as
          all transactions are final once completed.
        </p>

        {/* Checkbox */}
        <label className="flex items-center gap-2 bg-[#F7F9FC] rounded-xl px-4 py-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => setAgreed(!agreed)}
            className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
          />
          <span className="text-sm text-[#1D3B53]">
            I understand and agree to the{" "}
            <span className="text-primary underline cursor-pointer">terms and conditions</span>.
          </span>
        </label>

        {/* Buttons stacked */}
        <button
          onClick={() => { if (agreed) { onConfirm(); setAgreed(false); } }}
          disabled={!agreed}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-40 mb-3"
        >
          Confirm
        </button>
        <button
          onClick={() => { onClose(); setAgreed(false); }}
          className="w-full py-3.5 rounded-xl border border-gray-200 text-[#1D3B53] font-bold cursor-pointer hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
