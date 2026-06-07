"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notificationService } from "@/services/notification.service";
import { Bell, Settings } from "lucide-react";
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { notificationService.getNotifications().then(r => setNotifications(r.data||[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  return (
    <div>
      <div className="flex items-center justify-between mb-6"><h1 className="text-xl font-bold">Notifications</h1>
        <button onClick={() => router.push("/manage-notifications")} className="text-primary cursor-pointer"><Settings size={20}/></button>
      </div>
      <div className="bg-white rounded-2xl p-5">
        {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : notifications.length === 0 ? (
          <div className="text-center py-16"><Bell size={48} className="text-gray-200 mx-auto mb-4"/><p className="text-gray-400">No notifications yet</p></div>
        ) : notifications.map((n: any, i: number) => (
          <button key={i} onClick={() => router.push(`/notification-details?id=${n.id}`)} className="w-full flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 text-left cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bell size={16} className="text-primary"/></div>
            <div className="min-w-0"><p className="text-sm font-semibold truncate">{n.title}</p><p className="text-xs text-gray-400 truncate">{n.body || n.message}</p><p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}
