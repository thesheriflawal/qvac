"use client";
import { X, ArrowDownCircle, ArrowUpCircle, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import ReceiptActions from "@/components/ReceiptActions";
import { useReceiptDownload } from "@/hooks/useReceiptDownload";

export default function P2POrderSuccessModal({
  visible, onClose, order,
}: {
  visible: boolean;
  onClose: () => void;
  order: {
    type: string; amount: string; price: string;
    fee: string; quantity: string; orderNo: string;
    orderTime: string; advertiser: string;
    currency?: string;
  };
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { downloadImage, downloadPDF, share, working } = useReceiptDownload(receiptRef, `p2p-receipt-${order?.orderNo || "order"}`);
  if (!visible) return null;

  const isBuy = order.type === "Buy";
  const currency = order.currency || "USDT";

  const copyOrderNo = () => {
    navigator.clipboard.writeText(order.orderNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Captured receipt area */}
        <div ref={receiptRef} className="bg-white rounded-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-lg text-[#5CB85C] leading-tight">
            Your {order.type} Order Has been Completed
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-[#8E8E93] leading-relaxed mb-5">
          Your transaction has been successfully processed, and the corresponding crypto and/or fiat funds have
          been transferred to the respective wallets or accounts. You can view the full details in your transaction history.
        </p>

        {/* Advertiser */}
        <div className="flex items-center justify-between bg-[#F7F9FC] rounded-xl px-4 py-3 mb-5">
          <span className="text-sm font-semibold text-[#1D3B53]">{order.advertiser}</span>
          <button className="text-xs text-primary font-medium cursor-pointer hover:underline">View Profile</button>
        </div>

        {/* Order Details */}
        <h4 className="font-bold text-sm text-[#1D3B53] mb-3">Order Details</h4>
        <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-4 space-y-3 text-sm mb-5">
          {/* Type row with icon */}
          <div className="flex items-center gap-2 mb-1">
            {isBuy
              ? <ArrowDownCircle size={16} className="text-[#5CB85C]" />
              : <ArrowUpCircle size={16} className="text-[#D92D20]" />
            }
            <span className={`font-bold ${isBuy ? "text-[#5CB85C]" : "text-[#D92D20]"}`}>{order.type}</span>
            <span className="font-bold text-[#1D3B53]">{currency}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-[#8E8E93]">Amount:</span>
            <span className="font-semibold text-[#1D3B53]">{order.amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8E8E93]">Price:</span>
            <span className="font-semibold text-[#1D3B53]">{order.price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8E8E93]">Fee:</span>
            <span className="font-semibold text-[#1D3B53]">{order.fee}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8E8E93]">total Quantity:</span>
            <span className="font-semibold text-[#1D3B53]">{order.quantity}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8E8E93]">Order No.:</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-primary text-xs">{order.orderNo}</span>
              <button onClick={copyOrderNo} className="cursor-pointer text-gray-400 hover:text-primary">
                <Copy size={13} />
              </button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8E8E93]">Order Time:</span>
            <span className="font-semibold text-primary text-xs">{order.orderTime}</span>
          </div>
        </div>

        </div>{/* end receipt capture */}

        <div className="mt-4 mb-3">
          <ReceiptActions onDownloadImage={downloadImage} onDownloadPDF={downloadPDF} onShare={share} working={working} />
        </div>

        <button
          onClick={() => { onClose(); router.push("/wallet"); }}
          className="w-full bg-primary text-white py-3.5 rounded-xl font-bold cursor-pointer hover:bg-primary/90 transition-colors mb-3"
        >
          Go to wallet
        </button>

        <button
          onClick={() => { onClose(); router.push("/support"); }}
          className="w-full py-3 text-center text-sm text-[#1D3B53] font-semibold cursor-pointer hover:underline"
        >
          Order Dispute?
        </button>
      </div>
    </div>
  );
}
