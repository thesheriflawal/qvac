"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { useAds } from "@/context/AdsContext";
import { walletService } from "@/services/wallet.service";
import {
  Eye, EyeOff, Search, AlertTriangle,
  X, Building2, ArrowRightLeft, ChevronRight, Copy, CheckCircle2, Users, Download,
} from "lucide-react";
import DepositModal from "@/components/modals/DepositModal";
import CurrencyIcon from "@/components/CurrencyIcon";
import { useVerificationGate } from "@/hooks/useVerificationGate";

const FIAT = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);
const isFiatCode = (c: string) => FIAT.has((c || "").toUpperCase());

const STABLE_USD: Record<string, number> = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1 };

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", USDT: "Tether", USDC: "USD Coin",
  SOL: "Solana", TRX: "Tron", XRP: "XRP", BNB: "BNB",
  NGN: "Nigerian Naira", USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
};

/* ─── Fiat deposit modal (matches crypto DepositModal style) ──────── */
function FiatDepositModal({ uid, onClose, onBankTransfer }: { uid: string; onClose: () => void; onBankTransfer: () => void }) {
  const [copiedUid, setCopiedUid] = useState(false);
  const copyUid = () => {
    if (uid) { navigator.clipboard.writeText(uid); setCopiedUid(true); setTimeout(() => setCopiedUid(false), 2000); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg">Choose Your Preferred Option</h3>
          <button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-3">
          {/* Bank Transfer */}
          <button
            onClick={onBankTransfer}
            className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <Download size={18} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm mb-0.5">Deposit via Bank Transfer</p>
              <p className="text-xs text-gray-500 leading-relaxed">Fund your NGN wallet by transferring from your bank account.</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </button>

          {/* Receive from another user */}
          <div className="w-full flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Users size={18} className="text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-0.5">Receive from another Kynettic user</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                Share your UID to get funds sent straight to your wallet in seconds.
              </p>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                <div>
                  <span className="text-xs text-gray-400">UID: </span>
                  <span className="text-xs font-mono text-gray-700">{uid || "—"}</span>
                </div>
                <button onClick={copyUid} className="text-primary cursor-pointer ml-2 shrink-0">
                  {copiedUid ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Fiat withdraw bottom-sheet ──────────────────────────────────── */
function FiatWithdrawSheet({ onClose, onBank, onInternal }: { onClose: () => void; onBank: () => void; onInternal: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-base text-[#1D3B53]">Withdraw NGN</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { icon: <Building2 size={18} className="text-primary" />, label: "Bank Withdrawal", desc: "Withdraw NGN directly to your bank account", action: onBank },
            { icon: <ArrowRightLeft size={18} className="text-primary" />, label: "Internal Transfer", desc: "Transfer NGN to another Kynettic user instantly", action: onInternal },
          ].map((opt, i) => (
            <button key={i} onClick={opt.action}
              className="w-full flex items-center gap-4 p-4 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl cursor-pointer hover:bg-[#EBF4FF] hover:border-primary transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[#EBF4FF] flex items-center justify-center shrink-0">{opt.icon}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1D3B53]">{opt.label}</p>
                <p className="text-xs text-[#8E8E93]">{opt.desc}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </button>
          ))}

          <button onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────── */
export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallets, loading, fetchWallets } = useWallet();
  const { ads } = useAds();

  // Compute locked amounts from active ads (backend locked_balance is unreliable due to total_quantity=0 bug)
  // Sell ads lock crypto asset; Buy ads lock fiat (NGN)
  const adLocked: Record<string, number> = {};
  ads.filter(a => a.active).forEach(a => {
    const qty = parseFloat(a.remainingQuantity || "0") || parseFloat(a.totalQuantity || "0");
    if (qty <= 0) return;
    const key = (a.type === "Sell" ? a.asset : a.fiat).toUpperCase();
    adLocked[key] = (adLocked[key] || 0) + qty;
  });
  const [viewMode, setViewMode] = useState<"Crypto" | "Fiat">("Crypto");
  const [hidden, setHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [fiatDepositSheet, setFiatDepositSheet] = useState(false);
  const [fiatWithdrawSheet, setFiatWithdrawSheet] = useState(false);
  const uid = (user as Record<string, any>)?.uid || "";
  const { isVerified, requireVerification, showGate, setShowGate } = useVerificationGate();
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => { fetchWallets(); }, []);

  useEffect(() => {
    const allCryptoWallets = wallets.filter((w: any) => !isFiatCode(w.currency) && w.currency);
    if (!allCryptoWallets.length) return;
    setPriceLoading(true);
    Promise.allSettled(
      allCryptoWallets.map((w: any) => {
        const symbol = (w.currency || "").toUpperCase();
        return fetch(`/api/market-price?symbol=${symbol}&format=usd`)
          .then(r => r.json())
          .then(data => ({ currency: symbol, raw: parseFloat(data?.price || "0") || 0 }));
      })
    ).then(results => {
      const map: Record<string, number> = {};
      results.forEach((r: any) => { if (r.status === "fulfilled") map[r.value.currency] = r.value.raw; });
      setCryptoPrices(map);
    }).finally(() => setPriceLoading(false));
  }, [wallets]);

  const resolvePrice = (c: string) => STABLE_USD[c] ?? cryptoPrices[c] ?? 0;

  const filtered = wallets
    .filter((w: any) => viewMode === "Fiat" ? isFiatCode(w.currency) : !isFiatCode(w.currency))
    .filter((w: any) => (w.currency || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      const aBal = parseFloat(String(a.balance || 0));
      const bBal = parseFloat(String(b.balance || 0));
      const aVal = aBal * (isFiatCode(a.currency) ? 1 : resolvePrice(a.currency));
      const bVal = bBal * (isFiatCode(b.currency) ? 1 : resolvePrice(b.currency));
      return bVal - aVal;
    });

  const cryptoTotal = wallets
    .filter((w: any) => !isFiatCode(w.currency))
    .reduce((sum: number, w: any) => sum + parseFloat(String(w.balance || 0)) * resolvePrice(w.currency), 0);

  const ngnWallet = wallets.find((w: any) => (w.currency || "").toUpperCase() === "NGN");
  const ngnBalance = parseFloat(String(ngnWallet?.balance || 0));

  const totalDisplay = viewMode === "Fiat"
    ? `₦${ngnBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
    : priceLoading ? "..." : `$${cryptoTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const handleDeposit = () => {
    requireVerification(() => {
      if (viewMode === "Fiat") setFiatDepositSheet(true);
      else setDepositOpen(true);
    });
  };

  const handleWithdraw = () => {
    requireVerification(() => {
      if (viewMode === "Fiat") setFiatWithdrawSheet(true);
      else router.push("/withdraw-search");
    });
  };

  return (
    <div>
      {/* Crypto / Fiat toggle */}
      <div className="flex justify-center md:justify-start mb-6">
        <div className="flex bg-[#E2E8F0] rounded-full p-1 gap-1">
          {(["Crypto", "Fiat"] as const).map(t => (
            <button
              key={t}
              onClick={() => setViewMode(t)}
              className={`px-8 py-2 rounded-full text-sm font-semibold cursor-pointer transition-all ${
                viewMode === t ? "bg-white text-primary shadow-sm" : "text-[#8E8E93]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KYC warning */}
      {!isVerified && (
        <button
          onClick={() => router.push("/verification-dashboard")}
          className="w-full flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-3 mb-4 cursor-pointer hover:bg-red-100"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-bold text-red-600">Verify Your Account</p>
              <p className="text-xs text-red-500">You need to verify to use all features</p>
            </div>
          </div>
          <span className="text-primary text-sm font-semibold shrink-0">Verify →</span>
        </button>
      )}

      {/* Balance card */}
      <div
        className="rounded-3xl p-6 text-white mb-5 overflow-hidden"
        style={{
          backgroundColor: "#4472B7",
          backgroundImage: "url('/waves.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* Balance info */}
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-sm opacity-80">Total Assets</span>
              <button onClick={() => setHidden(h => !h)} className="cursor-pointer opacity-80">
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-3xl font-bold mb-1 text-center md:text-left">{hidden ? "****" : totalDisplay}</p>
            <p className="text-sm opacity-70 text-center md:text-left">{viewMode === "Fiat" ? "NGN Balance" : "Crypto Balance"}</p>
          </div>
          {/* Action buttons — always a row */}
          <div className="flex gap-3 shrink-0 pt-2 md:pt-0">
            <button
              onClick={handleDeposit}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-primary border border-white py-2.5 px-6 rounded-full text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Image src="/depositIconv2.png" alt="" width={16} height={16} className="object-contain w-auto h-auto" />
              Deposit
            </button>
            <button
              onClick={handleWithdraw}
              className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 border border-white/40 py-2.5 px-6 rounded-full text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap"
            >
              <Image src="/withdrawIcon.png" alt="" width={16} height={16} className="object-contain w-auto h-auto" />
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* P2P Banner — hidden on desktop where the right sidebar already shows it */}
      <button
        onClick={() => requireVerification(() => router.push("/p2p"))}
        className="xl:hidden w-full rounded-2xl overflow-hidden mb-6 flex items-stretch cursor-pointer bg-gradient-to-br from-[#4472B7] to-[#2d5a9e] shadow-md hover:opacity-95 transition-all text-left"
      >
        <div className="flex-1 p-5 flex flex-col justify-center">
          <p className="font-bold text-base text-white mb-1">P2P Trading</p>
          <p className="text-xs text-white/75 leading-relaxed mb-4">
            Buy and sell crypto automatically on the P2P market. Fast and secured.
          </p>
          <span className={`self-start bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all ${!isVerified ? "grayscale opacity-60" : ""}`}>
            P2P Trading
          </span>
        </div>
        <div className="flex items-end justify-end shrink-0 self-stretch">
          <Image src="/bannerImg.png" alt="P2P Trading" width={170} height={180} className="object-contain object-right-bottom h-full w-auto" />
        </div>
      </button>

      {/* Holdings */}
      <div className="bg-white rounded-2xl p-5">
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-[#1D3B53]">{viewMode} Holdings</h2>
            {/* Compact search — mobile/tablet only */}
            <div className="relative md:hidden">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="pl-8 pr-3 py-2 bg-gray-50 rounded-xl text-sm w-32 sm:w-44 outline-none"
              />
            </div>
          </div>
          {/* Full-width search — desktop only */}
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={viewMode === "Fiat" ? "Example NGN, USD, GHS etc" : "Example BTC, ETH, XRP etc"}
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#8E8E93] text-center py-10 text-sm">No assets found</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((w: any, i: number) => {
              const balance = parseFloat(String(w.balance || 0));
              const locked = adLocked[w.currency?.toUpperCase()] || 0;
              const available = Math.max(0, balance - locked);
              const unitPrice = resolvePrice(w.currency);
              const isFiat = isFiatCode(w.currency);
              const fullName = CURRENCY_NAMES[w.currency] || w.currency;
              const usdVal = balance * unitPrice;
              return (
                <button
                  key={i}
                  onClick={() => router.push(`/asset-detail?symbol=${w.currency}&balance=${balance}&currency_id=${w.currency_id || ""}`)}
                  className="flex items-center justify-between py-3.5 w-full hover:bg-gray-50 rounded-xl px-2 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <CurrencyIcon symbol={w.currency} size={38} />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#1D3B53]">{w.currency}</p>
                      <p className="text-xs text-[#8E8E93]">
                        {fullName}
                        {locked > 0 && !hidden && (
                          <span className="ml-1 text-orange-400">· {locked.toFixed(isFiat ? 2 : 6).replace(/\.?0+$/, "")} locked</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1D3B53]">
                      {hidden ? "****" : isFiat
                        ? `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                        : balance.toFixed(6).replace(/\.?0+$/, "") || "0"}
                    </p>
                    <p className="text-xs text-[#8E8E93]">
                      {hidden ? "****" : isFiat
                        ? `₦${available.toLocaleString("en-NG", { minimumFractionDigits: 2 })} avail.`
                        : usdVal > 0
                          ? `$${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : unitPrice === 0 && balance > 0 ? "—" : "$0.00"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit modal — crypto */}
      <DepositModal visible={depositOpen} onClose={() => setDepositOpen(false)} mode="crypto" uid={uid} />

      {/* Deposit modal — fiat (centered, matches crypto modal style) */}
      {fiatDepositSheet && (
        <FiatDepositModal
          uid={uid}
          onClose={() => setFiatDepositSheet(false)}
          onBankTransfer={() => { setFiatDepositSheet(false); router.push("/deposit-fiat"); }}
        />
      )}

      {/* Withdraw options — fiat (bottom-sheet) */}
      {fiatWithdrawSheet && (
        <FiatWithdrawSheet
          onClose={() => setFiatWithdrawSheet(false)}
          onBank={() => { setFiatWithdrawSheet(false); router.push("/withdraw-fiat"); }}
          onInternal={() => { setFiatWithdrawSheet(false); router.push("/fiat-internal-transfer"); }}
        />
      )}
    </div>
  );
}
