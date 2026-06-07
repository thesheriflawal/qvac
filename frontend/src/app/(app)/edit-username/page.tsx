"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Info } from "lucide-react";

export default function EditUsernamePage() {
  const router = useRouter();
  const { user } = useAuth();
  const u = user as Record<string, any> || {};

  return (
    <div>
      <button onClick={() => router.push("/personal-details")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-xl font-bold mb-6">Username</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        <label className="text-sm text-gray-600 block mb-1">Username</label>
        <input
          value={u.username || ""}
          readOnly
          className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-2 bg-gray-50 text-gray-500"
        />
        <div className="flex items-start gap-2 bg-[#F0F7FF] rounded-lg px-3 py-2 mb-4">
          <Info size={15} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-primary">Username is set during account verification and cannot be changed. Contact support if you need to update this.</p>
        </div>
      </div>
    </div>
  );
}
