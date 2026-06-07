"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import LoadingScreen from "@/components/LoadingScreen";
import { Menu, Bell, Mail } from "lucide-react";
import { notificationService } from "@/services/notification.service";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isInitializing } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isInitializing && !loading) {
      if (!user) { router.replace("/login"); }
      else {
        setReady(true);
        notificationService.getNotifications(1, "unread")
          .then(r => setUnreadCount((r.data || []).length))
          .catch(() => {});
      }
    }
  }, [user, loading, isInitializing, router]);

  if (isInitializing || loading || !ready) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen bg-white w-full overflow-x-hidden">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 md:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-1 cursor-pointer">
          <Menu size={22} className="text-gray-700" />
        </button>
        <img src="/assets/iconletter.png" alt="Kynettic" className="h-7 object-contain" />
        <button onClick={() => { router.push("/notifications"); setUnreadCount(0); }} className="relative w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center cursor-pointer">
          <Bell size={18} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <main className="flex-1 ml-0 md:ml-[230px] p-4 md:p-6 pt-[68px] md:pt-6 flex flex-col w-full min-w-0">
        {/* Desktop top bar */}
        <div className="hidden md:flex justify-between items-center mb-6 bg-gray-100 px-5 py-3 rounded-2xl">
          <h1 className="text-gray-500 font-medium text-base">
            {(() => {
              const p = pathname.split('/')[1];
              if (!p) return "";
              if (p.toLowerCase() === "p2p") return "P2P";
              return p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            })()}
          </h1>
          <button 
            onClick={() => { router.push("/notifications"); setUnreadCount(0); }} 
            className="relative w-9 h-9 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          >
            <Mail size={18} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 min-w-0">{children}</div>
          {pathname !== "/history" && <RightSidebar />}
        </div>
      </main>
    </div>
  );
}
