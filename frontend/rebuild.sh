#!/bin/bash
BASE="/Users/home/Desktop/kynettic-web/src"

# Sidebar
cat > "$BASE/components/Sidebar.tsx" << 'EOF'
"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Wallet, ArrowLeftRight, ClipboardList, History, Megaphone, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const links = [
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/p2p", label: "P2P Trading", icon: ArrowLeftRight },
  { href: "/my-ads", label: "My Ads", icon: Megaphone },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const initial = (user as any)?.first_name?.charAt(0)?.toUpperCase() || "U";

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 min-h-screen p-6 sticky top-0">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-10">
        <Image src="/KynetticLogo.png" alt="Kynettic" width={32} height={32} className="w-8 h-8 object-contain" />
        <span className="text-[#1D3B53]">Kynettic</span>
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-[#4472B7] flex items-center justify-center text-white font-bold">{initial}</div>
        <div>
          <p className="text-sm font-semibold text-[#1D3B53]">{(user as any)?.first_name || "User"}</p>
          <p className="text-xs text-gray-400">{(user as any)?.email || ""}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link key={link.href} href={link.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${active ? "bg-[#4472B7] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              <link.icon size={20} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button onClick={() => logout()} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors mt-4">
        <LogOut size={20} /> Logout
      </button>
    </aside>
  );
}
EOF

# RightSidebar
cat > "$BASE/components/RightSidebar.tsx" << 'EOF'
import Link from "next/link";

export default function RightSidebar({ children }: { children?: React.ReactNode }) {
  return (
    <aside className="hidden xl:flex flex-col w-80 bg-white border-l border-gray-100 min-h-screen p-6 sticky top-0">
      {children || (
        <div className="bg-gradient-to-br from-[#3B5998] to-[#4472B7] rounded-2xl p-6 text-white">
          <h3 className="font-bold text-lg mb-2">P2P Trading</h3>
          <p className="text-white/80 text-sm mb-4">Trade crypto instantly with automated settlement.</p>
          <Link href="/p2p" className="inline-block bg-white text-[#4472B7] px-5 py-2 rounded-full text-sm font-bold hover:opacity-90 transition-opacity">Start Trading</Link>
        </div>
      )}
    </aside>
  );
}
EOF

# App Layout
cat > "$BASE/app/(app)/layout.tsx" << 'EOF'
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !isAuthenticated) router.push("/login"); }, [isAuthenticated, loading, router]);
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#4472B7] border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated) return null;
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <RightSidebar />
    </div>
  );
}
EOF

echo "Sidebar + App layout created"
