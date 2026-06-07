"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, ChevronRight } from "lucide-react";

const CURRENCIES = [
  { code: "NGN", name: "Nigerian Naira", color: "#008751" },
];

export default function CurrencySelectorPage() {
  const router = useRouter();
  const [amountModal, setAmountModal] = useState(false);
  const [selected, setSelected] = useState<typeof CURRENCIES[0] | null>(null);
  const [amount, setAmount] = useState("");

  const handleSelect = (c: typeof CURRENCIES[0]) => {
    setSelected(c);
    setAmount("");
    setAmountModal(true);
  };

  const handleContinue = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setAmountModal(false);
    router.push(`/bank-transfer?currency=${selected!.code}&currencyName=${encodeURIComponent(selected!.name)}&amount=${amount}`);
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/deposit-fiat")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Select Currency</span>
        <div className="w-8" />
      </div>

      {/* Warning */}
      <div className="bg-[#FFF9EB] rounded-xl p-4 flex gap-3 mx-1 mb-5">
        <AlertTriangle size={20} className="text-[#F5A623] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#F5A623] mb-1">No Third Party Transactions</p>
          <p className="text-xs text-[#8E7356] leading-relaxed">
            All deposits and withdrawals must come from accounts in your own name. Any third party activity will be rejected for security reasons.
          </p>
        </div>
      </div>

      {/* Currency List */}
      <div className="px-1 space-y-3">
        {CURRENCIES.map(c => (
          <button
            key={c.code}
            onClick={() => handleSelect(c)}
            className="w-full flex items-center justify-between bg-[#F7F9FC] rounded-xl px-5 py-4 cursor-pointer hover:bg-[#EBF4FF] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: c.color }}>
                {c.code.charAt(0)}
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-[#1D3B53]">{c.code}</p>
                <p className="text-xs text-[#8E8E93]">{c.name}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-[#8E8E93]" />
          </button>
        ))}
      </div>

      {/* Amount Modal */}
      {amountModal && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6">
            <p className="font-bold text-base text-[#1D3B53] mb-1">Enter Amount</p>
            <p className="text-xs text-[#8E8E93] mb-5">How much do you want to deposit in {selected.code}?</p>
            <div className="flex items-center border border-primary rounded-xl px-4 py-3 mb-5 bg-[#EBF4FF]">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 text-2xl font-bold bg-transparent outline-none text-[#1D3B53] placeholder-gray-300"
                autoFocus
              />
              <span className="text-sm text-[#8E8E93] ml-2">{selected.code}</span>
            </div>
            <button
              onClick={handleContinue}
              disabled={!amount || parseFloat(amount) <= 0}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:bg-[#A0B8D0] mb-3"
            >
              Continue
            </button>
            <button onClick={() => setAmountModal(false)} className="w-full text-sm text-[#8E8E93] py-2 cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
