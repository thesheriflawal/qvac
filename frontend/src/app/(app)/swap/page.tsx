"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowUpDown, ChevronDown, CheckCircle2, RefreshCw, Clock, X } from "lucide-react";
import { swapService } from "@/services/swap.service";
import { walletService } from "@/services/wallet.service";
import { useWallet } from "@/context/WalletContext";
import { useRequirePin } from "@/hooks/useRequirePin";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import CurrencyIcon from "@/components/CurrencyIcon";

const FIAT_CODES = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);

const MIN_SWAP: Record<string, number> = {
  USDT: 1.5,
  USDC: 1.5,
  ETH: 0.001,
  BTC: 0.0001,
  SOL: 0.015,
};

function fmtAmount(val: string | number, symbol: string) {
  const n = parseFloat(String(val));
  if (isNaN(n)) return "-";
  const isFiat = FIAT_CODES.has(symbol.toUpperCase());
  return isFiat
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-600",
    pending: "bg-yellow-100 text-yellow-600",
    processing: "bg-yellow-100 text-yellow-600",
    reversed: "bg-gray-100 text-gray-500",
    failed: "bg-red-100 text-red-500",
  };
  const cls = map[status?.toLowerCase()] || "bg-gray-100 text-gray-500";
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "-"}
    </span>
  );
}

function CurrencyPicker({
  currencies,
  selected,
  onSelect,
  excluded,
}: {
  currencies: any[];
  selected: any;
  onSelect: (c: any) => void;
  excluded?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = currencies.filter((c: any) => (c.code || c.symbol) !== excluded);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
      >
        <CurrencyIcon symbol={selected?.code || selected?.symbol || ""} size={22} />
        <span className="font-bold text-[#1D3B53] text-sm">{selected?.code || selected?.symbol || "—"}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h3 className="font-bold text-base text-[#1D3B53]">Select Token</h3>
            </div>
            <div className="overflow-y-auto max-h-[60vh] px-5 pb-8 space-y-2">
              {filtered.map((c: any) => {
                const sym = c.code || c.symbol;
                const isSelected = sym === (selected?.code || selected?.symbol);
                return (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c); setOpen(false); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-colors ${isSelected ? "bg-[#EBF4FF] border border-primary" : "bg-[#F7F9FC] hover:bg-gray-100"}`}
                  >
                    <CurrencyIcon symbol={sym} size={28} />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-[#1D3B53]">{sym}</p>
                      <p className="text-xs text-gray-400">{c.name || sym}</p>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SwapPage() {
  const { wallets, fetchWallets } = useWallet() as any;
  const requirePin = useRequirePin();

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [fromCurrency, setFromCurrency] = useState<any>(null);
  const [toCurrency, setToCurrency] = useState<any>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmountInput, setToAmountInput] = useState("");
  const [activeField, setActiveField] = useState<"from" | "to">("from");
  const [rateData, setRateData] = useState<any>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState("");
  const [rateError, setRateError] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Persist selected pair across refreshes
  const persistPair = (from: any, to: any) => {
    try {
      localStorage.setItem("swap_from", from?.code || from?.symbol || "");
      localStorage.setItem("swap_to", to?.code || to?.symbol || "");
    } catch {}
  };
  const handleSetFrom = (c: any) => { setFromCurrency(c); persistPair(c, toCurrency); };
  const handleSetTo = (c: any) => { setToCurrency(c); persistPair(fromCurrency, c); };

  // Load currencies (crypto only — no fiat)
  useEffect(() => {
    walletService.getCurrencies()
      .then(res => {
        const all = res?.data || [];
        const cryptoOnly = all.filter((c: any) => !FIAT_CODES.has((c.code || c.symbol || "").toUpperCase()));
        const walletBalMap = Object.fromEntries(
          (wallets || []).map((w: any) => [(w.currency || "").toUpperCase(), parseFloat(w.balance || "0")])
        );
        cryptoOnly.sort((a: any, b: any) => {
          const symA = (a.code || a.symbol || "").toUpperCase();
          const symB = (b.code || b.symbol || "").toUpperCase();
          return (walletBalMap[symB] || 0) - (walletBalMap[symA] || 0);
        });
        setCurrencies(cryptoOnly);
        // Restore saved pair, fall back to USDT → BTC
        let savedFrom = "", savedTo = "";
        try { savedFrom = localStorage.getItem("swap_from") || ""; savedTo = localStorage.getItem("swap_to") || ""; } catch {}
        const find = (sym: string) => cryptoOnly.find((c: any) => (c.code || c.symbol) === sym);
        const defFrom = find(savedFrom) || find("USDT") || cryptoOnly[0] || null;
        const defTo   = find(savedTo)   || find("BTC")  || cryptoOnly[1] || null;
        setFromCurrency(defFrom);
        setToCurrency(defTo);
      })
      .catch(() => {});
  }, []);

  // Load swap history
  const loadHistory = useCallback(async (page: number, append = false) => {
    setHistoryLoading(true);
    try {
      const res = await swapService.getHistory(page, 10);
      const items = res?.data || res?.results || [];
      setHistory(prev => append ? [...prev, ...items] : items);
      setHasMore(items.length === 10);
    } catch {
      if (!append) setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  // Fetch rate — single debounced effect, no useCallback indirection
  const fromSym = fromCurrency?.code || fromCurrency?.symbol || "";
  const toSym   = toCurrency?.code   || toCurrency?.symbol   || "";

  useEffect(() => {
    const amount = activeField === "from" ? fromAmount : toAmountInput;
    const reqFrom = activeField === "from" ? fromSym : toSym;
    const reqTo   = activeField === "from" ? toSym   : fromSym;

    if (!reqFrom || !reqTo || !amount || parseFloat(amount) <= 0) {
      setRateData(null);
      setRateError("");
      setRateLoading(false);
      return;
    }
    setRateLoading(true);
    setRateError("");
    const timer = setTimeout(() => {
      swapService.getRate(reqFrom, reqTo, amount)
        .then(res => {
          const data = res?.data || res;
          console.log("[Swap] Rate response:", JSON.stringify(data));
          setRateData(data);
        })
        .catch((e) => {
          console.error("[Swap] Rate error:", e?.response?.status, e?.response?.data);
          setRateData(null);
          setRateError("This swap pair is currently unavailable. Please try again later.");
        })
        .finally(() => setRateLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [fromSym, toSym, fromAmount, toAmountInput, activeField]);

  const handleFlip = () => {
    const prev = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(prev);
    persistPair(toCurrency, prev);
    setFromAmount("");
    setToAmountInput("");
    setActiveField("from");
    setRateData(null);
  };

  const fromWallet = wallets?.find((w: any) => w.currency === fromSym);
  const fromBalance = fromWallet
    ? Math.max(0, parseFloat(String(fromWallet.balance || 0)) - parseFloat(String(fromWallet.locked_balance || 0)))
    : null;

  const apiToAmount = rateData?.to_amount ?? rateData?.quoted_amount ?? rateData?.estimated_amount ?? rateData?.amount ?? rateData?.converted_amount ?? "";
  const quotedPrice = rateData?.quoted_price ?? rateData?.execution_price ?? rateData?.rate ?? rateData?.price ?? "";

  // Displayed values: if user typed in "to" field, the API was called in reverse so to_amount = from result
  const displayedToAmount   = activeField === "from" ? apiToAmount : fromAmount;
  const displayedFromAmount = activeField === "to"   ? apiToAmount : fromAmount;

  const parsedFromAmount = parseFloat(activeField === "from" ? fromAmount : (apiToAmount || "0")) || 0;
  const exceedsBalance = fromBalance !== null && parsedFromAmount > fromBalance;
  const minSwapAmount = MIN_SWAP[fromSym?.toUpperCase()] ?? null;
  const belowMinimum = minSwapAmount !== null && parsedFromAmount > 0 && parsedFromAmount < minSwapAmount;

  const actualFromAmount = activeField === "from" ? fromAmount : (apiToAmount || "");
  const canSwap = fromCurrency && toCurrency && fromSym !== toSym && parsedFromAmount > 0 && !exceedsBalance && !belowMinimum && rateData && !rateLoading;

  const handleSwapClick = async () => {
    setError("");
    if (!canSwap) return;
    await requirePin(() => setPinModal(true));
  };

  const onPin = async (pin: string, authCode?: string) => {
    setPinModal(false);
    setSwapping(true);
    setError("");
    try {
      console.log("[Swap] Executing swap:", { fromSym, toSym, actualFromAmount });
      const res = await swapService.executeSwap(fromSym, toSym, actualFromAmount, pin, authCode);
      console.log("[Swap] Response:", res);
      const swap = res?.data || res || {};
      const swapReceived = parseFloat(String(swap.received_amount)) > 0 ? swap.received_amount : apiToAmount;
      const swapPrice = parseFloat(String(swap.execution_price)) > 0 ? swap.execution_price : quotedPrice;
      setSuccessData({
        from_currency: swap.from_currency || fromSym,
        to_currency: swap.to_currency || toSym,
        from_amount: swap.from_amount || fromAmount,
        received_amount: swapReceived,
        execution_price: swapPrice,
        status: swap.status || "pending",
        id: swap.id || swap.reference || "",
        created_at: swap.created_at ? new Date(swap.created_at).toLocaleString() : new Date().toLocaleString(),
      });
      setFromAmount("");
      setToAmountInput("");
      setActiveField("from");
      setRateData(null);
      loadHistory(1);
      fetchWallets();
    } catch (e: any) {
      console.error("[Swap] Error:", {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        raw: e,
      });
      setError(getErrorMessage(e));
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-16">
      <h1 className="text-xl font-bold text-[#1D3B53] mb-4 md:mb-6">Swap</h1>

      {/* Swap Card */}
      <div className="bg-[#EBF4FF] rounded-3xl p-1.5 mb-4">
        {/* You Pay */}
        <div className="bg-white rounded-2xl p-4 md:p-5 mb-1.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">You Pay</span>
            {fromBalance !== null && (
              <span className="text-xs text-gray-400">
                Bal: <span className="font-semibold text-[#1D3B53]">{fmtAmount(fromBalance, fromSym)} {fromSym}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={activeField === "from" ? fromAmount : (displayedFromAmount || "")}
              onChange={e => { setActiveField("from"); setFromAmount(e.target.value); setToAmountInput(""); }}
              onFocus={() => { if (activeField !== "from") { setActiveField("from"); setToAmountInput(""); } }}
              placeholder="0.00"
              className={`flex-1 min-w-0 text-2xl md:text-3xl font-bold outline-none bg-transparent ${exceedsBalance ? "text-red-500" : "text-[#1D3B53]"}`}
            />
            {fromCurrency && (
              <CurrencyPicker
                currencies={currencies}
                selected={fromCurrency}
                onSelect={handleSetFrom}
                excluded={toSym}
              />
            )}
          </div>
          {fromBalance !== null && fromBalance > 0 && (
            <div className="flex gap-2 mt-3">
              {[25, 50, 75, 100].map(pct => {
                const pctAmount = ((fromBalance * pct) / 100).toFixed(8).replace(/\.?0+$/, "");
                const isActive = fromAmount === pctAmount;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => { setActiveField("from"); setFromAmount(pctAmount); setToAmountInput(""); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${isActive ? "bg-primary text-white" : "bg-[#EBF4FF] text-primary hover:bg-primary/20"}`}
                  >
                    {pct === 100 ? "Max" : `${pct}%`}
                  </button>
                );
              })}
            </div>
          )}
          {exceedsBalance && (
            <p className="text-xs text-red-500 mt-2">Insufficient balance</p>
          )}
          {belowMinimum && (
            <p className="text-xs text-red-500 mt-2">Minimum swap amount is {minSwapAmount} {fromSym}</p>
          )}
        </div>

        {/* Flip button */}
        <div className="flex justify-center -my-1 relative z-10">
          <button
            onClick={handleFlip}
            className="w-11 h-11 rounded-full bg-[#EBF4FF] border-4 border-white flex items-center justify-center cursor-pointer hover:bg-[#d6eaff] active:scale-95 transition-all shadow-md"
          >
            <ArrowUpDown size={16} className="text-primary" />
          </button>
        </div>

        {/* You Receive */}
        <div className="bg-white rounded-2xl p-4 md:p-5 mt-1.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">You Receive</span>
            {rateLoading && (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={activeField === "to" ? toAmountInput : (displayedToAmount || "")}
              onChange={e => { setActiveField("to"); setToAmountInput(e.target.value); setFromAmount(""); }}
              onFocus={() => { if (activeField !== "to") { setActiveField("to"); setFromAmount(""); } }}
              placeholder="0.00"
              className={`flex-1 min-w-0 text-2xl md:text-3xl font-bold outline-none bg-transparent ${displayedToAmount ? "text-[#1D3B53]" : "text-gray-300"}`}
            />
            {toCurrency && (
              <CurrencyPicker
                currencies={currencies}
                selected={toCurrency}
                onSelect={handleSetTo}
                excluded={fromSym}
              />
            )}
          </div>
        </div>
      </div>

      {/* Rate error */}
      {rateError && !rateLoading && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
          {rateError}
        </div>
      )}

      {/* Rate info */}
      {quotedPrice && !rateLoading && (
        <div className="bg-white rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <RefreshCw size={12} className="text-primary" />
            <span>Rate</span>
          </div>
          <span className="text-xs font-semibold text-[#1D3B53] text-right">
            1 {fromSym} ≈ {fmtAmount(quotedPrice, toSym)} {toSym}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 leading-relaxed">
          {error}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwapClick}
        disabled={!canSwap || swapping}
        className="w-full bg-primary text-white font-bold py-4 rounded-2xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-base"
      >
        {swapping ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </span>
        ) : "Swap"}
      </button>

      {/* Swap History */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-primary" />
          <h2 className="text-base font-bold text-[#1D3B53]">Swap History</h2>
        </div>

        {historyLoading && history.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-[#EBF4FF] rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-400">No swaps yet. Make your first swap above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item: any) => (
              <div key={item.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CurrencyIcon symbol={item.from_currency} size={18} />
                    <span className="text-xs font-bold text-[#1D3B53]">{item.from_currency}</span>
                    <ArrowUpDown size={10} className="text-gray-300 shrink-0" />
                    <CurrencyIcon symbol={item.to_currency} size={18} />
                    <span className="text-xs font-bold text-[#1D3B53]">{item.to_currency}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1D3B53] truncate">
                      {fmtAmount(item.from_amount, item.from_currency)} {item.from_currency}
                    </p>
                    {parseFloat(String(item.received_amount)) > 0 ? (
                      <p className="text-xs text-green-600 font-medium mt-0.5 truncate">
                        → {fmtAmount(item.received_amount, item.to_currency)} {item.to_currency}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 font-medium mt-0.5">→ Pending</p>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 shrink-0 text-right leading-tight">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                    <br />
                    <span className="text-[10px]">{item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </p>
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => { const next = historyPage + 1; setHistoryPage(next); loadHistory(next, true); }}
                disabled={historyLoading}
                className="w-full py-3 text-sm font-semibold text-primary bg-[#EBF4FF] rounded-2xl cursor-pointer disabled:opacity-50"
              >
                {historyLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin} />

      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md mx-auto shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-[#1D3B53] px-6 pt-8 pb-14 flex flex-col items-center relative">
              <button
                onClick={() => setSuccessData(null)}
                className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-full bg-[#34C759] flex items-center justify-center shadow-lg mb-3">
                <CheckCircle2 size={30} className="text-white" strokeWidth={2.5} />
              </div>
              <p className="text-white font-bold text-lg">Swap Submitted</p>
              <p className="text-white/60 text-sm mt-1">Your swap is being processed</p>
            </div>

            {/* Amount cards */}
            <div className="mx-4 -mt-8 flex gap-3">
              <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-100 px-3 py-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">You Paid</p>
                <p className="text-base font-bold text-[#1D3B53] truncate">{fmtAmount(successData.from_amount, successData.from_currency)}</p>
                <p className="text-xs text-gray-400">{successData.from_currency}</p>
              </div>
              <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-100 px-3 py-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">You Receive</p>
                <p className="text-base font-bold text-green-600 truncate">{fmtAmount(successData.received_amount, successData.to_currency)}</p>
                <p className="text-xs text-gray-400">{successData.to_currency}</p>
              </div>
            </div>

            {/* Details */}
            <div className="mx-4 mt-5 mb-2 rounded-2xl border border-[#E8EFF7] overflow-hidden">
              {[
                { label: "Execution Rate", value: successData.execution_price ? `1 ${successData.from_currency} ≈ ${fmtAmount(successData.execution_price, successData.to_currency)} ${successData.to_currency}` : "—" },
                { label: "Status", value: successData.status, badge: true },
                { label: "Date & Time", value: successData.created_at },
              ].map((row, i, arr) => (
                <div key={i} className={`flex justify-between items-center px-4 py-3 gap-3 ${i % 2 === 0 ? "bg-white" : "bg-[#F7FAFF]"} ${i < arr.length - 1 ? "border-b border-[#EDF2F7]" : ""}`}>
                  <span className="text-xs text-[#8E8E93] shrink-0">{row.label}</span>
                  {row.badge ? <StatusBadge status={row.value} /> : (
                    <span className="text-xs font-medium text-[#1D3B53] text-right">{row.value}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="px-4 pb-8 mt-5">
              <button
                onClick={() => setSuccessData(null)}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
