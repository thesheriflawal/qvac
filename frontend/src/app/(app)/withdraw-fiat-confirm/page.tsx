"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import StatusModal from "@/components/modals/StatusModal";
import { walletService } from "@/services/wallet.service";

function formatNGN(v: number) {
  return v.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function WithdrawFiatConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();

  const bank_code = params.get("bank_code") || "";
  const bank_name = params.get("bank_name") || "";
  const account_number = params.get("account_number") || "";
  const account_name = params.get("account_name") || "";
  const amount = params.get("amount") || "0";
  const fee = parseFloat(params.get("fee") || "0");
  const stamp_duty = parseFloat(params.get("stamp_duty") || "0");
  const total_fee = parseFloat(params.get("total_fee") || "0");

  const parsedAmount = parseFloat(amount);
  const totalDebit = parsedAmount + total_fee;

  const [pinModal, setPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({ visible: false, message: "" });

  const onPin = async (pin: string) => {
    setPinModal(false); setLoading(true);
    try {
      const res = await (walletService as any).withdrawFiat({ bank_code, bank_name, account_number, account_name, amount, pin });
      const orderNo = res?.data?.order_number || res?.order_number || "";
      const query = new URLSearchParams({
        amount, bank_name, account_name, account_number,
        fee: String(fee), orderNo, orderTime: new Date().toISOString(),
        currency: "NGN", total_fee: String(total_fee),
      }).toString();
      router.push(`/fiat-withdraw-success?${query}`);
    } catch (e) {
      setError({ visible: true, message: getErrorMessage(e) });
    } finally { setLoading(false); }
  };

  const rows = [
    { label: "Recipient Name:", value: account_name },
    { label: "Recipient Account Number:", value: account_number },
    { label: "Bank:", value: bank_name },
    { label: "Transfer charges:", value: `₦${fee}` },
    ...(stamp_duty > 0 ? [{ label: "Transfer Levy:", value: `₦${stamp_duty}` }] : []),
    { label: "Total fee:", value: `₦${total_fee}`, bold: true },
    { label: "Method:", value: "Local Bank Transfer" },
    { label: "Total Debit:", value: `₦${formatNGN(totalDebit)} NGN`, bold: true },
  ];

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/withdraw-fiat")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Confirm details</span>
        <button className="p-1 cursor-pointer text-[#555]">
          <Share2 size={22} />
        </button>
      </div>

      {/* Amount */}
      <div className="flex flex-col items-center mb-8 mt-2">
        <p className="text-sm text-[#8E8E93] mb-1">Quantity</p>
        <p className="text-3xl font-bold text-[#1D3B53]">{formatNGN(parsedAmount)} NGN</p>
      </div>

      <p className="font-bold text-base text-[#1D3B53] mb-3">Transaction Details</p>

      {/* Details Card */}
      <div className="bg-[#EBF4FF] rounded-2xl p-5 mb-6">
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex justify-between items-center py-3">
              <span className="text-xs text-gray-500 flex-1">{row.label}</span>
              <span className={`text-xs text-right flex-1 ${row.bold ? "font-bold text-[#1D3B53]" : "font-medium text-[#1D3B53]"}`}>{row.value || "—"}</span>
            </div>
            {i < rows.length - 1 && <div className="h-px bg-primary/10" />}
          </div>
        ))}
        {/* You will receive */}
        <div className="h-px bg-primary/10" />
        <div className="flex justify-between items-center py-3 bg-[#F0FFF4] rounded-lg px-2 mt-1">
          <span className="text-xs font-semibold text-[#10B981]">You will receive:</span>
          <span className="text-xs font-bold text-[#10B981]">₦{formatNGN(parsedAmount)} NGN</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => setPinModal(true)}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60"
        >
          {loading ? "Processing..." : "Withdraw"}
        </button>
        <button
          onClick={() => router.push("/withdraw-fiat")}
          className="w-full bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin} />
      <StatusModal visible={error.visible} onClose={() => setError({ visible: false, message: "" })} type="error" title="Error" message={error.message} />
    </div>
  );
}

export default function WithdrawFiatConfirmPage() {
  return <Suspense><WithdrawFiatConfirmContent /></Suspense>;
}
