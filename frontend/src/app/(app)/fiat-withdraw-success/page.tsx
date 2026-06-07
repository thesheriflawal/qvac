"use client";
import { useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import ReceiptActions from "@/components/ReceiptActions";
import { useReceiptDownload } from "@/hooks/useReceiptDownload";

function FiatWithdrawSuccessContent() {
  const router = useRouter();
  const params = useSearchParams();

  const amount = params.get("amount") || "0";
  const isTransfer = params.get("isTransfer") === "true";
  const bank_name = params.get("bank_name") || "";
  const account_name = params.get("account_name") || "";
  const account_number = params.get("account_number") || "";
  const fee = params.get("fee") || "0";
  const orderNo = params.get("orderNo") || "";
  const orderTime = params.get("orderTime") || "";
  const currency = params.get("currency") || "NGN";
  const receiver_email = params.get("receiver_email") || "";
  const receiver_uid = params.get("receiver_uid") || "";

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadImage, downloadPDF, share, working } = useReceiptDownload(
    receiptRef,
    isTransfer ? "transfer-receipt" : "withdrawal-receipt"
  );

  const displayAmount = parseFloat(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const displayTime = orderTime ? new Date(orderTime).toLocaleString() : new Date().toLocaleString();

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const feeNum = parseFloat(fee) || 0;
  const feeDisplay = currency === "NGN"
    ? `₦${feeNum.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
    : `${feeNum} ${currency}`;

  const rows = [
    ...(isTransfer && receiver_email ? [{ label: "Receiver Email", value: receiver_email }] : []),
    ...(isTransfer && !receiver_email && receiver_uid ? [{ label: "Receiver UID", value: receiver_uid }] : []),
    ...(!isTransfer && account_name ? [{ label: "Recipient Name", value: account_name }] : []),
    ...(!isTransfer && account_number ? [{ label: "Account Number", value: account_number, copyKey: "acct" }] : []),
    ...(!isTransfer && bank_name ? [{ label: "Bank", value: bank_name }] : []),
    ...(feeNum > 0 ? [{ label: "Fee", value: feeDisplay }] : []),
    { label: "Method", value: isTransfer ? "Internal Transfer" : "Local Bank Transfer" },
    { label: "Status", value: "Completed", green: true },
    ...(orderNo ? [{ label: "Order No.", value: orderNo, copyKey: "order" }] : []),
    { label: "Date & Time", value: displayTime },
    { label: "Total Sent", value: `${displayAmount} ${currency}`, bold: true },
  ];

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">
          {isTransfer ? "Transfer Details" : "Withdrawal Details"}
        </span>
        <div className="w-8" />
      </div>

      {/* Captured receipt area */}
      <div ref={receiptRef} className="bg-white rounded-3xl overflow-hidden border border-gray-100 mb-4">

        {/* Brand header */}
        <div className="bg-[#1D3B53] px-6 pt-6 pb-28 flex flex-col items-center relative">
          <div className="w-16 h-16 rounded-full bg-[#34C759] flex items-center justify-center shadow-lg mb-3">
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-white/80 text-sm font-medium">
            {isTransfer ? "Transfer Successful" : "Withdrawal Successful"}
          </p>
        </div>

        {/* Amount card — sits above the blue header */}
        <div className="mx-6 -mt-20 relative z-10">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-5 py-4 text-center">
            <p className="text-xs text-[#8E8E93] mb-1 uppercase tracking-wider">Amount Sent</p>
            <p className="text-3xl font-bold text-[#1D3B53]">{displayAmount}</p>
            <p className="text-sm text-[#8E8E93] mt-1 font-medium">{currency}</p>
          </div>
        </div>

        {/* Order reference */}
        {orderNo && (
          <div className="mx-6 mt-4">
            <div className="bg-[#FFF8E7] border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#8E8E93]">Reference</p>
                <p className="text-sm font-bold text-[#1D3B53] font-mono">{orderNo}</p>
              </div>
              <button
                onClick={() => copy(orderNo, "order")}
                className="cursor-pointer shrink-0"
              >
                {copiedField === "order"
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : <Copy size={16} className="text-[#8E8E93]" />}
              </button>
            </div>
          </div>
        )}

        {/* Details table */}
        <div className="mx-6 mt-4 mb-2">
          <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-3">Transaction Details</p>
          <div className="rounded-2xl border border-[#E8EFF7] overflow-hidden">
            {rows.map((row: any, i, arr) => (
              <div
                key={i}
                className={`flex justify-between items-center px-4 py-3 ${i % 2 === 0 ? "bg-white" : "bg-[#F7FAFF]"} ${i < arr.length - 1 ? "border-b border-[#EDF2F7]" : ""}`}
              >
                <span className="text-xs text-[#8E8E93] shrink-0">{row.label}</span>
                <div className="flex items-center gap-1 max-w-[60%]">
                  <span className={`text-xs text-right truncate ${row.bold ? "font-bold text-[#1D3B53]" : row.green ? "font-semibold text-[#34C759]" : "font-medium text-[#1D3B53]"}`}>
                    {row.value}
                  </span>
                  {row.copyKey && row.value && (
                    <button onClick={() => copy(row.value, row.copyKey)} className="cursor-pointer shrink-0">
                      {copiedField === row.copyKey
                        ? <CheckCircle2 size={12} className="text-green-500" />
                        : <Copy size={12} className="text-[#8E8E93]" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Receipt footer */}
        <div className="mx-6 mt-4 mb-6 flex flex-col items-center gap-1">
          <div className="w-full border-t-2 border-dashed border-[#E8EFF7]" />
          <div className="flex items-center gap-1.5 mt-3">
            <Image src="/KYNETTIC.png" alt="Kynettic" width={16} height={16} className="rounded-full opacity-60" />
            <p className="text-xs text-[#8E8E93]">Powered by <span className="font-bold text-[#1D3B53]">Kynettic</span></p>
          </div>
          <p className="text-[10px] text-[#BCBCBC]">kynettic.com · Safe. Fast. Reliable.</p>
        </div>
      </div>

      {/* Share / Download */}
      <div className="mb-3">
        <ReceiptActions onDownloadImage={downloadImage} onDownloadPDF={downloadPDF} onShare={share} working={working} />
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => router.push("/wallet")}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
        >
          Go to Wallet
        </button>
        <button className="w-full bg-[#F0F4F8] text-primary font-bold py-4 rounded-xl cursor-pointer">
          Order Dispute?
        </button>
      </div>
    </div>
  );
}

export default function FiatWithdrawSuccessPage() {
  return <Suspense><FiatWithdrawSuccessContent /></Suspense>;
}
