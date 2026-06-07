"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
const SETTINGS = [{ key: "push", label: "Push Notifications" }, { key: "email", label: "Email Notifications" }, { key: "trades", label: "Trade Updates" }, { key: "promo", label: "Promotions" }];
export default function ManageNotificationsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string,boolean>>({ push: true, email: true, trades: true, promo: false });
  const toggle = (k: string) => setSettings(s => ({ ...s, [k]: !s[k] }));
  return (
    <div>
      <button onClick={() => router.push("/profile")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Manage Notifications</h1>
      <div className="bg-white rounded-2xl p-5 space-y-1">
        {SETTINGS.map(s => (
          <div key={s.key} className="flex items-center justify-between py-3">
            <span className="text-sm font-medium">{s.label}</span>
            <button onClick={() => toggle(s.key)} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${settings[s.key]?"bg-primary":"bg-gray-300"}`}>
              <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${settings[s.key]?"translate-x-4":"translate-x-0"}`}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
