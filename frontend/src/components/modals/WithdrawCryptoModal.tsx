"use client";
import { X, Link2, ArrowLeftRight, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WithdrawCryptoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  if (!visible) return null;

  const go = (path: string) => { onClose(); router.push(path); };

  const options = [
    {
      icon: <Link2 size={18} className="text-primary" />,
      label: "On-Chain",
      desc: "Send crypto to any external wallet address through the blockchain network of your choice.",
      path: "/withdraw-search",
    },
    {
      icon: <ArrowLeftRight size={18} className="text-primary" />,
      label: "Internal Transfer",
      desc: "Transfer funds instantly between Kynettic wallets at no cost.",
      path: "/crypto-internal-transfer",
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-base text-[#1D3B53]">Choose Your Preferred Option</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {options.map(opt => (
            <button
              key={opt.path}
              onClick={() => go(opt.path)}
              className="w-full flex items-center gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl hover:bg-[#EBF4FF] hover:border-primary cursor-pointer transition-colors text-left"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#1D3B53] mb-0.5">{opt.label}</p>
                <p className="text-xs text-[#8E8E93] leading-relaxed">{opt.desc}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 shrink-0" />
            </button>
          ))}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
