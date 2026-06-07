"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, ChevronRight, X, Copy, CheckCircle2 } from "lucide-react";
import { walletService } from "@/services/wallet.service";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { useAds } from "@/context/AdsContext";
import CurrencyIcon from "@/components/CurrencyIcon";
import TransactionItem from "@/components/TransactionItem";
import { getFriendlyTxTitle } from "@/lib/txTitle";

const FIAT = ["NGN", "USD", "EUR", "GBP"];
const isFiat = (c: string) => FIAT.includes(c.toUpperCase());

const FIAT_CODES = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  completed:  { bg: "bg-green-100",  text: "text-green-600"  },
  confirmed:  { bg: "bg-green-100",  text: "text-green-600"  },
  pending:    { bg: "bg-yellow-100", text: "text-yellow-600" },
  processing: { bg: "bg-yellow-100", text: "text-yellow-600" },
  failed:     { bg: "bg-red-100",    text: "text-red-500"    },
  refunded:   { bg: "bg-orange-100", text: "text-orange-500" },
};

const pick = (...vals: any[]): string => {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return "-";
};

const fmtNGN = (num: any) => {
  const n = parseFloat(String(num));
  return isNaN(n) ? "-" : `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
};

function getUiType(tx: any): string {
  const t = (tx.type || "").toLowerCase();
  if (t.includes("deposit") || t.includes("received") || t.includes("credit") || t.includes("transfer_in")) return "Received";
  if (t === "withdrawal" || t.includes("transfer_out") || t.includes("debit")) return "Sent";
  if (t.includes("buy")) return "Buy";
  if (t.includes("sell")) return "Sell";
  if (t === "trade") {
    const before = parseFloat(tx.balance_before ?? "0");
    const after = parseFloat(tx.balance_after ?? "0");
    return after >= before ? "Received" : "Sent";
  }
  return tx.type || "Transfer";
}

function TxModal({ baseTx, onClose }: { baseTx: any; onClose: () => void }) {
  const router = useRouter();
  const [txDetail, setTxDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    walletService.getTransaction(baseTx.id)
      .then(data => setTxDetail(data?.data || data))
      .catch(() => setTxDetail(null))
      .finally(() => setLoading(false));
  }, [baseTx.id]);

  // Use enriched detail if available, fall back to list data
  const tx = txDetail || baseTx;

  const copyVal = async (val: string, field: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const DetailRow = ({ label, value, color, copyable }: { label: string; value: string; color?: string; copyable?: boolean }) => (
    <div>
      <div className="flex justify-between items-center py-3">
        <span className="text-sm text-[#555]">{label}</span>
        {copyable ? (
          <button onClick={() => copyVal(value, label)} className="flex items-center gap-1 cursor-pointer max-w-[60%]">
            <span className="text-sm font-medium text-primary truncate">{value}</span>
            {copiedField === label
              ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
              : <Copy size={12} className="text-primary shrink-0" />}
          </button>
        ) : (
          <span className={`text-sm font-medium text-right ${color || "text-[#1D3B53]"}`}>{value}</span>
        )}
      </div>
      <div className="h-px bg-blue-100" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {(() => {
          const currency = pick(tx?.currency, "NGN");
          const isFiatCur = FIAT_CODES.has(currency.toUpperCase());
          const method = pick(tx?.method, tx?.payment_method, "");
          const isP2P = method === "p2p_trade";
          const isOnchain = method === "onchain";
          const isBankTx = method === "bank_transfer";

          const balBeforeNum = parseFloat(String(tx?.balance_before ?? 0));
          const balAfterNum = parseFloat(String(tx?.balance_after ?? 0));
          const hasBalances = tx?.balance_before != null && tx?.balance_after != null;
          const typeStr = (tx?.type || "").toLowerCase();
          const isCredit = hasBalances
            ? balAfterNum >= balBeforeNum
            : !["withdrawal", "debit", "transfer_out", "sell"].some(k => typeStr.includes(k));
          const sign = isCredit ? "+" : "-";
          const dirColor = isCredit ? "text-green-500" : "text-red-500";

          const rawAmount = pick(tx?.amount, "0");
          const displayAmount = isFiatCur
            ? `${sign}${fmtNGN(rawAmount)}`
            : `${sign}${rawAmount} ${currency}`;
          const status = pick(tx?.status, "pending");
          const statusStyle = STATUS_COLOR[status.toLowerCase()] || { bg: "bg-red-100", text: "text-red-500" };
          const title = getFriendlyTxTitle(tx);

          const receipt = tx?.receipt || {};
          const txHash = pick(receipt?.tx_hash, tx?.tx_hash);
          const network = pick(receipt?.network, tx?.network);
          const address = pick(receipt?.address, tx?.address);
          const bankName = pick(receipt?.bank_name, tx?.bank_name);
          const accountNumber = pick(receipt?.account_number, tx?.account_number);
          const feeNum = parseFloat(pick(tx?.fee, tx?.fee_amount, "0")) || 0;
          const feeDisplay = isFiatCur ? fmtNGN(feeNum) : `${feeNum} ${currency}`;
          const orderNumber = pick(tx?.order_number, tx?.reference, tx?.id);
          const orderTime = tx?.created_at ? new Date(tx.created_at).toLocaleString() : "-";

          const methodLabel: Record<string, string> = {
            onchain: "On-Chain", bank_transfer: "Bank Transfer",
            p2p_trade: "P2P Trade", internal_transfer: "Internal Transfer",
            referral_reward: "Referral Reward",
          };

          return (
            <>
              <div className="flex items-start mb-4">
                <div className="w-7 shrink-0" />
                <h3 className="font-bold text-lg text-[#1D3B53] leading-tight flex-1 text-center">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center mb-5">
                <p className="text-sm text-[#8E8E93] mb-1">{isCredit ? "Credited" : "Debited"}</p>
                <p className={`text-2xl font-bold ${dirColor} mb-2`}>{displayAmount}</p>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>

              <p className="text-sm font-bold text-[#1D3B53] mb-2">Transaction Details</p>
              <div className="bg-[#EBF4FF] rounded-2xl p-4 mb-5">
                {isP2P && tx?.counterparty?.name && <DetailRow label="Counterparty:" value={tx.counterparty.name} />}
                {isOnchain && address !== "-" && <DetailRow label="Address:" value={address} copyable />}
                {isOnchain && network !== "-" && <DetailRow label="Network:" value={network.toUpperCase()} />}
                {isOnchain && txHash !== "-" && <DetailRow label="Tx Hash:" value={txHash} copyable />}
                {isBankTx && bankName !== "-" && <DetailRow label="Bank:" value={bankName} />}
                {isBankTx && accountNumber !== "-" && <DetailRow label="Account:" value={accountNumber} />}
                {feeNum > 0 && <DetailRow label="Fee:" value={feeDisplay} />}
                <DetailRow label="Method:" value={methodLabel[method] || method} color="text-primary" />
                <DetailRow label="Order No.:" value={orderNumber} copyable />
                <DetailRow label="Time:" value={orderTime} />
                {hasBalances && (
                  <DetailRow label="Balance Before:" value={isFiatCur ? fmtNGN(tx.balance_before) : `${tx.balance_before} ${currency}`} />
                )}
                {hasBalances && (
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm text-[#555]">Balance After:</span>
                    <span className="text-sm font-bold text-green-500">
                      {isFiatCur ? fmtNGN(tx.balance_after) : `${tx.balance_after} ${currency}`}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => { onClose(); router.push("/wallet"); }}
                className="w-full bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer hover:bg-primary/90 transition-colors"
              >
                Go to wallet
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function AssetDetailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = params.get("symbol") || "BTC";
  const { getWalletByCurrency } = useWallet();
  const { user } = useAuth();
  const { ads } = useAds();
  const wallet = getWalletByCurrency(symbol);
  const balance = parseFloat(String(wallet?.balance || params.get("balance") || "0"));
  const currencyId = wallet?.currency_id ? String(wallet.currency_id) : "";
  const fiat = isFiat(symbol);

  // Compute locked from active ads (same logic as wallet page)
  const locked = ads.filter(a => a.active).reduce((sum, a) => {
    const key = (a.type === "Sell" ? a.asset : a.fiat).toUpperCase();
    if (key !== symbol.toUpperCase()) return sum;
    return sum + (parseFloat(a.remainingQuantity || "0") || parseFloat(a.totalQuantity || "0"));
  }, 0);
  const available = Math.max(0, balance - locked);

  const [txs, setTxs] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  useEffect(() => {
    walletService.getTransactions(symbol)
      .then(r => {
        const sorted = (r.data || []).slice().sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTxs(sorted);
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [symbol]);

  const handleDeposit = () => {
    if (fiat) {
      router.push("/deposit-fiat");
    } else {
      router.push(`/deposit?coin=${symbol}&currencyId=${currencyId}`);
    }
  };

  const handleSend = () => {
    if (fiat) {
      router.push("/withdraw-fiat");
    } else {
      router.push(`/withdraw-crypto?symbol=${symbol}&currency_id=${currencyId}`);
    }
  };

  const actions = [
    { label: "Deposit", icon: "/depositIconv2.png", onPress: handleDeposit },
    { label: "Send",    icon: "/sendIcon.png",    onPress: handleSend },
    { label: "Buy",     icon: "/buyIcon.png",     onPress: () => router.push("/p2p") },
    { label: "Sell",    icon: "/sellIcon.png",    onPress: () => router.push("/p2p") },
  ];

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-2 py-4 mb-4">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer shrink-0">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <span className="md:hidden flex-1 text-center font-bold text-base text-[#1D3B53]">{symbol}</span>
        <div className="md:hidden w-8 shrink-0" />
        <div className="hidden md:flex items-center gap-1.5">
          <span
            onClick={() => router.push("/wallet")}
            className="text-sm text-gray-400 cursor-pointer hover:text-primary transition-colors"
          >
            Wallet
          </span>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm font-semibold text-[#1D3B53]">{symbol}</span>
        </div>
      </div>

      {/* Balance + Actions Card */}
      <div className="bg-gradient-to-b from-[#EDF2FA] to-white rounded-3xl p-6 md:p-8 mb-5">
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm font-semibold text-[#1D3B53]">Total Assets</span>
            <button onClick={() => setHidden(!hidden)} className="cursor-pointer">
              {hidden ? <EyeOff size={14} className="text-gray-500" /> : <Eye size={14} className="text-gray-500" />}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <CurrencyIcon symbol={symbol} size={36} />
            <span className="text-4xl font-bold text-[#1D3B53]">
              {hidden ? "****" : balance.toFixed(fiat ? 2 : 6)}
            </span>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xs text-[#8E8E93] mb-0.5">Available</p>
              <p className="text-sm font-semibold text-green-600">
                {hidden ? "****" : available.toFixed(fiat ? 2 : 6)}
              </p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-[#8E8E93] mb-0.5">Locked</p>
              <p className="text-sm font-semibold text-orange-500">
                {hidden ? "****" : locked.toFixed(fiat ? 2 : 6)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-8 md:gap-16">
          {actions.map(a => (
            <button key={a.label} onClick={a.onPress} className="flex flex-col items-center gap-2 cursor-pointer">
              <div className="w-14 h-14 rounded-full bg-[#EBF4FF] flex items-center justify-center hover:bg-[#D6EAFF] transition-colors">
                <Image src={a.icon} alt={a.label} width={28} height={28} className="object-contain" />
              </div>
              <span className="text-xs text-[#1D3B53] font-medium">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* P2P Banner */}
      <button
        onClick={() => router.push("/p2p")}
        className="xl:hidden w-full rounded-2xl overflow-hidden mb-5 flex items-stretch cursor-pointer bg-gradient-to-br from-[#4472B7] to-[#2d5a9e] shadow-md hover:opacity-95 transition-opacity text-left"
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
        <button onClick={() => router.push("/history")} className="flex items-center gap-0.5 text-primary text-sm cursor-pointer hover:underline">
          View More <ChevronRight size={14} />
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        {txLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : txs.length === 0 ? (
          <p className="text-center text-[#8E8E93] text-sm py-10">No transactions found</p>
        ) : (
          txs.map((tx: any, i: number) => {
            const balBefore = parseFloat(String(tx.balance_before ?? 0));
            const balAfter = parseFloat(String(tx.balance_after ?? 0));
            const hasBalances = tx.balance_before != null && tx.balance_after != null;
            const debitKws = ["withdrawal", "debit", "transfer_out", "sell"];
            const credit = hasBalances
              ? balAfter >= balBefore
              : !debitKws.some(k => (tx.type || "").toLowerCase().includes(k));
            const rawAmt = parseFloat(String(tx.amount || 0));
            const sign = credit ? "+" : "-";
            const formattedAmt = fiat
              ? `${sign}₦${rawAmt.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
              : `${sign}${rawAmt} ${symbol}`;
            return (
              <div
                key={i}
                onClick={() => setSelectedTx(tx)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <TransactionItem
                  type={getUiType(tx)}
                  asset={symbol}
                  amount={formattedAmt}
                  date={new Date(tx.created_at).toLocaleDateString()}
                  status={tx.status || "completed"}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <TxModal baseTx={selectedTx} onClose={() => setSelectedTx(null)} />
      )}
    </div>
  );
}

export default function AssetDetailPage() {
  return <Suspense><AssetDetailContent /></Suspense>;
}
