"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { walletService } from "@/services/wallet.service";
import ReceiptActions from "@/components/ReceiptActions";
import { useReceiptDownload } from "@/hooks/useReceiptDownload";
import { getFriendlyTxTitle } from "@/lib/txTitle";

const FIAT_CODES = new Set(["NGN", "USD", "EUR", "GBP", "KES", "GHS", "ZAR"]);

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-100", text: "text-green-600" },
  confirmed: { bg: "bg-green-100", text: "text-green-600" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-600" },
  processing: { bg: "bg-yellow-100", text: "text-yellow-600" },
  failed: { bg: "bg-red-100", text: "text-red-500" },
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

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => navigator.clipboard.writeText(""), 60000);
  };
  return (
    <div>
      <div className="flex justify-between items-center py-3">
        <span className="text-sm text-[#555]">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 cursor-pointer max-w-[60%]">
          <span className="text-sm font-medium text-primary truncate">{value}</span>
          {copied ? <CheckCircle2 size={12} className="text-green-500 shrink-0" /> : <Copy size={12} className="text-primary shrink-0" />}
        </button>
      </div>
      <div className="h-px bg-blue-100" />
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="flex justify-between items-center py-3">
        <span className="text-sm text-[#555]">{label}</span>
        <span className={`text-sm font-medium text-right ${color || "text-[#1D3B53]"}`}>{value}</span>
      </div>
      <div className="h-px bg-blue-100" />
    </div>
  );
}

function TransactionDetailsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") || "";
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadImage, downloadPDF, share, working } = useReceiptDownload(receiptRef, `receipt-${id || "tx"}`);

  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return; }
    walletService.getTransaction(id)
      .then(data => setTx(data?.data || data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="max-w-lg mx-auto flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !tx) return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <p className="text-[#1D3B53] mb-4">Failed to load transaction details.</p>
      <button onClick={() => router.push("/history")} className="text-primary font-semibold cursor-pointer">Go Back</button>
    </div>
  );

  const currency = pick(tx?.currency, "NGN");
  const isFiat = FIAT_CODES.has(currency.toUpperCase());
  const method = pick(tx?.method, tx?.payment_method, "");
  const isP2P = method === "p2p_trade";
  const isOnchain = method === "onchain";
  const isBankTransfer = method === "bank_transfer";
  const isInternalTransfer = method === "internal_transfer";

  const rawAmount = pick(tx?.amount, "0");
  const netAmount = tx?.net_amount;
  const displayAmount = isFiat
    ? fmtNGN(netAmount ?? rawAmount)
    : `${netAmount ?? rawAmount} ${currency}`;

  const status = pick(tx?.status, "processing");
  const statusStyle = STATUS_COLOR[status.toLowerCase()] || { bg: "bg-red-100", text: "text-red-500" };
  const title = getFriendlyTxTitle(tx);

  const receipt = tx?.receipt || {};
  const txHash = pick(receipt?.tx_hash, tx?.tx_hash);
  const network = pick(receipt?.network, tx?.network);
  const address = pick(receipt?.address, tx?.address);
  const bankName = pick(receipt?.bank_name, tx?.bank_name);
  const accountNumber = pick(receipt?.account_number, tx?.account_number);
  const feeNum = parseFloat(pick(tx?.fee, tx?.fee_amount, "0")) || 0;
  const feeDisplay = isFiat ? fmtNGN(feeNum) : `${feeNum} ${currency}`;
  const balBeforeNum = parseFloat(String(tx?.balance_before ?? 0));
  const balAfterNum = parseFloat(String(tx?.balance_after ?? 0));
  const hasBalances = tx?.balance_before != null && tx?.balance_after != null;
  const isDebit = hasBalances ? balBeforeNum > balAfterNum : false;
  const p2pFeeRaw = isP2P && isDebit && hasBalances
    ? balBeforeNum - balAfterNum - parseFloat(pick(tx?.amount, "0"))
    : 0;
  const p2pFeeNum = parseFloat(Math.max(0, p2pFeeRaw).toFixed(isFiat ? 2 : 8));
  const p2pFeeDisplay = isFiat ? fmtNGN(p2pFeeNum) : `${p2pFeeNum} ${currency}`;
  const orderNumber = pick(tx?.order_number, tx?.reference, tx?.id);
  const orderTime = tx?.created_at
    ? new Date(tx.created_at).toLocaleString()
    : tx?.updated_at
    ? new Date(tx.updated_at).toLocaleString()
    : "-";

  const methodLabel: Record<string, string> = {
    onchain: "On-Chain", bank_transfer: "Bank Transfer",
    p2p_trade: "P2P Trade", internal_transfer: "Internal Transfer",
    referral_reward: "Referral Reward",
  };

  const openTxHash = () => {
    if (txHash === "-") return;
    const chain = network.toLowerCase();
    let url = `${process.env.NEXT_PUBLIC_EXPLORER_ETH}/${txHash}`;
    if (chain.includes("trx") || chain.includes("tron")) url = `${process.env.NEXT_PUBLIC_EXPLORER_TRON}/${txHash}`;
    else if (chain.includes("btc") || chain.includes("bitcoin")) url = `${process.env.NEXT_PUBLIC_EXPLORER_BTC}/${txHash}`;
    window.open(url, "_blank");
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/history")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-base font-bold text-[#1D3B53] flex-1 text-center truncate">{title}</h1>
        <div className="w-8" />
      </div>

      {/* Captured receipt area */}
      <div ref={receiptRef} className="bg-white rounded-2xl">

      {/* Amount hero */}
      <div className="flex flex-col items-center mb-6 mt-2">
        <p className="text-sm text-[#8E8E93] mb-1">Amount</p>
        <p className="text-3xl font-bold text-[#1D3B53] mb-2">{displayAmount}</p>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <p className="text-base font-bold text-[#1D3B53] mb-3">Transaction Details</p>

      {/* Details card */}
      <div className="bg-[#EBF4FF] rounded-2xl p-5">
        {isP2P && tx?.p2p_role && <InfoRow label="Role:" value={tx.p2p_role.charAt(0).toUpperCase() + tx.p2p_role.slice(1)} color="text-primary" />}
        {isP2P && tx?.fiat_amount != null && <InfoRow label="Fiat Amount:" value={fmtNGN(tx.fiat_amount)} />}
        {isP2P && tx?.price_per_unit != null && <InfoRow label="Price per Unit:" value={`₦${parseFloat(String(tx.price_per_unit)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`} />}
        {isP2P && tx?.counterparty?.name && <InfoRow label="Counterparty:" value={tx.counterparty.name} />}
        {isP2P && tx?.maker_fee != null && <InfoRow label="Maker Fee:" value={isFiat ? fmtNGN(tx.maker_fee) : `${tx.maker_fee} ${currency}`} />}
        {isP2P && tx?.taker_fee != null && <InfoRow label="Taker Fee:" value={isFiat ? fmtNGN(tx.taker_fee) : `${tx.taker_fee} ${currency}`} />}

        {isInternalTransfer && tx?.counterparty?.name && <InfoRow label="Name:" value={tx.counterparty.name} />}
        {isInternalTransfer && tx?.counterparty?.email && <CopyRow label="Email:" value={tx.counterparty.email} />}

        {isBankTransfer && bankName !== "-" && <InfoRow label="Bank:" value={bankName} />}
        {isBankTransfer && accountNumber !== "-" && <InfoRow label="Account Number:" value={accountNumber} />}

        {isOnchain && address !== "-" && <CopyRow label="Address:" value={address} />}
        {isOnchain && network !== "-" && <InfoRow label="Network:" value={network.toUpperCase()} />}
        {isOnchain && txHash !== "-" && (
          <div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-[#555]">Tx Hash:</span>
              <button onClick={openTxHash} className="flex items-center gap-1 cursor-pointer max-w-[60%]">
                <span className="text-sm font-medium text-primary truncate">{txHash}</span>
                <ExternalLink size={12} className="text-primary shrink-0" />
              </button>
            </div>
            <div className="h-px bg-blue-100" />
          </div>
        )}

        {feeNum > 0 && !isP2P && <InfoRow label="Fee:" value={feeDisplay} />}
        {isP2P && p2pFeeNum > 0 && <InfoRow label="Fee:" value={p2pFeeDisplay} />}
        <InfoRow label="Method:" value={methodLabel[method] || method} color="text-primary" />
        <CopyRow label="Order No.:" value={orderNumber} />
        <InfoRow label="Time:" value={orderTime} />

        {tx?.balance_before != null && (
          <InfoRow label="Balance Before:" value={isFiat ? fmtNGN(tx.balance_before) : `${tx.balance_before} ${currency}`} />
        )}
        {tx?.balance_after != null && (
          <div className="flex justify-between items-center py-3">
            <span className="text-sm text-[#555]">Balance After:</span>
            <span className="text-sm font-bold text-green-500">
              {isFiat ? fmtNGN(tx.balance_after) : `${tx.balance_after} ${currency}`}
            </span>
          </div>
        )}
      </div>

      </div>{/* end receipt capture */}

      <div className="mt-5 mb-3">
        <ReceiptActions onDownloadImage={downloadImage} onDownloadPDF={downloadPDF} onShare={share} working={working} />
      </div>

      <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer">
        Go to wallet
      </button>
    </div>
  );
}

export default function TransactionDetailsPage() {
  return <Suspense><TransactionDetailsContent /></Suspense>;
}
