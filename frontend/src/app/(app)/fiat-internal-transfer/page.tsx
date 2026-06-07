"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Info } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import { useRequirePin } from "@/hooks/useRequirePin";
import StatusModal from "@/components/modals/StatusModal";

export default function FiatInternalTransferPage() {
  const router = useRouter();
  const requirePin = useRequirePin();
  const { wallets, internalTransfer } = useWallet();
  const ngnWallet = wallets.find(w => (w.currency || "").toUpperCase() === "NGN");
  const availableBalance = parseFloat(String(ngnWallet?.balance ?? 0)) - parseFloat(String(ngnWallet?.locked_balance ?? 0));

  const [method, setMethod] = useState<"Email" | "UID">("Email");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [force2FA, setForce2FA] = useState(false);
  const [error, setError] = useState<{ visible: boolean; message: string }>({ visible: false, message: "" });

  const parsedAmount = parseFloat(amount) || 0;
  const exceedsBalance = parsedAmount > availableBalance && parsedAmount > 0;

  const recipientError = (() => {
    if (!recipient) return "";
    if (method === "Email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) ? "" : "Enter a valid email address";
    } else {
      if (!/^\d+$/.test(recipient)) return "UID must contain numbers only";
      if (recipient.length !== 14) return `UID must be exactly 14 digits (${recipient.length}/14)`;
      return "";
    }
  })();

  const handlePaste = async () => {
    const text = (await navigator.clipboard.readText()).trim().substring(0, 255);
    if (text) setRecipient(text);
  };

  const handleMax = () => setAmount(availableBalance.toFixed(2));

  const handleTransfer = () => {
    if (!recipient.trim()) {
      setError({ visible: true, message: `Please enter the recipient's ${method}` }); return;
    }
    if (recipientError) {
      setError({ visible: true, message: recipientError }); return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError({ visible: true, message: "Please enter a valid amount" }); return;
    }
    if (exceedsBalance) {
      setError({ visible: true, message: "Insufficient balance" }); return;
    }
    if (!ngnWallet?.currency_id) {
      setError({ visible: true, message: "Unable to determine currency. Please try again." }); return;
    }
    requirePin(() => setPinModal(true));
  };

  const is2FAError = (msg: string) =>
    /2fa|two.?factor|auth.?code|totp|otp/i.test(msg);

  const onPin = async (pin: string, authCode?: string) => {
    setPinModal(false); setLoading(true);
    try {
      const isEmail = method === "Email";
      const res = await internalTransfer({
        amount,
        auth_code: authCode || "",
        currency_id: String(ngnWallet!.currency_id || ""),
        pin,
        ...(isEmail ? { receiver_email: recipient.trim() } : { receiver_uid: recipient.trim() }),
      });
      setForce2FA(false);
      const orderNo = res?.order_number || res?.data?.order_number || "";
      const qp = new URLSearchParams({
        isTransfer: "true",
        amount,
        currency: "NGN",
        fee: "0",
        orderTime: new Date().toISOString(),
        ...(orderNo ? { orderNo } : {}),
        ...(isEmail ? { receiver_email: recipient.trim() } : { receiver_uid: recipient.trim() }),
      });
      router.push(`/fiat-withdraw-success?${qp.toString()}`);
    } catch (e) {
      const msg = getErrorMessage(e);
      // Backend says 2FA is required but none was provided — force the 2FA step
      if (!authCode && is2FAError(msg)) {
        setForce2FA(true);
        setPinModal(true);
      } else {
        setError({ visible: true, message: msg });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Internal Transfer</span>
        <div className="w-8" />
      </div>

      <div className="px-1 space-y-5">
        {/* Toggle */}
        <div className="flex bg-[#F0F4F8] rounded-2xl p-1 w-36">
          {(["Email", "UID"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all ${method === m ? "bg-white shadow text-primary" : "text-[#8E8E93]"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Recipient */}
        <div className={`flex items-center bg-[#EBF4FF] border rounded-xl px-4 h-14 ${recipientError && recipient ? "border-red-400" : "border-primary"}`}>
          <input
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            placeholder={method === "UID" ? "14-digit UID number" : "Enter recipient email"}
            autoCapitalize="none"
            type={method === "Email" ? "email" : "text"}
            inputMode={method === "UID" ? "numeric" : "email"}
            className="flex-1 text-sm text-[#1D3B53] bg-transparent outline-none placeholder-[rgba(142,142,147,0.4)]"
          />
          <button onClick={handlePaste} className="text-primary font-semibold text-sm cursor-pointer">Paste</button>
        </div>
        {recipient && recipientError ? (
          <p className="text-xs text-red-500 px-1">{recipientError}</p>
        ) : recipient && !recipientError ? (
          <p className="text-xs text-green-500 px-1">✓ Valid {method}</p>
        ) : (
          <p className="text-xs text-[#8E8E93] px-1">
            {method === "UID" ? "Enter the 14-digit numeric UID" : "Enter a valid email address"}
          </p>
        )}

        {/* Amount Input Card */}
        <div className="bg-[#EBF4FF] border border-primary rounded-2xl p-4">
          <p className="text-sm font-medium text-[#1D3B53] mb-3">Amount</p>
          <div className="flex items-center border-b border-[#D1D9E6] pb-3 mb-3">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 text-3xl font-bold bg-transparent outline-none text-[#1D3B53] placeholder-gray-300"
            />
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-[#DBE6F5] rounded-xl px-2 py-1">
                <div className="w-4 h-4 rounded-full bg-[#008751] flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">N</span>
                </div>
                <span className="text-sm font-semibold text-[#1D3B53]">NGN</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <button onClick={handleMax} className="text-sm text-primary font-bold cursor-pointer">Max</button>
            </div>
          </div>
          <div className="flex justify-end mb-1">
            <span className="text-xs text-[#8E8E93]">Fee: <span className="font-bold">0 NGN</span></span>
          </div>
          {parsedAmount > 0 && (
            <p className="text-sm font-bold text-[#1D3B53]">Total: {parsedAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })} NGN</p>
          )}
        </div>

        {/* Balance Box */}
        <div className={`rounded-xl p-4 border flex justify-between items-center ${exceedsBalance ? "bg-[#FFF5F5] border-[#D92D20]" : "bg-[#EBF4FF] border-primary"}`}>
          <div>
            <p className="text-xs text-[#8E8E93]">
              Available Balance:{" "}
              <span className={`font-bold text-sm ${exceedsBalance ? "text-[#D92D20]" : "text-primary"}`}>
                {availableBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </span>{" "}NGN
            </p>
            {exceedsBalance && <p className="text-xs text-[#D92D20] mt-0.5">Amount exceeds available balance.</p>}
          </div>
          <button onClick={() => router.push("/deposit-fiat")} className="flex items-center gap-1 text-xs font-medium text-[#1D3B53] cursor-pointer">
            <PlusCircle size={15} /> Add funds
          </button>
        </div>

        {/* Info */}
        <div className="flex items-center gap-2 bg-[#F0F7FF] rounded-lg px-4 py-3">
          <Info size={18} className="text-primary shrink-0" />
          <p className="text-xs text-primary">Internal transfers are instant and free of charge.</p>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 flex items-center justify-between z-30 md:left-[230px] xl:right-[304px]">
        <div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-black">{amount || "0"}</span>
            <span className="text-sm text-[#8E8E93] mb-0.5">NGN</span>
          </div>
          <p className="text-xs text-[#8E8E93]">Total to be sent</p>
        </div>
        <button
          onClick={handleTransfer}
          disabled={loading || !recipient || !!recipientError || parsedAmount <= 0 || exceedsBalance}
          className="bg-primary text-white font-bold py-3.5 px-10 rounded-2xl cursor-pointer disabled:opacity-50 min-w-[130px] text-center"
        >
          {loading ? "..." : "Transfer"}
        </button>
      </div>

      <P2PEnterPinModal visible={pinModal} onClose={() => { setPinModal(false); setForce2FA(false); }} onSubmit={onPin} needs2FA={force2FA || undefined} />
      <StatusModal visible={error.visible} onClose={() => setError({ visible: false, message: "" })} type="error" title="Error" message={error.message} />
    </div>
  );
}
