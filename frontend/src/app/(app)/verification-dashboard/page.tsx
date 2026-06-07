"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { kycService } from "@/services/kyc.service";
import { setCachedTier } from "@/hooks/useVerificationGate";
import { ArrowLeft, ChevronRight } from "lucide-react";

export default function VerificationDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState(0);
  const [tier2Status, setTier2Status] = useState<"none" | "in_progress" | "verified" | "rejected">("none");
  const [tier3Status, setTier3Status] = useState<"none" | "in_progress" | "verified" | "rejected">("none");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStatus(); }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await kycService.getKYCStatus();
      const status = res?.data;
      if (!status) return;
      const raw = status.tier;
      let tierNum = 0;
      if (typeof raw === "number") tierNum = raw;
      else if (typeof raw === "string") tierNum = parseInt(raw.replace("tier", ""), 10) || 0;
      setCurrentTier(tierNum);
      setCachedTier(tierNum); // keep shared gate cache in sync
      setRejectionReason(status.rejection_reason || "");
      
      if (tierNum === 1) {
        if (status.status === "pending") setTier2Status("in_progress");
        if (status.status === "rejected" && !status.nin_verified) setTier2Status("rejected");
      } else if (tierNum >= 2) {
        setTier2Status("verified");
        if (status.status === "pending") setTier3Status("in_progress");
        if (status.status === "rejected" && !status.address_verified) setTier3Status("rejected");
      }
      if (tierNum >= 3) setTier3Status("verified");
    } catch {} finally { setLoading(false); }
  };

  const u = user as Record<string, any> || {};
  const name = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || u.username || "User";
  const initials = name.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const getProgressWidth = () => {
    if (currentTier >= 3) return "100%";
    if (tier3Status === "in_progress") return "83%";
    if (currentTier >= 2) return "66%";
    if (tier2Status === "in_progress") return "40%";
    if (currentTier >= 1) return "33%";
    return "0%";
  };

  const getUpgradeLabel = () => {
    if (currentTier >= 3) return "Verification Complete";
    if (tier3Status === "in_progress") return "Verification in Progress";
    if (tier3Status === "rejected") return "Tier 3 Rejected";
    if (currentTier >= 2) return "Upgrade to Tier 3";
    if (tier2Status === "in_progress") return "Verification in Progress";
    if (tier2Status === "rejected") return "Tier 2 Rejected";
    if (currentTier === 1) return "Upgrade to Tier 2";
    return "Start Verification";
  };

  const handleUpgrade = () => {
    if (currentTier === 0) router.push("/tier1-basic");
    else if (currentTier === 1 && (tier2Status === "none" || tier2Status === "rejected")) router.push("/tier2-address");
    else if (currentTier === 2 && (tier3Status === "none" || tier3Status === "rejected")) router.push("/tier3-advanced");
  };

  const isUpgradeDisabled = tier2Status === "in_progress" || tier3Status === "in_progress" || currentTier >= 3;
    
  const StepCircle = ({ done, inProgress, label, num }: { done: boolean; inProgress: boolean; label: string; num: number }) => (
    <div className="flex flex-col items-center z-10">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1 ${done ? "bg-[#4CD964]" : inProgress ? "bg-orange-400" : label.includes("Rejected") ? "bg-red-500" : "bg-[#D1D5DB]"}`}>
        {inProgress ? "⏱" : done ? "✓" : label.includes("Rejected") ? "!" : num}
      </div>
      <span className="text-xs text-[#8E8E93]">{label}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
          <ArrowLeft size={18} className="text-[#1D3B53]" />
        </button>
        <span className="text-sm text-[#8E8E93]">My Profile / <span className="text-[#1D3B53]">Verification</span></span>
      </div>

      <h1 className="text-xl font-bold text-[#1D3B53] mb-6">Verification</h1>

      <div className="bg-[#F7F9FC] rounded-2xl p-5 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shrink-0">{initials}</div>
          <p className="text-base font-bold text-[#1D3B53]">{name}</p>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Tier {currentTier}
        </div>
      </div>

      {rejectionReason && (tier2Status === "rejected" || tier3Status === "rejected") && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 animate-in slide-in-from-top duration-300">
          <p className="text-xs font-bold text-red-600 mb-1 uppercase tracking-tight">Rejection Reason</p>
          <p className="text-sm text-red-700">{rejectionReason}</p>
        </div>
      )}

      {/* KYC Level Card */}
      <div className="bg-[#F9FAFB] rounded-2xl p-5 mb-5">
        <p className="text-xs font-bold text-[#8E8E93] mb-5">KYC Level</p>

        {/* Progress bar */}
        <div className="relative flex justify-between items-center px-4 mb-8">
          {/* Base line */}
          <div className="absolute left-8 right-8 top-4 h-1 bg-[#D1D5DB]" />
          {/* Fill line */}
          <div className="absolute left-8 top-4 h-1 bg-[#4CD964] transition-all" style={{ width: getProgressWidth(), maxWidth: "calc(100% - 4rem)" }} />
          <StepCircle done={currentTier >= 1} inProgress={false} label="Tier 1" num={1} />
          <StepCircle done={tier2Status === "verified" || currentTier >= 2} inProgress={tier2Status === "in_progress"} label={tier2Status === "rejected" ? "Tier 2 Rejected" : "Tier 2"} num={2} />
          <StepCircle done={tier3Status === "verified" || currentTier >= 3} inProgress={tier3Status === "in_progress"} label={tier3Status === "rejected" ? "Tier 3 Rejected" : "Tier 3"} num={3} />
        </div>

        <button
          onClick={handleUpgrade}
          disabled={isUpgradeDisabled}
          className="w-full bg-[#EBF4FF] rounded-lg py-3 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
        >
          <span className="text-primary font-semibold text-sm">{getUpgradeLabel()}</span>
          {!isUpgradeDisabled && <ChevronRight size={16} className="text-primary" />}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#E0E0E0]" />
        <span className="text-[#8E8E93] font-bold text-base">KYC Levels</span>
        <div className="flex-1 h-px bg-[#E0E0E0]" />
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {[
          { tier: 1, done: currentTier >= 1, items: ["Personal details", "BVN or NIN (your choice)"] },
          { tier: 2, done: tier2Status === "verified" || currentTier >= 2, items: ["The other identity (NIN if Tier 1 was BVN, or BVN if Tier 1 was NIN)"] },
        ].map(t => (
          <div
            key={t.tier}
            className={`rounded-xl p-5 ${t.done ? "bg-[#EBF4FF] border border-primary" : "bg-[#F9FAFB]"}`}
          >
            <p className="text-sm font-bold text-[#1D3B53] mb-2">Tier {t.tier}</p>
            <ul className="space-y-1">
              {t.items.map(item => (
                <li key={item} className="text-xs text-[#555]">• {item}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className={`rounded-xl p-5 md:col-span-2 ${(tier3Status === "verified" || currentTier >= 3) ? "bg-[#EBF4FF] border border-primary" : "bg-[#F9FAFB]"}`}>
          <p className="text-sm font-bold text-[#1D3B53] mb-2">Tier 3</p>
          <ul className="space-y-1">
            <li className="text-xs text-[#555]">• NIN</li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#E0E0E0]" />
        <span className="text-[#8E8E93] font-bold text-base">Level Limits</span>
        <div className="flex-1 h-px bg-[#E0E0E0]" />
      </div>

      {/* Limits Table */}
      <div className="bg-[#FFF8F0] rounded-2xl p-5 mb-3">
        <div className="flex justify-between mb-3">
          <span className="text-sm font-bold text-orange-400 flex-1">Tier</span>
          <span className="text-sm font-bold text-orange-400 flex-1 text-center">Daily Limit</span>
          <span className="text-sm font-bold text-orange-400 flex-1 text-right">Maximum Balance</span>
        </div>
        {[
          { tier: "Tier 1", daily: "$1,000", max: "$5,000" },
          { tier: "Tier 2", daily: "$5,000", max: "$50,000" },
          { tier: "Tier 3", daily: "$10,000", max: "Unlimited" },
        ].map(row => (
          <div key={row.tier} className="flex justify-between mb-2">
            <span className="text-xs text-[#555] flex-1">{row.tier}</span>
            <span className="text-xs text-[#555] flex-1 text-center">{row.daily}</span>
            <span className="text-xs text-[#555] flex-1 text-right">{row.max}</span>
          </div>
        ))}
        <div className="border-t border-black/5 mt-3 pt-2">
          <span className="text-xs text-orange-400 font-bold">NGN Rate: 1500/$</span>
        </div>
      </div>

      <div className="text-center mb-5 space-y-1">
        <p className="text-xs text-[#8E8E93] italic">
          Withdrawal limits apply only to fiat withdrawals, not to crypto withdrawals or trading.
        </p>
        <p className="text-xs text-[#8E8E93]">
          Need a higher limit?{" "}
          <a href="mailto:support@kynettic.com" className="text-primary underline">
            Contact support@kynettic.com
          </a>
        </p>
      </div>

      {currentTier >= 1 && (
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer">
          Go to Wallet
        </button>
      )}
    </div>
  );
}
