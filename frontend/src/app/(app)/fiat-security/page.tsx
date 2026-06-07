"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
export default function FiatSecurityPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.push("/security-settings")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Fiat Security</h1>
      <div className="bg-white rounded-2xl p-6 text-center">
        <Shield size={48} className="text-primary mx-auto mb-4"/>
        <h3 className="font-bold text-lg mb-2">Your fiat is secure</h3>
        <p className="text-sm text-gray-500">All fiat deposits are protected by our security protocols. Withdrawals require PIN verification.</p>
      </div>
    </div>
  );
}
