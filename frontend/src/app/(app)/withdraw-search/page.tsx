"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { ArrowLeft, Search, X, Link2, ArrowRightLeft, ChevronRight } from "lucide-react";
import CurrencyIcon from "@/components/CurrencyIcon";

const FIAT = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);

export default function WithdrawSearchPage() {
  const router = useRouter();
  const { wallets } = useWallet();
  const [q, setQ] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const crypto = wallets
    .filter((w: any) => !FIAT.has((w.currency || "").toUpperCase()))
    .filter((w: any) => !hideZero || parseFloat(w.balance || "0") > 0)
    .filter((w: any) => (w.currency || "").toLowerCase().includes(q.toLowerCase()) || (w.name || "").toLowerCase().includes(q.toLowerCase()))
    .sort((a: any, b: any) => parseFloat(b.balance || "0") - parseFloat(a.balance || "0"));

  const openOptions = (w: any) => setSelected(w);

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Withdraw Crypto</h1>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search asset..."
          className="w-full pl-10 pr-4 py-3.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#1D3B53] outline-none"
        />
      </div>

      {/* Hide zero balances */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
        <div
          onClick={() => setHideZero(v => !v)}
          className={`w-10 h-6 rounded-full transition-colors relative ${hideZero ? "bg-primary" : "bg-gray-200"}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${hideZero ? "left-5" : "left-1"}`} />
        </div>
        <span className="text-sm text-[#555]">Hide zero balances</span>
      </label>

      {/* Asset list */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#E2E8F0]">
        {crypto.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#8E8E93]">No assets found</div>
        ) : (
          crypto.map((w: any, i: number) => {
            const balance = parseFloat(w.balance || "0");
            const locked = parseFloat(w.locked_balance || "0");
            const available = Math.max(0, balance - locked);
            return (
              <button
                key={w.id || i}
                onClick={() => openOptions(w)}
                className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <CurrencyIcon symbol={w.currency} size={38} />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#1D3B53]">{w.currency}</p>
                    <p className="text-xs text-[#8E8E93]">{w.name || w.currency}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1D3B53]">{available.toFixed(6).replace(/\.?0+$/, "") || "0"}</p>
                  <p className="text-xs text-[#8E8E93]">Available</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Withdraw options modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CurrencyIcon symbol={selected.currency} size={24} />
                <div>
                  <h3 className="font-bold text-base text-[#1D3B53]">{selected.currency}</h3>
                  <p className="text-xs text-[#8E8E93]">{selected.name || selected.currency}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm font-bold text-[#1D3B53] mb-3">Choose withdrawal method</p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSelected(null);
                    router.push(`/withdraw-crypto?symbol=${selected.currency}&currency_id=${selected.currency_id || selected.id || ""}`);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-[#EBF4FF] border border-primary rounded-xl cursor-pointer hover:bg-[#D6E8FF] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Link2 size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#1D3B53]">On-Chain Withdrawal</p>
                    <p className="text-xs text-[#8E8E93]">Send to an external wallet address</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 shrink-0" />
                </button>

                <button
                  onClick={() => {
                    setSelected(null);
                    router.push(`/crypto-internal-transfer?coin=${selected.currency}&currencyId=${selected.currency_id || selected.id || ""}`);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl cursor-pointer hover:bg-[#EBF4FF] hover:border-primary transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowRightLeft size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#1D3B53]">Internal Transfer</p>
                    <p className="text-xs text-[#8E8E93]">Transfer to another Kynettic user</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
