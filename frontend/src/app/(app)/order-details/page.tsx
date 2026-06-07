"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";

function OrderDetailsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const order = params.get("order") ? JSON.parse(decodeURIComponent(params.get("order")!)) : {};

  const [copied, setCopied] = useState(false);

  const raw = order?.raw || {};

  const takerFee = raw?.taker_fee_amount;
  const takerFeeCurrency = raw?.taker_fee_currency || order?.asset || "";
  const makerFee = raw?.maker_fee_amount;
  const makerFeeCurrency = raw?.maker_fee_currency || order?.asset || "";
  const feeDisplay = takerFee != null && parseFloat(takerFee) > 0
    ? `${takerFee} ${takerFeeCurrency}`
    : makerFee != null && parseFloat(makerFee) > 0
    ? `${makerFee} ${makerFeeCurrency}`
    : order?.fee || "Free";

  const counterpartyName = raw?.counterparty?.name || raw?.advertiser_name || null;

  const copyOrderNo = async () => {
    if (!order?.orderNo) return;
    await navigator.clipboard.writeText(order.orderNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => navigator.clipboard.writeText(""), 60000);
  };

  const rows = [
    { label: "Amount:", value: order?.amount || "0.00", bold: true, blue: false },
    { label: "Price:", value: order?.price || "0.00", bold: false, blue: true },
    { label: "Fee:", value: feeDisplay, bold: false, blue: true },
    { label: "total Quantity:", value: order?.quantity || "0.00", bold: false, blue: true },
    { label: "Order No.:", value: order?.orderNo || "N/A", bold: false, blue: true, copyable: true },
    { label: "Order Time:", value: order?.date || "N/A", bold: false, blue: true },
  ];

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center py-3 mb-4">
        <button onClick={() => router.push("/orders")} className="p-1 cursor-pointer mr-2">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <div className="w-6" />
      </div>

      {/* Status title */}
      <p className="text-base font-bold text-[#4CD964] mb-2">
        Your {order?.type} Order Has been{" "}
        {order?.status === "failed" ? "Failed" : "Completed"}
      </p>
      <p className="text-xs text-[#8E8E93] leading-relaxed mb-5">
        Your transaction has been successfully processed, and the corresponding crypto and/or fiat funds have been transferred to the respective wallets or accounts. You can view the full details in your transaction history.
      </p>

      {/* Counterparty Card */}
      {counterpartyName && (
        <div className="bg-[#F0F4F8] rounded-xl p-4 flex items-center justify-between mb-5">
          <p className="text-sm font-bold text-[#1D3B53]">{counterpartyName}</p>
          <button className="text-xs text-primary underline cursor-pointer">View Profile</button>
        </div>
      )}

      <p className="font-bold text-base text-[#1D3B53] mb-3">Order Details</p>

      {/* Details Card */}
      <div className="bg-[#EBF4FF] rounded-2xl p-5 mb-6">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ backgroundColor: "#26A17B", color: "#fff" }}>T</div>
          <p className="text-sm font-bold text-[#4472B7]">
            {order?.type} {order?.asset || "USDT"}
          </p>
        </div>

        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-500">{row.label}</span>
              <div className="flex items-center gap-1">
                <span className={`text-sm ${row.bold ? "font-bold text-primary" : row.blue ? "font-semibold text-primary" : "font-medium text-[#1D3B53]"}`}>
                  {row.value}
                </span>
                {row.copyable && order?.orderNo && (
                  <button onClick={copyOrderNo} className="cursor-pointer ml-1">
                    {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} className="text-[#8E8E93]" />}
                  </button>
                )}
              </div>
            </div>
            {i < rows.length - 1 && <div className="h-px bg-[#D1D5DB]" />}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer">
          Go to wallet
        </button>
        <button className="w-full bg-[#F0F4F8] text-primary font-bold py-4 rounded-xl cursor-pointer">
          Order Dispute?
        </button>
      </div>
    </div>
  );
}

export default function OrderDetailsPage() {
  return <Suspense><OrderDetailsContent /></Suspense>;
}
