"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, CheckCircle2, Download, Users, ChevronRight } from "lucide-react";

export default function DepositModal({
  visible, onClose, symbol, mode, uid,
}: {
  visible: boolean;
  onClose: () => void;
  symbol?: string;
  mode?: "crypto" | "fiat";
  uid?: string;
}) {
  const router = useRouter();
  const [copiedUid, setCopiedUid] = useState(false);

  if (!visible) return null;

  const copyUid = () => {
    if (uid) {
      navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };
  const close = () => onClose();
  const goToDepositSearch = () => { close(); router.push("/deposit-search"); };
  const goToDepositFiat = () => { close(); router.push("/deposit-fiat"); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={close}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-base text-[#1D3B53]">
            {mode === "crypto" && symbol ? `Deposit ${symbol}` : "Deposit"}
          </h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {mode === "crypto" ? (
            <div className="space-y-3">
              <button
                onClick={goToDepositSearch}
                className="w-full flex items-center gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl hover:bg-[#EBF4FF] hover:border-primary cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Download size={18} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-[#1D3B53] mb-0.5">Deposit Crypto</p>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">Transfer crypto into your wallet by selecting your network and sending to your deposit address.</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 shrink-0" />
              </button>

              <div className="w-full flex items-start gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl">
                <div className="w-10 h-10 bg-[#EBF4FF] rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Users size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-[#1D3B53] mb-0.5">Receive from another Kynettic user</p>
                  <p className="text-xs text-[#8E8E93] leading-relaxed mb-3">Share your UID to get funds sent straight to your wallet in seconds.</p>
                  <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-xs text-gray-400">UID: </span>
                      <span className="text-xs font-mono text-[#1D3B53]">{uid || "—"}</span>
                    </div>
                    <button onClick={copyUid} className="text-primary cursor-pointer ml-2 shrink-0">
                      {copiedUid ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={close} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={goToDepositFiat}
                className="w-full flex items-center gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl hover:bg-[#EBF4FF] hover:border-primary cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary text-lg shrink-0">💵</div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-[#1D3B53]">Deposit Fiat</p>
                  <p className="text-xs text-[#8E8E93]">Bank transfer</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 shrink-0 ml-auto" />
              </button>
              <button onClick={close} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
