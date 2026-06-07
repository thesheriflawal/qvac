"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertTriangle, Copy, CheckCircle2 } from "lucide-react";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";

interface DepositAccount {
  account_name: string;
  account_number: string;
  bank_name: string;
}

function BankTransferContent() {
  const router = useRouter();
  const params = useSearchParams();
  const currencyCode = params.get("currency") || "NGN";
  const currencyName = params.get("currencyName") || "Nigerian Naira";
  const amount = params.get("amount") || "0";

  const [account, setAccount] = useState<DepositAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    walletService.getDepositAccount()
      .then(r => {
        const d = r?.data || r;
        if (d?.account_number) setAccount({ account_name: d.account_name || "", account_number: d.account_number, bank_name: d.bank_name || "" });
        else setError("Could not load deposit account details. Please try again.");
      })
      .catch(e => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    setTimeout(() => navigator.clipboard.writeText(""), 60000);
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/currency-selector")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <span className="font-bold text-base text-[#1D3B53]">Add money via bank transfer</span>
        <div className="w-8" />
      </div>

      {/* Warning Card */}
      <div className="bg-[#FFF9EB] rounded-xl p-4 flex gap-3 mb-5">
        <AlertTriangle size={20} className="text-[#F5A623] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#F5A623] mb-1">No Third Party Transactions</p>
          <p className="text-xs text-[#8E7356] leading-relaxed">
            All deposits and withdrawals must come from accounts in your own name. Any third party activity will be rejected for security reasons.
          </p>
        </div>
      </div>

      {/* Currency Summary Card */}
      <div className="bg-[#F7F9FC] rounded-xl p-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#008751] flex items-center justify-center">
            <span className="text-white font-bold text-base">{currencyCode.charAt(0)}</span>
          </div>
          <div>
            <p className="font-bold text-sm text-[#1D3B53]">{currencyCode}</p>
            <p className="text-xs text-[#8E8E93]">{currencyName}</p>
          </div>
        </div>
        <span className="font-bold text-sm text-[#1D3B53]">{amount} {currencyCode}</span>
      </div>

      <h3 className="font-bold text-base text-[#1D3B53] mb-3">Bank Details</h3>

      {loading ? (
        <div className="flex flex-col items-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-[#8E8E93]">Loading account details...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-8 px-5 text-center">
          <p className="text-sm text-[#D92D20] mb-4">{error}</p>
          <button onClick={() => router.push("/currency-selector")} className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm cursor-pointer">
            Go Back
          </button>
        </div>
      ) : account ? (
        <>
          {/* Bank Details Card */}
          <div className="bg-[#F7F9FC] rounded-xl p-5 mb-5 space-y-5">
            {[
              { label: "Account Name", value: account.account_name, key: "name" },
              { label: "Account Number", value: account.account_number, key: "number" },
              { label: "Bank Name", value: account.bank_name, key: "bank" },
            ].map(row => (
              <div key={row.key} className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#8E8E93] mb-0.5">{row.label}</p>
                  <p className="text-sm font-bold text-[#1D3B53]">{row.value}</p>
                </div>
                <button onClick={() => copy(row.value, row.key)} className="text-[#8E8E93] cursor-pointer ml-4 shrink-0">
                  {copied === row.key ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
                </button>
              </div>
            ))}
          </div>

          {/* Share Details */}
          <button className="w-full bg-[#B09B7C] text-white font-bold py-4 rounded-xl cursor-pointer mb-6">
            Share Details
          </button>

          {/* Bottom Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push("/deposit-success")}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
            >
              I have made the transfer
            </button>
            <button
              onClick={() => router.push("/currency-selector")}
              className="w-full bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer"
            >
              Cancel transfer
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function BankTransferPage() {
  return <Suspense><BankTransferContent /></Suspense>;
}
