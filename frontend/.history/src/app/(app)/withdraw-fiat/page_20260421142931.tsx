"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft, ChevronDown, Search, CheckCircle2, AlertCircle, X, Copy } from "lucide-react";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import ReceiptActions from "@/components/ReceiptActions";
import { useReceiptDownload } from "@/hooks/useReceiptDownload";
import { useRequirePin } from "@/hooks/useRequirePin";
import Image from "next/image";

const FALLBACK_TIERS = [
  { min_amount: 0, max_amount: 9999.99, fee: 30, stamp_duty: 0, total_fee: 30 },
  { min_amount: 10000, max_amount: null, fee: 30, stamp_duty: 50, total_fee: 80 },
];

const commaFormat = (v: string) => {
  const raw = v.replace(/,/g, "");
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  return dec !== undefined ? `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec !== undefined ? `.${dec}` : ""}` : int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function WithdrawFiatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const requirePin = useRequirePin();
  const senderName = user?.full_name || user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "";
  const { wallets } = useWallet();
  const ngnWallet = wallets.find((w: any) => (w.currency || "").toUpperCase() === "NGN");
  const availableBalance = ngnWallet
    ? parseFloat(String(ngnWallet.balance || 0)) - parseFloat(String(ngnWallet.locked_balance || 0))
    : 0;

  const [rawAmount, setRawAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [accountName, setAccountName] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [banks, setBanks] = useState<any[]>([]);
  const [fiatFeeTiers, setFiatFeeTiers] = useState<any[]>(FALLBACK_TIERS);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadImage, downloadPDF, share, working } = useReceiptDownload(receiptRef, "withdrawal-receipt");
  const resolveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedAmount = parseFloat(rawAmount.replace(/,/g, "")) || 0;
  const displayAmount = rawAmount ? commaFormat(rawAmount) : "";

  const feeInfo = useMemo(() => {
    if (!fiatFeeTiers.length || parsedAmount <= 0) return null;
    return fiatFeeTiers.find((t: any) => {
      const min = t.min_amount || 0;
      const max = t.max_amount;
      return parsedAmount >= min && (max === null || max === undefined || parsedAmount <= max);
    }) || null;
  }, [fiatFeeTiers, parsedAmount]);

  const totalFee = feeInfo?.total_fee || 0;
  const totalRequired = parsedAmount + totalFee;
  const insufficient = parsedAmount > 0 && Math.round(totalRequired * 100) > Math.round(availableBalance * 100);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    setLoadingBanks(true);
    try {
      const r = await walletService.getFiatBanks();
      setBanks(r.data || []);
    } catch (e) {
      setFetchError(getErrorMessage(e) || "Failed to load banks");
    } finally { setLoadingBanks(false); }
  };

  useEffect(() => {
    if (resolveRef.current) clearTimeout(resolveRef.current);
    if (accountNumber.length === 10 && selectedBank) {
      resolveRef.current = setTimeout(resolveAccount, 500);
    } else {
      setAccountName(""); setLookupError("");
    }
    return () => { if (resolveRef.current) clearTimeout(resolveRef.current); };
  }, [accountNumber, selectedBank]);

  const resolveAccount = async () => {
    setResolving(true); setAccountName(""); setLookupError("");
    try {
      const r = await walletService.lookupFiatBank(accountNumber, selectedBank.code);
      const name = r?.data?.account_name || r?.data?.accountName || r?.account_name;
      if (name) setAccountName(name);
      else setLookupError("Could not resolve account name");
    } catch (e: any) {
      setLookupError(e.response?.status === 400 ? "Invalid account number or bank" : "Account lookup failed");
    } finally { setResolving(false); }
  };

  const handleWithdraw = () => {
    setError("");
    if (!selectedBank || !accountNumber || !rawAmount || parsedAmount <= 0) { setError("Please fill all fields correctly"); return; }
    if (insufficient) { setError("Insufficient balance for amount + fees"); return; }
    if (!accountName && !resolving) { setError("Could not verify account name. Please check details."); return; }
    requirePin(() => setPinModal(true));
  };

  const onPin = async (pin: string, authCode?: string) => {
    setPinModal(false); setLoading(true); setError("");
    try {
      const res = await walletService.withdrawFiat({
        account_name: accountName, account_number: accountNumber,
        amount: rawAmount.replace(/,/g, ""), auth_code: authCode || "",
        bank_code: selectedBank.code, bank_name: selectedBank.name, pin,
      });
      const tx = res?.data || res || {};
      setSuccessData({
        amount: parsedAmount,
        sender_name: senderName,
        account_name: accountName,
        account_number: accountNumber,
        bank_name: selectedBank.name,
        fee: totalFee,
        orderNo: tx.order_number || tx.reference || tx.id || "",
        orderTime: tx.created_at ? new Date(tx.created_at).toLocaleString() : new Date().toLocaleString(),
      });
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };

  const filteredBanks = banks.filter(b => b.name?.toLowerCase().includes(bankSearch.toLowerCase()));

  const handleMax = () => {
    if (!availableBalance) return;
    const sorted = [...fiatFeeTiers].sort((a, b) => (b.min_amount || 0) - (a.min_amount || 0));
    let best = 0;
    for (const t of sorted) {
      const fee = t.total_fee || 0;
      const tierMax = t.max_amount != null ? t.max_amount : Infinity;
      const candidate = Math.min(tierMax, availableBalance - fee);
      if (candidate >= (t.min_amount || 0)) {
        best = candidate;
        break;
      }
    }
    if (best > 0) setRawAmount(String(Math.floor(best * 100) / 100));
  };

  return (
    <div className="max-w-lg mx-auto pb-28">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Withdraw Fiat</h1>
      </div>

      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        {/* Sender Name */}
        {senderName && (
          <div>
            <label className="block text-sm font-medium text-[#555] mb-2">Sender Name</label>
            <div className="flex items-center bg-[#F0F7FF] border border-[#D6E4F0] rounded-xl px-4 h-14">
              <span className="text-sm font-semibold text-[#1D3B53]">{senderName}</span>
            </div>
          </div>
        )}

        {/* Select Bank */}
        <div>
          <label className="block text-sm font-medium text-[#555] mb-2">Select Bank</label>
          {loadingBanks ? (
            <div className="h-14 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-600 text-sm mb-2">{fetchError}</p>
              <button onClick={loadBanks} className="bg-red-500 text-white text-sm px-4 py-2 rounded-lg font-semibold cursor-pointer">Retry</button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setBankOpen(!bankOpen)}
                className="w-full flex items-center justify-between bg-white border border-[#E2E8F0] rounded-xl px-4 h-14 cursor-pointer"
              >
                <span className={selectedBank ? "text-sm text-[#1D3B53]" : "text-sm text-[#8E8E93]"}>
                  {selectedBank?.name || "Choose a bank"}
                </span>
                <ChevronDown size={18} className="text-[#555]" />
              </button>
              {bankOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                    <Search size={14} className="text-gray-400" />
                    <input value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search bank" className="flex-1 text-sm outline-none" />
                    <button onClick={() => setBankOpen(false)} className="cursor-pointer"><X size={16} className="text-gray-400" /></button>
                  </div>
                  <div className="overflow-y-auto">
                    {filteredBanks.map(b => (
                      <button key={b.code} onClick={() => { setSelectedBank(b); setBankOpen(false); setBankSearch(""); }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-medium text-[#555] mb-2">Account Number</label>
          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl px-4 h-14">
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="0123456789"
              className="flex-1 text-sm text-[#1D3B53] outline-none"
            />
          </div>
          {resolving && <p className="text-xs text-primary mt-1.5 flex items-center gap-1"><span className="inline-block w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" /> Verifying account...</p>}
          {accountName && (
            <div className="flex items-center gap-1.5 mt-1.5 bg-green-50 px-3 py-1.5 rounded-lg self-start w-fit">
              <CheckCircle2 size={13} className="text-green-500" />
              <span className="text-xs font-bold text-green-700">{accountName}</span>
            </div>
          )}
          {lookupError && (
            <div className="flex items-center gap-1.5 mt-1.5 bg-red-50 px-3 py-1.5 rounded-lg w-fit">
              <AlertCircle size={13} className="text-red-500" />
              <span className="text-xs text-red-600">{lookupError}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-[#555] mb-2">Amount (NGN)</label>
          <div className={`flex items-center bg-white border rounded-xl px-4 h-14 gap-2 ${insufficient ? "border-red-500" : "border-[#E2E8F0]"}`}>
            <span className="text-base font-bold text-[#1D3B53]">₦</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayAmount}
              onChange={e => {
                const raw = e.target.value.replace(/,/g, "");
                if (raw === "" || /^\d*\.?\d*$/.test(raw)) setRawAmount(raw);
              }}
              placeholder="0.00"
              className="flex-1 text-sm text-[#1D3B53] outline-none"
            />
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-px h-4 bg-gray-300" />
              <button onClick={handleMax} className="text-primary font-bold text-sm cursor-pointer">Max</button>
            </div>
          </div>
        </div>

        {/* Balance box */}
        <div className={`flex justify-between items-center rounded-xl p-3 border ${insufficient ? "bg-red-50 border-red-200" : "bg-[#F0F7FF] border-[#D6E4F0]"}`}>
          <span className="text-xs text-[#555]">Available Balance</span>
          <span className={`text-sm font-bold ${insufficient ? "text-red-500" : "text-[#1D3B53]"}`}>
            ₦{availableBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </span>
        </div>
        {insufficient && (
          <p className="text-xs text-red-500 -mt-2">
            Insufficient balance (₦{commaFormat(parsedAmount.toString())} + ₦{totalFee} fee = ₦{commaFormat(totalRequired.toString())})
          </p>
        )}

        {/* Fee breakdown */}
        {feeInfo && parsedAmount > 0 && (
          <div className="bg-[#F0F7FF] border border-[#D6E4F0] rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-[#555]">Transfer charges</span>
              <span className="text-xs text-[#555]">₦{feeInfo.fee}</span>
            </div>
            {feeInfo.stamp_duty > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-[#555]">Stamp duty</span>
                <span className="text-xs text-[#555]">₦{feeInfo.stamp_duty}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#D6E4F0] pt-2">
              <span className="text-xs font-bold text-[#1D3B53]">Total fee</span>
              <span className="text-xs font-bold text-[#1D3B53]">₦{feeInfo.total_fee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-bold text-[#1D3B53]">You will be debited</span>
              <span className="text-xs font-bold text-[#1D3B53]">₦{commaFormat(totalRequired.toString())}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[230px] xl:right-[280px] bg-white border-t border-gray-100 p-4">
        <div className="max-w-lg mx-auto">
        <button
          onClick={handleWithdraw}
          disabled={!accountName || !rawAmount || insufficient || parsedAmount <= 0 || loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {loading ? "Processing..." : "Withdraw"}
        </button>
        </div>
      </div>

      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin} />

      {/* Success Receipt Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md mx-auto max-h-[95vh] overflow-y-auto shadow-2xl">

            {/* Captured receipt area */}
            <div ref={receiptRef} className="bg-white rounded-3xl overflow-hidden">

              {/* Brand header */}
              <div className="bg-[#1D3B53] px-6 pt-6 pb-16 flex flex-col items-center relative">
                <button
                  onClick={() => { setSuccessData(null); router.push("/wallet"); }}
                  className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-2 mb-6">
                  <Image src="/KYNETTIC.png" alt="Kynettic" width={36} height={36} className="rounded-full" />
                  <span className="text-white font-bold text-lg tracking-wide">KYNETTIC</span>
                </div>
                {/* Success badge */}
                <div className="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center shadow-lg mb-3">
                  <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
                </div>
                <p className="text-white/80 text-sm font-medium">Transfer Successful</p>
              </div>

              {/* Amount card overlapping header */}
              <div className="mx-6 -mt-5">
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-5 py-4 text-center">
                  <p className="text-xs text-[#8E8E93] mb-1 uppercase tracking-wider">Amount Sent</p>
                  <p className="text-3xl font-bold text-[#1D3B53]">
                    ₦{successData.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-[#8E8E93] mt-1">Nigerian Naira</p>
                </div>
              </div>

              {/* Reference */}
              {successData.orderNo && (
                <div className="mx-6 mt-4">
                  <div className="bg-[#FFF8E7] border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#8E8E93]">Reference</p>
                      <p className="text-sm font-bold text-[#1D3B53] font-mono">{successData.orderNo}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(successData.orderNo);
                        setCopiedField("ref");
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className="cursor-pointer"
                    >
                      {copiedField === "ref" ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} className="text-[#8E8E93]" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Details table */}
              <div className="mx-6 mt-4 mb-2">
                <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-3">Transaction Details</p>
                <div className="rounded-2xl border border-[#E8EFF7] overflow-hidden">
                  {[
                    ...(successData.sender_name ? [{ label: "From", value: successData.sender_name }] : []),
                    { label: "To", value: successData.account_name },
                    { label: "Account No.", value: successData.account_number },
                    { label: "Bank", value: successData.bank_name },
                    { label: "Transfer Fee", value: `₦${successData.fee.toLocaleString("en-NG")}` },
                    { label: "Method", value: "Local Bank Transfer" },
                    { label: "Status", value: "Completed", green: true },
                    { label: "Date & Time", value: successData.orderTime },
                    { label: "Total Debited", value: `₦${(successData.amount + successData.fee).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`, bold: true },
                  ].map((row: any, i, arr) => (
                    <div key={i} className={`flex justify-between items-center px-4 py-3 ${i % 2 === 0 ? "bg-white" : "bg-[#F7FAFF]"} ${i < arr.length - 1 ? "border-b border-[#EDF2F7]" : ""}`}>
                      <span className="text-xs text-[#8E8E93] shrink-0">{row.label}</span>
                      <span className={`text-xs text-right max-w-[55%] ${row.bold ? "font-bold text-[#1D3B53]" : row.green ? "font-semibold text-[#34C759]" : "font-medium text-[#1D3B53]"}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt footer */}
              <div className="mx-6 mt-4 mb-6 flex flex-col items-center gap-1">
                <div className="w-full h-px bg-dashed border-t-2 border-dashed border-[#E8EFF7]" />
                <div className="flex items-center gap-1.5 mt-3">
                  <Image src="/KYNETTIC.png" alt="Kynettic" width={16} height={16} className="rounded-full opacity-60" />
                  <p className="text-xs text-[#8E8E93]">Powered by <span className="font-bold text-[#1D3B53]">Kynettic</span></p>
                </div>
                <p className="text-[10px] text-[#BCBCBC]">kynettic.com · Safe. Fast. Reliable.</p>
              </div>

            </div>{/* end receipt capture */}

            {/* Share / Download */}
            <div className="px-6 pb-3 pt-1">
              <ReceiptActions onDownloadImage={downloadImage} onDownloadPDF={downloadPDF} onShare={share} working={working} />
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={() => { setSuccessData(null); router.push("/wallet"); }}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
              >
                Go to Wallet
              </button>
              <button className="w-full bg-[#F0F4F8] text-primary font-bold py-4 rounded-xl cursor-pointer">
                Order Dispute?
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
