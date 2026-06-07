"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";

const SUMMARY = [
  { label: "Completed order(s) in 30 Days:", value: "30 Order(s)" },
  { label: "All Completed orders:", value: "3065 Order(s)" },
];
const STATS = [
  { label: "Day(s) Since Account Creation:", value: "905(s)" },
  { label: "Day(s) From First Trade:", value: "756(s)" },
  { label: "30-Day Trading Volume:", value: "35,000 USDT" },
  { label: "Approx. Total Trading Volume:", value: "723,419.71 USDT" },
];

export default function AccountSummaryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const u = user as Record<string, any> || {};

  // Override stats with real user data if available
  const createdAt = u.created_at ? new Date(u.created_at) : null;
  const daysSinceCreation = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / 86400000)
    : null;

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 bg-white border-b border-gray-100 mb-5 -mx-4 px-4 md:-mx-6 md:px-6">
        <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Account summary</span>
        <div className="w-8" />
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        {SUMMARY.map((item, i) => (
          <div key={i} className="flex justify-between items-center mb-4 last:mb-0">
            <span className="text-sm text-[#8E8E93] flex-1 pr-4">{item.label}</span>
            <span className="text-sm font-semibold text-gray-600 text-right">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        {STATS.map((item, i) => {
          let value = item.value;
          if (i === 0 && daysSinceCreation !== null) value = `${daysSinceCreation}(s)`;
          return (
            <div key={i} className="flex justify-between items-center mb-4 last:mb-0">
              <span className="text-sm text-[#8E8E93] flex-1 pr-4">{item.label}</span>
              <span className="text-sm font-semibold text-gray-600 text-right">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
