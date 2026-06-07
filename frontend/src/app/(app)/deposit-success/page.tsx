"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export default function DepositSuccessPage() {
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-2">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="font-bold text-base text-[#1D3B53]">Add money via bank transfer</span>
        <div className="w-8" />
      </div>

      {/* Illustration + text */}
      <div className="flex flex-col items-center pt-10 pb-6 text-center">
        <div className="mb-10">
          <CheckCircle2 size={120} className="text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-bold text-[#34C759] mb-3">Deposit Confirmed</h1>
        <p className="text-sm text-[#8E8E93] leading-relaxed max-w-xs">
          Your deposit was successful. The funds have been added to your wallet and you can view the details in your transaction history.
        </p>
      </div>

      <div className="flex-1" />

      {/* Buttons */}
      <div className="space-y-4 mt-8">
        <button
          onClick={() => router.push("/wallet")}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
        >
          Go to wallet
        </button>
        <button
          onClick={() => router.push("/history")}
          className="w-full bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
