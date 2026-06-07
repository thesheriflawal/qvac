#!/bin/bash
cd /Users/home/Desktop/kynettic-web

# Ensure directories
mkdir -p src/components/{landing,modals} src/app/\(auth\)/{login,signup,signup-step3,otp,forgot-password,forgot-password-otp,create-new-password,password-changed,account-created,welcome}

#=============================================================================
# SHARED COMPONENTS
#=============================================================================
cat > src/components/LoadingScreen.tsx << 'EOF'
export default function LoadingScreen() { return <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>; }
EOF

cat > src/components/Sidebar.tsx << 'SEOF'
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, Clock, ArrowLeftRight, SquareCheckBig, List, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "History", href: "/history", icon: Clock },
  { name: "P2P", href: "/p2p", icon: ArrowLeftRight },
  { name: "Orders", href: "/orders", icon: SquareCheckBig },
  { name: "My Ads", href: "/my-ads", icon: List },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const displayName = (user as Record<string,string>)?.first_name || (user as Record<string,string>)?.username || "User";
  return (
    <aside className="w-[230px] min-h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-40">
      <div className="px-5 pt-5 pb-4"><img src="/assets/iconletter.png" alt="Kynettic" className="h-7 object-contain" /></div>
      <div className="px-5 mb-2"><p className="text-xs font-semibold text-primary tracking-wide">Menu</p></div>
      <nav className="flex-1 px-3">
        {NAV.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + "/"); return (
          <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-50"}`}>
            <item.icon size={18} /><span>{item.name}</span>
          </Link>
        ); })}
      </nav>
      <div className="px-3 pb-3">
        <button onClick={() => router.push("/profile")} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-primary text-white cursor-pointer hover:bg-primary/90 mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">{displayName.charAt(0).toUpperCase()}</div>
          <span className="text-sm font-semibold truncate">{displayName}</span>
        </button>
      </div>
    </aside>
  );
}
SEOF

cat > src/components/RightSidebar.tsx << 'SEOF'
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
const CARDS = [
  { title: "Click here to Buy Bulk Coins", desc: "Purchase large coin amounts directly from us.", href: "/bulk-coins-purchase", bg: "bg-gradient-to-br from-[#4472B7] to-[#2d5a9e]", image: "/bitcoin.png" },
  { title: "P2P Trading", desc: "Buy and sell crypto automatically on the P2P market. Fast and secured.", href: "/p2p", bg: "bg-gradient-to-br from-[#4472B7] to-[#355f9e]", image: "/ethereum.png" },
];
export default function RightSidebar({ children }: { children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((p) => (p + 1) % CARDS.length), 5000); return () => clearInterval(t); }, []);
  const c = CARDS[i];
  return (
    <aside className="w-[280px] shrink-0 hidden xl:block">
      <div className="sticky top-6 space-y-4">
        {children}
        <div className={`${c.bg} rounded-2xl p-6 text-white text-center`}>
          <div className="w-32 h-32 mx-auto mb-4"><img src={c.image} alt="" className="w-full h-full object-contain" /></div>
          <h3 className="font-bold text-lg mb-2">{c.title}</h3>
          <p className="text-white/80 text-sm mb-4">{c.desc}</p>
          <Link href={c.href} className="inline-flex items-center gap-1 bg-white text-gray-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-100">{c.title.includes("Bulk") ? "Click Here" : "P2P Trading"} &rsaquo;</Link>
        </div>
        <div className="flex justify-center gap-1.5">{CARDS.map((_, idx) => (<button key={idx} onClick={() => setI(idx)} className={`w-2 h-2 rounded-full cursor-pointer ${idx === i ? "bg-primary" : "bg-gray-300"}`} />))}</div>
      </div>
    </aside>
  );
}
SEOF

cat > src/components/VerificationGateModal.tsx << 'EOF'
"use client";
import { X, ShieldAlert } from "lucide-react";
export default function VerificationGateModal({ visible, onClose, onVerify }: { visible: boolean; onClose: () => void; onVerify: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 cursor-pointer"><X size={20}/></button>
        <ShieldAlert size={48} className="text-primary mx-auto mb-4"/>
        <h3 className="font-bold text-lg mb-2">Verification Required</h3>
        <p className="text-sm text-gray-500 mb-6">Complete identity verification to access this feature.</p>
        <button onClick={onVerify} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer hover:bg-primary/90">Verify Now</button>
      </div>
    </div>
  );
}
EOF

cat > src/components/FilterModal.tsx << 'EOF'
"use client";
import { X } from "lucide-react";
import { useState } from "react";
export default function FilterModal({ visible, onClose, onApply }: { visible: boolean; onClose: () => void; onApply: (f: Record<string,string>) => void }) {
  const [type, setType] = useState("all"); const [period, setPeriod] = useState("all");
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Filters</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
        <label className="text-sm text-gray-500 block mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm">{["all","deposit","withdrawal","trade"].map(t=><option key={t} value={t}>{t}</option>)}</select>
        <label className="text-sm text-gray-500 block mb-1">Period</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-sm">{["all","today","week","month"].map(t=><option key={t} value={t}>{t}</option>)}</select>
        <div className="flex gap-3">
          <button onClick={() => { setType("all"); setPeriod("all"); }} className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold cursor-pointer">Reset</button>
          <button onClick={() => { onApply({ type, period }); onClose(); }} className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold cursor-pointer">Apply</button>
        </div>
      </div>
    </div>
  );
}
EOF

cat > src/components/TransactionItem.tsx << 'EOF'
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
export default function TransactionItem({ type, asset, amount, date, status }: { type: string; asset: string; amount: string; date: string; status: string }) {
  const isReceive = type.toLowerCase().includes("receive") || type.toLowerCase().includes("deposit");
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isReceive ? "bg-green-100" : "bg-red-100"}`}>
          {isReceive ? <ArrowDownLeft size={16} className="text-green-600"/> : <ArrowUpRight size={16} className="text-red-500"/>}
        </div>
        <div><p className="text-sm font-semibold">{type} {asset}</p><p className="text-xs text-gray-400">{date}</p></div>
      </div>
      <div className="text-right"><p className="text-sm font-semibold">{amount}</p><p className={`text-xs ${status === "confirmed" || status === "completed" ? "text-green-500" : "text-yellow-500"}`}>{status}</p></div>
    </div>
  );
}
EOF

#=============================================================================
# MODALS
#=============================================================================
cat > src/components/modals/ConfirmationModal.tsx << 'EOF'
"use client";
import { X } from "lucide-react";
export default function ConfirmationModal({ visible, onClose, onConfirm, title, message, confirmText = "Confirm", loading = false, variant = "primary" }: { visible: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; loading?: boolean; variant?: "danger" | "primary" }) {
  if (!visible) return null;
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{title}</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
    <p className="text-sm text-gray-500 mb-6">{message}</p>
    <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold cursor-pointer">Cancel</button>
    <button onClick={onConfirm} disabled={loading} className={`flex-1 py-3 rounded-xl font-semibold text-white cursor-pointer disabled:opacity-50 ${variant==="danger"?"bg-red-500":"bg-primary"}`}>{loading ? "..." : confirmText}</button></div>
  </div></div>);
}
EOF

cat > src/components/modals/StatusModal.tsx << 'EOF'
"use client";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
const icons = { success: { I: CheckCircle2, bg: "bg-green-100", c: "text-green-500" }, error: { I: XCircle, bg: "bg-red-100", c: "text-red-500" }, warning: { I: AlertCircle, bg: "bg-yellow-100", c: "text-yellow-500" } };
export default function StatusModal({ visible, onClose, type, title, message, buttonText = "Done", onButtonClick }: { visible: boolean; onClose: () => void; type: "success"|"error"|"warning"; title: string; message: string; buttonText?: string; onButtonClick?: () => void }) {
  if (!visible) return null;
  const { I, bg, c } = icons[type];
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 text-center">
    <div className={`w-16 h-16 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}><I size={32} className={c}/></div>
    <h3 className="font-bold text-lg mb-2">{title}</h3><p className="text-sm text-gray-500 mb-6">{message}</p>
    <button onClick={onButtonClick || onClose} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">{buttonText}</button>
  </div></div>);
}
EOF

cat > src/components/modals/DepositModal.tsx << 'EOF'
"use client";
import { useState } from "react";
import { X, Copy, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
type Step = "choose"|"crypto"|"fiat-currency"|"fiat-bank"|"success"|"failed";
const NETS = [{name:"Bitcoin (BTC)",net:"BTC",addr:"bc1q...demo"},{name:"Ethereum (ERC-20)",net:"ERC20",addr:"0x...demo"},{name:"Tron (TRC-20)",net:"TRC20",addr:"T...demo"}];
const FIATS = [{code:"NGN",flag:"\ud83c\uddf3\ud83c\uddec",name:"Nigerian Naira"},{code:"USD",flag:"\ud83c\uddfa\ud83c\uddf8",name:"US Dollar"},{code:"EUR",flag:"\ud83c\uddea\ud83c\uddfa",name:"Euro"},{code:"GBP",flag:"\ud83c\uddec\ud83c\udde7",name:"British Pound"}];
export default function DepositModal({ visible, onClose, symbol }: { visible: boolean; onClose: () => void; symbol?: string }) {
  const [step,setStep]=useState<Step>("choose"); const [net,setNet]=useState(NETS[0]); const [fiat,setFiat]=useState(FIATS[0]); const [copied,setCopied]=useState(false);
  if (!visible) return null;
  const copy = (t:string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const close = () => { setStep("choose"); onClose(); };
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden">
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
      <div className="flex items-center gap-2">{step!=="choose"&&<button onClick={()=>setStep(step==="fiat-bank"?"fiat-currency":"choose")} className="text-gray-400 cursor-pointer"><ArrowLeft size={18}/></button>}<h3 className="font-bold text-lg">{step==="choose"?"Deposit":step==="crypto"?`Deposit ${symbol||"Crypto"}`:step==="fiat-currency"?"Select Currency":step==="fiat-bank"?"Bank Transfer":step==="success"?"Success":"Failed"}</h3></div>
      <button onClick={close} className="text-gray-400 cursor-pointer"><X size={20}/></button>
    </div>
    <div className="p-6">
      {step==="choose"&&<div className="space-y-3">
        <button onClick={()=>setStep("crypto")} className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary text-lg">\u20bf</div><div className="text-left"><p className="font-semibold text-sm">Deposit Crypto</p><p className="text-xs text-gray-400">From external wallet</p></div></button>
        <button onClick={()=>setStep("fiat-currency")} className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer"><div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 text-lg">\ud83d\udcb5</div><div className="text-left"><p className="font-semibold text-sm">Deposit Fiat</p><p className="text-xs text-gray-400">Bank transfer</p></div></button>
      </div>}
      {step==="crypto"&&<div>
        <select value={net.net} onChange={e=>{const n=NETS.find(n=>n.net===e.target.value);if(n)setNet(n);}} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4">{NETS.map(n=><option key={n.net} value={n.net}>{n.name}</option>)}</select>
        <div className="w-40 h-40 mx-auto mb-4 bg-gray-100 rounded-xl flex items-center justify-center"><span className="text-gray-300 text-xs">QR Code</span></div>
        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between mb-4"><span className="text-xs text-gray-600 font-mono truncate mr-2">{net.addr}</span><button onClick={()=>copy(net.addr)} className="text-primary shrink-0 cursor-pointer">{copied?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button></div>
      </div>}
      {step==="fiat-currency"&&<div className="space-y-2">{FIATS.map(c=><button key={c.code} onClick={()=>{setFiat(c);setStep("fiat-bank");}} className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer"><span className="text-2xl">{c.flag}</span><div className="text-left"><p className="font-semibold text-sm">{c.code}</p><p className="text-xs text-gray-400">{c.name}</p></div></button>)}</div>}
      {step==="fiat-bank"&&<div><div className="bg-blue-50 rounded-xl p-4 mb-4"><p className="text-sm font-semibold text-blue-700 mb-1">Transfer {fiat.code} to:</p><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">Kynettic Bank</span></div><div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-medium font-mono">1234567890</span></div><div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">Kynettic Limited</span></div></div></div>
        <button onClick={()=>setStep("success")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">I have made this transfer</button></div>}
      {step==="success"&&<div className="text-center py-4"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-green-500"/></div><h3 className="font-bold text-lg mb-2">Deposit Initiated!</h3><p className="text-sm text-gray-500 mb-6">Processing. You&apos;ll be notified when confirmed.</p><button onClick={close} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Done</button></div>}
      {step==="failed"&&<div className="text-center py-4"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><XCircle size={32} className="text-red-500"/></div><h3 className="font-bold text-lg mb-2">Failed</h3><button onClick={()=>setStep("choose")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Try Again</button></div>}
    </div>
  </div></div>);
}
EOF

cat > src/components/modals/AdShareModal.tsx << 'EOF'
"use client";
import { X, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
export default function AdShareModal({ visible, onClose, adId, adType, asset, price, fiat }: { visible: boolean; onClose: () => void; adId: string; adType: string; asset: string; price: string; fiat: string }) {
  const [copied, setCopied] = useState(false);
  if (!visible) return null;
  const url = `${typeof window!=="undefined"?window.location.origin:""}/p2p/ad/${adId}`;
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg">Share Ad</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
    <div className="bg-gray-50 rounded-xl p-4 mb-6"><p className="text-sm font-bold mb-1"><span className={adType==="Buy"?"text-green-600":"text-red-500"}>{adType}</span> {asset}</p><p className="text-xs text-gray-500">Price: {price} {fiat}/{asset}</p></div>
    <div className="bg-white border border-gray-100 rounded-xl p-6 inline-block mb-4"><QRCodeSVG value={url} size={160} level="M"/></div>
    <p className="text-xs text-gray-400 mb-4">Scan to view ad</p>
    <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between"><span className="text-xs text-gray-600 truncate mr-2">{url}</span><button onClick={copy} className="text-primary shrink-0 cursor-pointer">{copied?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button></div>
  </div></div>);
}
EOF

cat > src/components/modals/P2PDisclaimerModal.tsx << 'EOF'
"use client";
import { X } from "lucide-react";
export default function P2PDisclaimerModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!visible) return null;
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Disclaimer</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
    <p className="text-sm text-gray-500 mb-6">By proceeding, you agree to the P2P Trading terms. Ensure you have sufficient funds and verify all details before confirming.</p>
    <button onClick={onConfirm} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">I Agree, Continue</button>
  </div></div>);
}
EOF

cat > src/components/modals/P2PEnterPinModal.tsx << 'EOF'
"use client";
import { X } from "lucide-react";
import { useState } from "react";
export default function P2PEnterPinModal({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  if (!visible) return null;
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Enter PIN</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
    <p className="text-sm text-gray-500 mb-4">Enter your 4-digit transaction PIN to confirm.</p>
    <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="****" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-6"/>
    <button onClick={()=>{onSubmit(pin);setPin("");}} disabled={pin.length<4} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">Confirm</button>
  </div></div>);
}
EOF

cat > src/components/modals/P2POrderSuccessModal.tsx << 'EOF'
"use client";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
export default function P2POrderSuccessModal({ visible, onClose, order }: { visible: boolean; onClose: () => void; order: { type: string; amount: string; price: string; fee: string; quantity: string; orderNo: string; orderTime: string; advertiser: string } }) {
  const router = useRouter();
  if (!visible) return null;
  return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
    <div className="text-center mb-4"><div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={32} className="text-green-500"/></div><h3 className="font-bold text-lg">Order Completed!</h3></div>
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-6">
      {[["Type",order.type],["Amount",order.amount],["Price",order.price],["Fee",order.fee],["Quantity",order.quantity],["Order No.",order.orderNo],["Advertiser",order.advertiser]].map(([k,v])=>
        <div key={k} className="flex justify-between"><span className="text-gray-400">{k}</span><span className="font-semibold">{v}</span></div>)}
    </div>
    <button onClick={()=>{onClose();router.push("/wallet");}} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Go to Wallet</button>
  </div></div>);
}
EOF

echo "Components + modals done"

#=============================================================================
# LANDING PAGE COMPONENTS (copy from kynettic-landing-page)
#=============================================================================
for f in Hero Partners AboutSection WhatWeDo LiquiditySection HowItWorks WhyDifferent FAQ CTASection Footer Navbar; do
  if [ -f "/Users/home/Desktop/kynettic-landing-page/src/components/${f}.tsx" ]; then
    cp "/Users/home/Desktop/kynettic-landing-page/src/components/${f}.tsx" "src/components/landing/${f}.tsx"
  fi
done
echo "Landing components copied"

#=============================================================================
# ROOT LAYOUT + ROOT PAGE (Landing)
#=============================================================================
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kynettic — Safe P2P Crypto Trading",
  description: "No chats. No screenshots. No scams. Automated P2P crypto settlements.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

cat > src/app/providers.tsx << 'EOF'
"use client";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { AdsProvider } from "@/context/AdsContext";
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><WalletProvider><AdsProvider>{children}</AdsProvider></WalletProvider></AuthProvider>;
}
EOF

cat > src/app/page.tsx << 'EOF'
import Hero from "@/components/landing/Hero";
import Partners from "@/components/landing/Partners";
import AboutSection from "@/components/landing/AboutSection";
import WhatWeDo from "@/components/landing/WhatWeDo";
import LiquiditySection from "@/components/landing/LiquiditySection";
import HowItWorks from "@/components/landing/HowItWorks";
import WhyDifferent from "@/components/landing/WhyDifferent";
import FAQ from "@/components/landing/FAQ";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="landing-scope">
      <Hero /><Partners /><AboutSection /><WhatWeDo /><LiquiditySection /><HowItWorks /><WhyDifferent /><FAQ /><CTASection /><Footer />
    </main>
  );
}
EOF

echo "Root layout + landing done"

#=============================================================================
# AUTH PAGES
#=============================================================================
cat > 'src/app/(auth)/login/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
export default function LoginPage() {
  const router = useRouter(); const { login } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleLogin = async () => { if (!email || !password) { setError("Please fill all fields"); return; } setLoading(true); setError(""); try { await login(email, password); router.replace("/wallet"); } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
        <img src="/assets/iconletter.png" alt="Kynettic" className="h-8 mb-8"/>
        <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <label className="text-sm text-gray-600 block mb-1">Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm"/>
        <label className="text-sm text-gray-600 block mb-1">Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="w-full border border-gray-200 rounded-xl p-3 mb-2 text-sm"/>
        <button onClick={()=>router.push("/forgot-password")} className="text-primary text-xs mb-6 cursor-pointer">Forgot password?</button>
        <button onClick={handleLogin} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50 mb-4">{loading ? "Signing in..." : "Sign In"}</button>
        <p className="text-center text-sm text-gray-500">Don&apos;t have an account? <button onClick={()=>router.push("/signup")} className="text-primary font-semibold cursor-pointer">Sign Up</button></p>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(auth)/signup/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handle = async () => { if (!email) { setError("Enter your email"); return; } setLoading(true); setError(""); try { await authService.registerRequestOtp(email); router.push(`/otp?email=${encodeURIComponent(email)}&flow=signup`); } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
        <img src="/assets/iconletter.png" alt="Kynettic" className="h-8 mb-8"/>
        <h1 className="text-2xl font-bold mb-1">Create Account</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your email to get started</p>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50 mb-4">{loading ? "Sending OTP..." : "Continue"}</button>
        <p className="text-center text-sm text-gray-500">Already have an account? <button onClick={()=>router.push("/login")} className="text-primary font-semibold cursor-pointer">Sign In</button></p>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(auth)/otp/page.tsx' << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
function OTPContent() {
  const router = useRouter(); const p = useSearchParams();
  const email = p.get("email") || ""; const flow = p.get("flow") || "signup";
  const [otp, setOtp] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handle = async () => { setLoading(true); setError(""); try { if (flow==="signup") { const r = await authService.registerVerifyOtp(email, otp); const token = r.data?.registration_token || r.data?.token; router.push(`/signup-step3?token=${token}&email=${encodeURIComponent(email)}`); } else { const r = await authService.forgotPasswordVerifyOtp(email, otp); const token = r.data?.reset_token || r.data?.token; router.push(`/create-new-password?token=${token}`); } } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Enter OTP</h1>
        <p className="text-sm text-gray-500 mb-6">We sent a code to {email}</p>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="text" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,""))} placeholder="Enter OTP" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-6"/>
        <button onClick={handle} disabled={loading||otp.length<4} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading ? "Verifying..." : "Verify"}</button>
      </div>
    </div>
  );
}
export default function OTPPage() { return <Suspense><OTPContent/></Suspense>; }
EOF

cat > 'src/app/(auth)/signup-step3/page.tsx' << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
function Content() {
  const router = useRouter(); const p = useSearchParams();
  const token = p.get("token") || ""; const email = p.get("email") || "";
  const [pw, setPw] = useState(""); const [cpw, setCpw] = useState(""); const [ref, setRef] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handle = async () => { if (pw.length < 8) { setError("Min 8 characters"); return; } if (pw !== cpw) { setError("Passwords don't match"); return; } setLoading(true); setError(""); try { await authService.registerSetPassword(token, pw, ref||undefined); router.push("/account-created"); } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Set Password</h1>
        <p className="text-sm text-gray-500 mb-6">{email}</p>
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" className="w-full border border-gray-200 rounded-xl p-3 mb-3 text-sm"/>
        <input type="password" value={cpw} onChange={e=>setCpw(e.target.value)} placeholder="Confirm Password" className="w-full border border-gray-200 rounded-xl p-3 mb-3 text-sm"/>
        <input type="text" value={ref} onChange={e=>setRef(e.target.value)} placeholder="Referral code (optional)" className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-sm"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading ? "Creating..." : "Create Account"}</button>
      </div>
    </div>
  );
}
export default function SignupStep3Page() { return <Suspense><Content/></Suspense>; }
EOF

for page in forgot-password forgot-password-otp create-new-password password-changed account-created welcome; do
  case $page in
    forgot-password)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
export default function ForgotPasswordPage() {
  const router = useRouter(); const [email,setEmail]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const handle = async () => { setLoading(true); setError(""); try { await authService.forgotPasswordRequestOtp(email); router.push(`/otp?email=${encodeURIComponent(email)}&flow=forgot`); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
    <h1 className="text-2xl font-bold mb-1">Forgot Password</h1><p className="text-sm text-gray-500 mb-6">Enter your email to reset</p>
    {error&&<p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm"/>
    <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Sending...":"Send OTP"}</button>
  </div></div>);
}
EOF
      ;;
    forgot-password-otp)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useRouter } from "next/navigation";
export default function ForgotPasswordOTPPage() { const router = useRouter(); router.replace("/otp?flow=forgot"); return null; }
EOF
      ;;
    create-new-password)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/errorHandler";
function Content() {
  const router = useRouter(); const p = useSearchParams(); const token = p.get("token")||"";
  const [pw,setPw]=useState(""); const [cpw,setCpw]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const handle = async () => { if(pw!==cpw){setError("Passwords don't match");return;} setLoading(true); try { await authService.forgotPasswordReset(token,pw); router.push("/password-changed"); } catch(e){setError(getErrorMessage(e));} finally{setLoading(false);} };
  return (<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm">
    <h1 className="text-2xl font-bold mb-6">Create New Password</h1>
    {error&&<p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
    <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New Password" className="w-full border border-gray-200 rounded-xl p-3 mb-3 text-sm"/>
    <input type="password" value={cpw} onChange={e=>setCpw(e.target.value)} placeholder="Confirm" className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-sm"/>
    <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Resetting...":"Reset Password"}</button>
  </div></div>);
}
export default function CreateNewPasswordPage() { return <Suspense><Content/></Suspense>; }
EOF
      ;;
    password-changed)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function PasswordChangedPage() {
  const router = useRouter();
  return (<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm text-center">
    <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
    <h1 className="text-2xl font-bold mb-2">Password Changed!</h1><p className="text-sm text-gray-500 mb-6">You can now sign in with your new password.</p>
    <button onClick={()=>router.push("/login")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Sign In</button>
  </div></div>);
}
EOF
      ;;
    account-created)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function AccountCreatedPage() {
  const router = useRouter();
  return (<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm text-center">
    <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
    <h1 className="text-2xl font-bold mb-2">Account Created!</h1><p className="text-sm text-gray-500 mb-6">Welcome to Kynettic. Sign in to get started.</p>
    <button onClick={()=>router.push("/login")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Sign In</button>
  </div></div>);
}
EOF
      ;;
    welcome)
      cat > "src/app/(auth)/${page}/page.tsx" << 'EOF'
"use client";
import { useRouter } from "next/navigation";
export default function WelcomePage() {
  const router = useRouter();
  return (<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"><div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-sm text-center">
    <img src="/assets/iconletter.png" alt="Kynettic" className="h-10 mx-auto mb-6"/>
    <h1 className="text-2xl font-bold mb-2">Welcome to Kynettic</h1><p className="text-sm text-gray-500 mb-8">The future of safe P2P crypto trading</p>
    <button onClick={()=>router.push("/login")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer mb-3">Sign In</button>
    <button onClick={()=>router.push("/signup")} className="w-full border border-gray-200 py-3 rounded-xl font-semibold cursor-pointer">Create Account</button>
  </div></div>);
}
EOF
      ;;
  esac
done

echo "Auth pages done"
echo "=== gen2.sh complete ==="
