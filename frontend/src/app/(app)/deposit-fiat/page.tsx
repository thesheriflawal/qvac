"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import Image from "next/image";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";

export default function DepositFiatPage() {
  const router = useRouter();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true); setError("");
    try {
      const r = await walletService.getDepositAccount();
      const d = r?.data || r;
      if (d?.account_number) setAccount(d);
      else setError("Failed to load account details. Please try again later.");
    } catch (e) {
      setError(getErrorMessage(e) || "Failed to load account details.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    setTimeout(() => navigator.clipboard.writeText(""), 60000);
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-6">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Deposit Fiat</span>
        <div className="w-8" />
      </div>

      <div className="px-1">
        <h2 className="text-xl font-bold text-[#1D3B53] mb-2">Fund your NGN Wallet</h2>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          Make a bank transfer to the account below to top up your wallet.
        </p>

        {/* Nomba trust badge */}
        <div className="flex items-center justify-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3.5 py-2.5 mb-6 shadow-sm">
          <span className="text-xs text-gray-400">Bank transfers secured by</span>
          <Image src="/NOMBA.png" alt="Nomba" width={56} height={20} className="object-contain" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-[#8E8E93]">Loading account details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-2xl p-6 flex flex-col items-center text-center">
            <AlertCircle size={48} className="text-red-400 mb-3" />
            <p className="text-sm text-red-500 mb-4 leading-relaxed">{error}</p>
            <button
              onClick={fetch}
              className="flex items-center gap-2 bg-red-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm cursor-pointer"
            >
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        ) : account ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 divide-y divide-gray-100 mb-5">
              {[
                { label: "Bank Name", value: account.bank_name, key: "bank" },
                { label: "Account Number", value: account.account_number, key: "number" },
                { label: "Account Name", value: account.account_name, key: "name" },
              ].map(row => (
                <div key={row.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <span className="text-sm text-[#8E8E93]">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1D3B53]">{row.value || "---"}</span>
                    {row.value && (
                      <button onClick={() => copy(row.value, row.key)} className="text-primary cursor-pointer">
                        {copied === row.key
                          ? <CheckCircle2 size={16} className="text-green-500" />
                          : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#FFF8E7] border border-yellow-200 rounded-xl px-4 py-3 mb-3">
              <p className="text-xs text-yellow-700 font-medium">Deposit fee: 1% of amount deposited, capped at ₦100.</p>
            </div>
            <p className="text-xs text-[#8E8E93] text-center">
              Deposits are typically reflected within minutes.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
