"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ChevronRight } from "lucide-react";
import { walletService } from "@/services/wallet.service";
import { useWallet } from "@/context/WalletContext";
import CurrencyIcon from "@/components/CurrencyIcon";

const FIAT = ["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"];

interface Coin {
  id: string;
  symbol: string;
  name: string;
}

export default function DepositSearchPage() {
  const router = useRouter();
  const { wallets } = useWallet();

  const [search, setSearch] = useState("");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCoins(); }, []);

  const fetchCoins = async () => {
    try {
      const res = await walletService.getCurrencies();
      const all = (res?.data || []) as any[];
      const filtered = all
        .filter((c: any) => !FIAT.includes((c.symbol || "").toUpperCase()))
        .map((c: any) => ({ id: String(c.id), symbol: c.symbol?.toUpperCase(), name: c.name || c.symbol }));
      setCoins(filtered);
    } catch {
      setCoins([
        { id: "", symbol: "BTC", name: "Bitcoin" },
        { id: "", symbol: "ETH", name: "Ethereum" },
        { id: "", symbol: "USDT", name: "Tether" },
        { id: "", symbol: "USDC", name: "USD Coin" },
        { id: "", symbol: "SOL", name: "Solana" },
        { id: "", symbol: "TRX", name: "Tron" },
        { id: "", symbol: "XRP", name: "XRP" },
        { id: "", symbol: "BNB", name: "BNB" },
      ]);
    } finally { setLoading(false); }
  };

  const walletBalanceMap = Object.fromEntries(
    wallets.map((w: any) => [(w.currency || "").toUpperCase(), parseFloat(w.balance || "0")])
  );

  const filtered = coins
    .filter(c =>
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (walletBalanceMap[b.symbol] || 0) - (walletBalanceMap[a.symbol] || 0));

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-4">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Search coin</span>
        <div className="w-8" />
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white border border-[#4A6679] rounded-full px-4 h-12 mb-6">
        <Search size={18} className="text-[#8E8E93] shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search coins (e.g. USDT, BTC)"
          className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-sm text-[#8E8E93] mb-2 mt-3">{search ? "Search result" : "All Coins"}</p>
          <div className="space-y-2">
            {filtered.map((coin, i) => (
              <button
                key={i}
                onClick={() => router.push(`/deposit?coin=${coin.symbol}&currencyId=${coin.id}`)}
                className="w-full flex items-center justify-between bg-white p-4 rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <CurrencyIcon symbol={coin.symbol} size={36} />
                  <div className="text-left">
                    <p className="font-bold text-sm text-gray-700">{coin.symbol}</p>
                    <p className="text-xs text-[#8E8E93]">{coin.name}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#8E8E93]" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-[#8E8E93] text-sm py-8">No coins found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
