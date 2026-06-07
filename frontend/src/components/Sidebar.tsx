"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, Clock, RefreshCw, SquareCheckBig, ClipboardList, X, Gift, HelpCircle, LogOut, ArrowLeftRight, Bot } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/hooks/useVerificationGate";

const NAV = [
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "History", href: "/history", icon: Clock },
  { name: "P2P", href: "/p2p", icon: RefreshCw },
  { name: "Orders", href: "/orders", icon: SquareCheckBig },
  { name: "Swap", href: "/swap", icon: ArrowLeftRight },
  { name: "My Ads", href: "/my-ads", icon: ClipboardList },
  { name: "AI Agents", href: "/agents", icon: Bot },
  { name: "Referrals", href: "/referrals", icon: Gift },
];

const BOTTOM_NAV = [
  { name: "FAQs", href: "/support", icon: HelpCircle },
];

export default function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isVerified, requireVerification } = useVerificationGate();
  const displayName = (user as Record<string, string>)?.username || (user as Record<string, string>)?.first_name || (user as Record<string, string>)?.name || "User";
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  const handleLogout = async () => {
    onMobileClose();
    await logout();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onMobileClose} />
      )}

      <aside className={`w-[230px] h-screen h-dvh bg-white md:bg-[#DAE3F1] border-r md:border-none border-gray-100 flex flex-col fixed left-0 top-0 z-40 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 overflow-hidden`}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <img src="/assets/iconletter.png" alt="Kynettic" className="h-7 object-contain" />
          <button className="md:hidden p-1 cursor-pointer" onClick={onMobileClose}>
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        
        <div className="px-5 mb-1 shrink-0">
          <p className="text-[10px] font-semibold text-primary tracking-wide uppercase">Menu</p>
        </div>

        {/* Navigation area - No scroll on mobile */}
        <div className="flex-1 flex flex-col min-h-0">
          <nav className="px-3 md:overflow-y-visible">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const isP2P = item.name === "P2P";
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (isP2P) requireVerification(() => { onMobileClose(); router.push(item.href); });
                    else { onMobileClose(); router.push(item.href); }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors cursor-pointer ${active ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-50"} ${!isVerified && isP2P ? "grayscale opacity-60" : ""}`}
                >
                  <item.icon size={18} /><span>{item.name}</span>
                </button>
              );
            })}

            <div className="my-1 border-t border-gray-100 md:border-[#C4D5F2] md:my-2" />

            <button onClick={() => { router.push("/profile"); onMobileClose(); }} className="w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg md:hover:bg-white/40 hover:bg-gray-50 transition-colors cursor-pointer text-left">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shrink-0">{displayName.charAt(0).toUpperCase()}</div>
              <span className="text-sm font-semibold text-gray-800 truncate">{displayName}</span>
            </button>
          </nav>
        </div>

        {/* Bottom section - always visible at the bottom */}
        <div className={`px-3 ${isAndroid ? "pb-20" : "pb-8"} shrink-0 border-t border-gray-100 pt-2 mt-auto`}>
          {BOTTOM_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.name} href={item.href} onClick={onMobileClose} className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-50"}`}>
                <item.icon size={18} /><span>{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg mb-0.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut size={18} /><span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
