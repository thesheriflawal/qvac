"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { walletService } from "@/services/wallet.service";
import { p2pService } from "@/services/p2p.service";
import { SlidersHorizontal, ArrowDown, ArrowUp, FolderOpen, X, Copy, CheckCircle2, ChevronDown } from "lucide-react";
import { getFriendlyTxTitle } from "@/lib/txTitle";

const PLATFORM_ICONS: Record<string, string> = {
  telegram:  "https://cdn.simpleicons.org/telegram/229ED9",
  whatsapp:  "https://cdn.simpleicons.org/whatsapp/25D366",
  twitter:   "https://cdn.simpleicons.org/x/000000",
  x:         "https://cdn.simpleicons.org/x/000000",
  instagram: "https://cdn.simpleicons.org/instagram/E1306C",
  discord:   "https://cdn.simpleicons.org/discord/5865F2",
  facebook:  "https://cdn.simpleicons.org/facebook/1877F2",
  youtube:   "https://cdn.simpleicons.org/youtube/FF0000",
};

const PROMO_CARDS = [
  { title: "Click here to Buy Bulk Coins", desc: "Purchase large coin amounts directly from us.", href: "/bulk-coins-purchase", bg: "bg-gradient-to-br from-[#4472B7] to-[#2d5a9e]", image: "/crypto-tokens.png" },
  { title: "P2P Trading", desc: "Buy and sell crypto automatically on the P2P market. Fast and secured.", href: "/p2p", bg: "bg-gradient-to-br from-[#4472B7] to-[#355f9e]", image: "/bannerImg.png" },
];

const FIAT = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);
const CATEGORY_OPTIONS = ["All", "Deposit", "Withdrawal", "P2P", "Transfer"];
const TIME_RANGES = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];
const PAGE_SIZE = 20;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-100", text: "text-green-600" },
  confirmed: { bg: "bg-green-100", text: "text-green-600" },
  pending:   { bg: "bg-yellow-100", text: "text-yellow-600" },
  processing:{ bg: "bg-yellow-100", text: "text-yellow-600" },
  failed:    { bg: "bg-red-100", text: "text-red-500" },
};

function getTxIsIncoming(tx: any): boolean {
  const type = (tx.type || tx.category || "").toLowerCase();
  if (type.includes("deposit") || type.includes("_in") || type.includes("credit") || type.includes("buy")) return true;
  if (type.includes("withdraw") || type.includes("_out") || type.includes("debit") || type.includes("sell")) return false;
  if (tx.balance_before != null && tx.balance_after != null) {
    return parseFloat(tx.balance_after) >= parseFloat(tx.balance_before);
  }
  return true;
}

function getCategoryApiValue(category: string, viewMode: "Crypto" | "Fiat"): string | undefined {
  if (category === "All") return undefined;
  if (category === "Deposit") return viewMode === "Fiat" ? "fiat_deposit" : "crypto_deposit";
  if (category === "Withdrawal") return viewMode === "Fiat" ? "fiat_withdrawal" : "crypto_withdrawal";
  if (category === "P2P") return "p2p_trade";
  if (category === "Transfer") return "transfer";
  return undefined;
}

function getDateParams(timeRange: string, startDate: string, endDate: string): { startDate?: string; endDate?: string } {
  if (startDate || endDate) {
    return { startDate: startDate || undefined, endDate: endDate || undefined };
  }
  if (timeRange === "30d") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { startDate: d.toISOString().split("T")[0] };
  }
  if (timeRange === "90d") {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return { startDate: d.toISOString().split("T")[0] };
  }
  return {};
}

const fmtNGN = (num: any) => {
  const n = parseFloat(String(num));
  return isNaN(n) ? "-" : `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
};
const pick = (...vals: any[]): string => {
  for (const v of vals) { if (v !== null && v !== undefined && String(v).trim() !== "") return String(v); }
  return "-";
};

function FilterControls({
  category, setCategory,
  timeRange, setTimeRange,
  startDate, setStartDate,
  endDate, setEndDate,
  onReset, onApply,
  compact,
}: {
  category: string; setCategory: (v: string) => void;
  timeRange: string; setTimeRange: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  onReset: () => void; onApply: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {/* Category */}
      <div>
        <label className="text-xs font-semibold text-[#1D3B53] block mb-2">Category</label>
        <div className="relative">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#1D3B53] bg-white cursor-pointer focus:outline-none focus:border-primary pr-8"
          >
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Currency */}
      <div>
        <label className="text-xs font-semibold text-[#1D3B53] block mb-2">Currency</label>
        <div className="relative">
          <select
            disabled
            className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#8E8E93] bg-[#F8F8F8] cursor-not-allowed pr-8"
          >
            <option>All</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Time range chips */}
      <div>
        <label className="text-xs font-semibold text-[#1D3B53] block mb-2">Time Range</label>
        <div className="flex gap-2">
          {TIME_RANGES.map(tr => {
            const isActive = timeRange === tr.value && !startDate && !endDate;
            return (
              <button
                key={tr.value}
                onClick={() => { setTimeRange(tr.value); setStartDate(""); setEndDate(""); }}
                className={`flex-1 py-2 rounded-xl text-xs font-medium cursor-pointer border transition-all ${isActive ? "bg-primary text-white border-primary" : "bg-white text-[#8E8E93] border-gray-200"}`}
              >
                {tr.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div>
        <label className="text-xs font-semibold text-[#1D3B53] block mb-2">Date Range</label>
        <div className="flex flex-col gap-2">
          <div className="min-w-0">
            <label className="text-[10px] text-[#8E8E93] block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full min-w-0 border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-[#1D3B53] focus:outline-none focus:border-primary cursor-pointer"
            />
          </div>
          <div className="min-w-0">
            <label className="text-[10px] text-[#8E8E93] block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full min-w-0 border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-[#1D3B53] focus:outline-none focus:border-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onReset}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-[#1D3B53] cursor-pointer hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onApply}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"Crypto" | "Fiat">("Crypto");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [txDetail, setTxDetail] = useState<any>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [communityLinks, setCommunityLinks] = useState<any[]>([]);

  // Applied filters (what the API is called with)
  const [appliedCategory, setAppliedCategory] = useState("All");
  const [appliedTimeRange, setAppliedTimeRange] = useState("7d");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  // Pending filters — shared between desktop sidebar and mobile sheet
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState("All");
  const [pendingTimeRange, setPendingTimeRange] = useState("7d");
  const [pendingStartDate, setPendingStartDate] = useState("");
  const [pendingEndDate, setPendingEndDate] = useState("");

  useEffect(() => { loadPage(1, true); }, [viewMode, appliedCategory, appliedTimeRange, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    const t = setInterval(() => setCardIndex(p => (p + 1) % PROMO_CARDS.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    p2pService.getCommunityLinks()
      .then(res => setCommunityLinks(res?.data || []))
      .catch(() => {});
  }, []);

  const loadPage = async (p: number, reset = false) => {
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const currency = viewMode === "Fiat" ? "NGN" : undefined;
      const apiCategory = getCategoryApiValue(appliedCategory, viewMode);
      const { startDate, endDate } = getDateParams(appliedTimeRange, appliedStartDate, appliedEndDate);
      const res = await walletService.getTransactions(currency, p, PAGE_SIZE, apiCategory, startDate, endDate);
      const newTxs = res.data || [];
      const pagination = res.pagination || {};
      setTotalPages(pagination.total_pages || 1);
      setPage(p);
      setTransactions(prev => reset ? newTxs : [...prev, ...newTxs]);
    } catch {} finally { setLoading(false); setLoadingMore(false); }
  };

  const filtered = transactions.filter(tx => {
    if (viewMode === "Crypto" && FIAT.has((tx.currency || "").toUpperCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const groups: { date: string; items: any[] }[] = [];
  const seen: Record<string, number> = {};
  sorted.forEach(tx => {
    const key = new Date(tx.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    if (seen[key] === undefined) { seen[key] = groups.length; groups.push({ date: key, items: [] }); }
    groups[seen[key]].items.push(tx);
  });

  const hasFilter = appliedCategory !== "All" || appliedTimeRange !== "7d" || appliedStartDate !== "" || appliedEndDate !== "";

  const openFilter = () => {
    setPendingCategory(appliedCategory);
    setPendingTimeRange(appliedTimeRange);
    setPendingStartDate(appliedStartDate);
    setPendingEndDate(appliedEndDate);
    setFilterOpen(true);
  };

  const handleReset = () => {
    setPendingCategory("All");
    setPendingTimeRange("7d");
    setPendingStartDate("");
    setPendingEndDate("");
  };

  const handleApply = () => {
    setAppliedCategory(pendingCategory);
    setAppliedTimeRange(pendingTimeRange);
    setAppliedStartDate(pendingStartDate);
    setAppliedEndDate(pendingEndDate);
    setFilterOpen(false);
  };

  // Desktop sidebar: apply immediately when user clicks Apply
  const handleDesktopApply = () => {
    setAppliedCategory(pendingCategory);
    setAppliedTimeRange(pendingTimeRange);
    setAppliedStartDate(pendingStartDate);
    setAppliedEndDate(pendingEndDate);
  };

  return (
    <div className="flex gap-6 w-full pb-10">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-[#1D3B53]">Transaction History</h1>
          {/* Filter button — mobile only */}
          <div className="relative xl:hidden">
            <button onClick={openFilter} className="text-primary cursor-pointer p-1">
              <SlidersHorizontal size={22} />
            </button>
            {hasFilter && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
          </div>
        </div>

        {/* Crypto / Fiat toggle */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex bg-[#E1E9F2] rounded-2xl p-1">
            {(["Crypto", "Fiat"] as const).map(t => (
              <button key={t} onClick={() => setViewMode(t)}
                className={`px-6 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all ${viewMode === t ? "bg-white shadow text-primary" : "text-[#8E8E93]"}`}>
                {t}
              </button>
            ))}
          </div>
          {hasFilter && (
            <button
              onClick={() => { setAppliedCategory("All"); setAppliedTimeRange("7d"); setAppliedStartDate(""); setAppliedEndDate(""); setPendingCategory("All"); setPendingTimeRange("7d"); setPendingStartDate(""); setPendingEndDate(""); }}
              className="flex items-center gap-1 bg-[#EBF4FF] border border-primary rounded-xl px-3 py-1.5 text-xs text-primary font-medium cursor-pointer"
            >
              Clear filters ✕
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <FolderOpen size={64} className="text-primary opacity-40 mb-3" />
            <p className="text-[#8E8E93] text-base">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {groups.map(group => (
              <div key={group.date}>
                <p className="text-xs font-semibold text-[#8E8E93] mt-4 mb-2">{group.date}</p>
                {group.items.map((tx, i) => {
                  const isIncoming = getTxIsIncoming(tx);
                  const isFiatCur = FIAT.has((tx.currency || "").toUpperCase());
                  const amount = isFiatCur
                    ? `₦${parseFloat(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                    : `${tx.amount} ${tx.currency}`;
                  const normalizedStatus = ["unknown", ""].includes((tx.status || "").toLowerCase()) ? "completed" : (tx.status || "").toLowerCase();
                  const statusStyle = STATUS_COLOR[normalizedStatus] || { bg: "bg-red-100", text: "text-red-500" };
                  const txMethod = (tx.method || tx.payment_method || "").toLowerCase();
                  const txType = (tx.type || "").toLowerCase();
                  const rawLabel = (tx.label || tx.type || "Transfer").toLowerCase();
                  const label = (txMethod === "bonus" || txType === "bonus")
                    ? "First Trade Bonus"
                    : (txType === "referral_claim" || rawLabel === "referral_claim" || txMethod === "referral_reward" || txType.includes("referral"))
                    ? "Referral Reward"
                    : tx.label || tx.type || "Transfer";
                  const time = new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={i} onClick={() => {
                      setSelectedTx(tx);
                      setTxDetail(null);
                      setTxLoading(true);
                      walletService.getTransaction(tx.id)
                        .then(data => setTxDetail(data?.data || data))
                        .catch(() => setTxDetail(null))
                        .finally(() => setTxLoading(false));
                    }}
                      className="flex items-center bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl p-3 mb-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white border border-[#E5E5EA] flex items-center justify-center mr-3 shrink-0">
                        {isIncoming
                          ? <ArrowDown size={20} className="text-green-500" />
                          : <ArrowUp size={20} className="text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1D3B53] truncate">{label}</p>
                        <p className="text-xs text-[#8E8E93]">{time}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className={`text-sm font-bold ${isIncoming ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                          {isIncoming ? "+" : "-"}{amount}
                        </p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                          {normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {page < totalPages && (
              <div className="flex justify-center pt-4">
                <button onClick={() => loadPage(page + 1)} disabled={loadingMore}
                  className="text-primary font-semibold text-sm cursor-pointer disabled:opacity-50 px-6 py-2 bg-[#EBF4FF] rounded-xl">
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop filter sidebar ── */}
      <aside className="w-[320px] shrink-0 hidden xl:block">
        <div className="sticky top-6 space-y-4 bg-[#DAE3F1] p-5 rounded-2xl">
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-5">
              <SlidersHorizontal size={16} className="text-primary" />
              <span className="font-bold text-[#1D3B53] text-sm">Filter</span>
            </div>
            <FilterControls
              category={pendingCategory} setCategory={setPendingCategory}
              timeRange={pendingTimeRange} setTimeRange={setPendingTimeRange}
              startDate={pendingStartDate} setStartDate={setPendingStartDate}
              endDate={pendingEndDate} setEndDate={setPendingEndDate}
              onReset={handleReset}
              onApply={handleDesktopApply}
              compact
            />
          </div>

          {/* Rotating promo card */}
          {(() => {
            const c = PROMO_CARDS[cardIndex];
            return (
              <div className={`${c.bg} rounded-2xl p-6 text-white text-center`}>
                <div className="w-32 h-32 mx-auto mb-4">
                  <img src={c.image} alt="" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-bold text-lg mb-2">{c.title}</h3>
                <p className="text-white/80 text-sm mb-4">{c.desc}</p>
                <Link href={c.href} className="inline-flex items-center gap-1 bg-white text-gray-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-100">
                  {c.title.includes("Bulk") ? "Click Here" : "P2P Trading"} &rsaquo;
                </Link>
              </div>
            );
          })()}

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5">
            {PROMO_CARDS.map((_, idx) => (
              <button key={idx} onClick={() => setCardIndex(idx)} className={`w-2 h-2 rounded-full cursor-pointer ${idx === cardIndex ? "bg-primary" : "bg-gray-300"}`} />
            ))}
          </div>

          {/* Community links */}
          {communityLinks.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#1D3B53] shrink-0">Join our community:</span>
              {communityLinks.map((link: any) => {
                const platform = (link.platform || "").toLowerCase();
                const iconUrl = PLATFORM_ICONS[platform];
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label || link.platform}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer shrink-0"
                  >
                    {iconUrl && <img src={iconUrl} alt={platform} className="w-4 h-4 object-contain" />}
                    {link.label || link.platform}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile filter bottom sheet ── */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 xl:hidden" onClick={() => setFilterOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-[#1D3B53]">Filter</h3>
              <button onClick={() => setFilterOpen(false)} className="text-gray-400 cursor-pointer hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <FilterControls
              category={pendingCategory} setCategory={setPendingCategory}
              timeRange={pendingTimeRange} setTimeRange={setPendingTimeRange}
              startDate={pendingStartDate} setStartDate={setPendingStartDate}
              endDate={pendingEndDate} setEndDate={setPendingEndDate}
              onReset={handleReset}
              onApply={handleApply}
            />
          </div>
        </div>
      )}

      {/* ── Transaction Detail Modal ── */}
      {selectedTx && (() => {
        const tx = txDetail || selectedTx;
        const currency = pick(tx?.currency, "NGN");
        const isFiatCur = FIAT.has(currency.toUpperCase());
        const method = pick(tx?.method, tx?.payment_method, "");
        const isP2P = method === "p2p_trade";
        const isOnchain = method === "onchain";
        const isBankTx = method === "bank_transfer";

        const balBeforeNum = parseFloat(String(tx?.balance_before ?? 0));
        const balAfterNum = parseFloat(String(tx?.balance_after ?? 0));
        const hasBalances = tx?.balance_before != null && tx?.balance_after != null;
        const typeStr = (tx?.type || "").toLowerCase();
        const isCredit = hasBalances ? balAfterNum >= balBeforeNum : !["withdrawal","debit","transfer_out","sell"].some(k => typeStr.includes(k));
        const sign = isCredit ? "+" : "-";
        const dirColor = isCredit ? "text-green-500" : "text-red-500";

        const rawAmount = pick(tx?.amount, "0");
        const displayAmount = isFiatCur ? `${sign}${fmtNGN(rawAmount)}` : `${sign}${rawAmount} ${currency}`;
        const rawStatus = pick(tx?.status, "processing");
        const status = ["unknown", ""].includes(rawStatus.toLowerCase()) ? "completed" : rawStatus;
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
        const isDebit = !isCredit;
        const p2pFeeRaw = isP2P && isDebit && hasBalances
          ? balBeforeNum - balAfterNum - parseFloat(rawAmount)
          : 0;
        const p2pFeeNum = parseFloat(Math.max(0, p2pFeeRaw).toFixed(isFiatCur ? 2 : 8));
        const p2pFeeDisplay = isFiatCur ? fmtNGN(p2pFeeNum) : `${p2pFeeNum} ${currency}`;
        const orderNumber = pick(tx?.order_number, tx?.reference, tx?.id);
        const orderTime = tx?.created_at ? new Date(tx.created_at).toLocaleString() : "-";

        const methodLabel: Record<string, string> = { onchain: "On-Chain", bank_transfer: "Bank Transfer", p2p_trade: "P2P Trade", internal_transfer: "Internal Transfer", referral_reward: "Referral Reward", bonus: "First Trade Bonus" };

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
                  {copiedField === label ? <CheckCircle2 size={12} className="text-green-500 shrink-0" /> : <Copy size={12} className="text-primary shrink-0" />}
                </button>
              ) : (
                <span className={`text-sm font-medium text-right ${color || "text-[#1D3B53]"}`}>{value}</span>
              )}
            </div>
            <div className="h-px bg-blue-100" />
          </div>
        );

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedTx(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {txLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-start mb-4">
                    <div className="w-7 shrink-0" />
                    <h3 className="font-bold text-lg text-[#1D3B53] leading-tight flex-1 text-center">{title}</h3>
                    <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2">
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
                    {feeNum > 0 && !isP2P && <DetailRow label="Fee:" value={feeDisplay} />}
                    {isP2P && p2pFeeNum > 0 && <DetailRow label="Fee:" value={p2pFeeDisplay} />}
                    <DetailRow label="Method:" value={methodLabel[method] || method} color="text-primary" />
                    <DetailRow label="Order No.:" value={orderNumber} copyable />
                    <DetailRow label="Time:" value={orderTime} />
                    {hasBalances && <DetailRow label="Balance Before:" value={isFiatCur ? fmtNGN(tx.balance_before) : `${tx.balance_before} ${currency}`} />}
                    {hasBalances && (
                      <div className="flex justify-between items-center py-3">
                        <span className="text-sm text-[#555]">Balance After:</span>
                        <span className="text-sm font-bold text-green-500">{isFiatCur ? fmtNGN(tx.balance_after) : `${tx.balance_after} ${currency}`}</span>
                      </div>
                    )}
                  </div>

                  <button onClick={() => { setSelectedTx(null); router.push("/wallet"); }} className="w-full bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer hover:bg-primary/90 transition-colors">
                    Go to wallet
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
