"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Eye, ChevronRight } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import TransactionItem from "@/components/TransactionItem";

const FIAT = ["NGN", "USD", "EUR", "GBP"];
const STABLE = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1 } as Record<string, number>;

export default function BalancePage() {
  const router = useRouter();
  const { wallets } = useWallet();

  const cryptoTotal = wallets
    .filter(w => !FIAT.includes(w.currency))
    .reduce((sum, w) => sum + parseFloat(String(w.balance || 0)) * (STABLE[w.currency] ?? 0), 0);

  const actions = [
    { label: "Deposit", icon: "/depositIcon.png", href: "/deposit-search" },
    { label: "Send", icon: "/sendIcon.png", href: "/withdraw-search" },
    { label: "Buy", icon: "/buyIcon.png", href: "/p2p" },
    { label: "Sell", icon: "/sellIcon.png", href: "/p2p" },
  ];

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-2">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Total Balance</span>
        <div className="w-8" />
      </div>

      {/* Blue Card with Waves */}
      <div
        className="rounded-2xl p-6 mb-6 bg-primary bg-[url('/waves.png')] bg-cover bg-center"
        style={{ minHeight: 200 }}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm text-white/90 font-semibold">Total Assets</span>
            <Eye size={14} className="text-white/80" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#4A6679] flex items-center justify-center">
              <span className="text-white text-xl font-bold">$</span>
            </div>
            <span className="text-4xl font-bold text-white">
              {cryptoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-sm text-white/80">Crypto Balance</span>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-around">
          {actions.map(a => (
            <button key={a.label} onClick={() => router.push(a.href)} className="flex flex-col items-center gap-1.5 cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Image src={a.icon} alt={a.label} width={24} height={24} className="object-contain" />
              </div>
              <span className="text-xs text-white font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* P2P Banner */}
      <button
        onClick={() => router.push("/p2p")}
        className="w-full rounded-2xl overflow-hidden mb-6 flex items-stretch cursor-pointer bg-gradient-to-br from-[#4472B7] to-[#2d5a9e] shadow-md hover:opacity-95 transition-opacity text-left"
      >
        <div className="flex-1 p-5 flex flex-col justify-center">
          <p className="font-bold text-base text-white mb-1">P2P Trading</p>
          <p className="text-xs text-white/75 leading-relaxed mb-4">Buy and sell crypto automatically. Fast and secured.</p>
          <span className="self-start bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full">P2P Trading</span>
        </div>
        <div className="flex items-end justify-end shrink-0 self-stretch">
          <Image src="/bannerImg.png" alt="P2P" width={160} height={170} className="object-contain object-right-bottom h-full w-auto" />
        </div>
      </button>

      {/* Transaction History */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base text-[#1D3B53]">Transaction history</h3>
        <button onClick={() => router.push("/history")} className="flex items-center gap-0.5 text-primary text-sm cursor-pointer">
          View More <ChevronRight size={14} />
        </button>
      </div>
      <div className="bg-white rounded-2xl p-5 text-center text-[#8E8E93] text-sm">
        No transactions yet
      </div>
    </div>
  );
}
