"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import { useRequirePin } from "@/hooks/useRequirePin";
import { getErrorMessage } from "@/utils/errorHandler";

function CryptoInternalTransferContent() {
  const router = useRouter();
  const requirePin = useRequirePin();
  const params = useSearchParams();
  const coin = params.get("coin") || "BTC";
  const currencyId = params.get("currencyId") || "";

  const { getWalletByCurrency, internalTransfer } = useWallet();
  const wallet = getWalletByCurrency(coin);
  const availableBalance = wallet
    ? parseFloat(String(wallet.balance || 0)) - parseFloat(String(wallet.locked_balance || 0))
    : 0;

  const [recipientType, setRecipientType] = useState<"email" | "uid">("email");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [force2FA, setForce2FA] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const exceedsBalance = parsedAmount > availableBalance;

  const recipientError = (() => {
    if (!recipient) return "";
    if (recipientType === "email") {
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

  const handleTransfer = () => {
    setError("");
    if (!recipient) { setError(`Please enter the recipient's ${recipientType.toUpperCase()}`); return; }
    if (recipientError) { setError(recipientError); return; }
    if (!amount || parsedAmount <= 0) { setError("Please enter a valid amount"); return; }
    if (exceedsBalance) { setError("Insufficient balance"); return; }
    requirePin(() => setPinModal(true));
  };

  const is2FAError = (msg: string) =>
    /2fa|two.?factor|auth.?code|totp|otp/i.test(msg);

  const onPin = async (pin: string, authCode?: string) => {
    setPinModal(false);
    setLoading(true);
    setError("");
    try {
      const res = await internalTransfer({
        amount,
        auth_code: authCode || "",
        currency_id: currencyId || String(wallet?.currency_id || ""),
        pin,
        ...(recipientType === "email" ? { receiver_email: recipient } : { receiver_uid: recipient }),
      });
      setForce2FA(false);
      const orderNo = res?.order_number || res?.data?.order_number || "";
      const qp = new URLSearchParams({
        amount,
        currency: coin,
        fee: "0",
        method: "Internal Transfer",
        orderTime: new Date().toISOString(),
        ...(orderNo ? { orderNo } : {}),
      });
      router.push(`/withdraw-success?${qp.toString()}`);
    } catch (e) {
      const msg = getErrorMessage(e);
      if (!authCode && is2FAError(msg)) {
        setForce2FA(true);
        setPinModal(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-4">
        <button onClick={() => router.push("/withdraw-search")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">{coin} - Internal Transfer</span>
        <div className="w-8" />
      </div>

      {/* Recipient Type Tabs */}
      <div className="flex bg-[#EBF4FF] rounded-xl p-1 mb-6">
        {(["email", "uid"] as const).map(t => (
          <button
            key={t}
            onClick={() => setRecipientType(t)}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
              recipientType === t
                ? "bg-white shadow text-[#1D3B53]"
                : "text-[#8E8E93]"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}

      {/* Recipient Input */}
      <label className="block text-sm text-gray-600 mb-2">
        Recipient ({recipientType.toUpperCase()})
      </label>
      <div className={`flex items-center bg-[#EBF4FF] border rounded-xl px-4 h-14 mb-1 gap-3 ${recipientError && recipient ? "border-red-400" : "border-primary"}`}>
        <input
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          placeholder={recipientType === "uid" ? "14-digit UID number" : `Enter receiver's email`}
          type={recipientType === "email" ? "email" : "text"}
          inputMode={recipientType === "uid" ? "numeric" : "email"}
          autoCapitalize="none"
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
        />
        <button onClick={handlePaste} className="text-primary text-sm font-semibold cursor-pointer shrink-0">
          Paste
        </button>
      </div>
      {recipient && recipientError ? (
        <p className="text-xs text-red-500 mb-3 px-1">{recipientError}</p>
      ) : recipient && !recipientError ? (
        <p className="text-xs text-green-500 mb-3 px-1">✓ Valid {recipientType.toUpperCase()}</p>
      ) : (
        <p className="text-xs text-[#8E8E93] mb-3 px-1">
          {recipientType === "uid" ? "Enter the 14-digit numeric UID" : "Enter a valid email address"}
        </p>
      )}

      {/* Amount Input */}
      <label className="block text-sm text-gray-600 mb-2">Amount</label>
      <div className="flex items-center bg-[#EBF4FF] border border-primary rounded-xl px-4 h-14 mb-4 gap-3">
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          type="number"
          inputMode="decimal"
          className="flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder-gray-400"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-600">{coin}</span>
          <div className="w-px h-4 bg-gray-300" />
          <button onClick={() => setAmount(availableBalance.toString())} className="text-primary text-sm font-semibold cursor-pointer">
            Max
          </button>
        </div>
      </div>

      {/* Balance Box */}
      <div className={`p-4 rounded-xl border mb-1 ${exceedsBalance ? "bg-[#FFF5F5] border-[#FF3B30]" : "bg-[#FFF9EB] border-[#FFE0B2]"}`}>
        <p className="text-xs text-[#8E8E93]">
          Available Balance:{" "}
          <span className={`font-bold text-sm ${exceedsBalance ? "text-[#FF3B30]" : "text-[#F5A623]"}`}>
            {availableBalance.toFixed(6)}
          </span>{" "}
          {coin}
        </p>
      </div>
      {exceedsBalance && (
        <p className="text-xs text-[#FF3B30] mb-4 px-1">Amount exceeds available balance.</p>
      )}

      {/* Info Box */}
      <div className="flex items-center gap-3 bg-[#F0F7FF] rounded-xl p-3 mt-6 mb-8">
        <Info size={18} className="text-primary shrink-0" />
        <p className="text-xs text-primary">Internal transfers are instant and free of charge.</p>
      </div>

      {/* Transfer Button */}
      <div className="border-t border-gray-100 pt-5">
        <button
          onClick={handleTransfer}
          disabled={loading || !recipient || !!recipientError || parsedAmount <= 0 || exceedsBalance}
          className="w-full bg-primary text-white font-bold text-base py-4 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {loading ? "Sending..." : "Transfer"}
        </button>
      </div>

      <P2PEnterPinModal visible={pinModal} onClose={() => { setPinModal(false); setForce2FA(false); }} onSubmit={onPin} needs2FA={force2FA || undefined} />
    </div>
  );
}

export default function CryptoInternalTransferPage() {
  return <Suspense><CryptoInternalTransferContent /></Suspense>;
}
