#!/bin/bash
APP="/Users/home/Desktop/kynettic-web/src/app/(app)"

# Helper to create a simple page
mkpage() {
  local dir="$1" title="$2" content="$3"
  cat > "$APP/$dir/page.tsx" << PAGEEOF
"use client";
${content}
PAGEEOF
}

# WALLET
cat > "$APP/wallet/page.tsx" << 'EOF'
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import Link from "next/link";
import { Eye, EyeOff, ArrowDownToLine, Send, RefreshCw } from "lucide-react";

export default function WalletPage() {
  const { user } = useAuth();
  const { wallets, loading, fetchWallets } = useWallet();
  const [viewMode, setViewMode] = useState<"Crypto" | "Fiat">("Crypto");
  const [hidden, setHidden] = useState(false);
  const isFiat = (c: string) => ["NGN","USD","EUR","GBP"].includes(c);
  const filtered = wallets.filter((w: any) => viewMode === "Fiat" ? isFiat(w.currency) : !isFiat(w.currency));
  const display = (v: string) => hidden ? "****" : v;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#4472B7] flex items-center justify-center text-white font-bold">{(user as any)?.first_name?.charAt(0) || "U"}</div>
        <div className="flex bg-gray-100 rounded-full p-1">
          {(["Crypto","Fiat"] as const).map(t => (
            <button key={t} onClick={() => setViewMode(t)} className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-colors ${viewMode === t ? "bg-white text-[#4472B7] shadow-sm" : "text-gray-500"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="bg-[#4472B7] rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center justify-center gap-2 mb-2 text-sm opacity-90">Total Assets <button onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div>
        <p className="text-4xl font-bold text-center mb-1">{display("---")}</p>
        <p className="text-center text-sm opacity-80">~ {display("0.00 BTC")}</p>
        <div className="flex gap-4 mt-6 justify-center">
          <Link href="/deposit-search" className="bg-white text-[#4472B7] px-6 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2"><ArrowDownToLine size={16}/> Deposit</Link>
          <Link href="/withdraw-fiat" className="border border-white/60 px-6 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2"><Send size={16}/> Withdraw</Link>
        </div>
      </div>

      <Link href="/p2p" className="block bg-gradient-to-r from-[#3B5998] to-[#4472B7] rounded-2xl p-5 text-white mb-8">
        <p className="font-bold">Click Here To Buy Bulk Coins</p>
        <p className="text-sm opacity-80">Purchase large coin amounts directly from us.</p>
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-[#1D3B53]">{viewMode} Holdings</h3>
        <button onClick={() => fetchWallets()} className="text-[#4472B7] text-sm flex items-center gap-1"><RefreshCw size={14}/> Refresh</button>
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">Loading...</p> : filtered.length === 0 ? <p className="text-gray-400 text-center py-8">No {viewMode.toLowerCase()} holdings yet.</p> : (
        <div className="space-y-3">
          {filtered.map((w: any) => (
            <div key={w.id} className="bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4472B7]/10 flex items-center justify-center text-[#4472B7] font-bold text-sm">{w.currency?.slice(0,2)}</div>
                <div><p className="font-semibold text-[#1D3B53]">{w.currency}</p></div>
              </div>
              <div className="text-right"><p className="font-semibold">{display(w.balance?.toString() || "0")}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

# P2P
cat > "$APP/p2p/page.tsx" << 'EOF'
"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { p2pService } from "@/services/p2p.service";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

function P2PContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tradeType, setTradeType] = useState<"Buy" | "Sell">(tabParam === "sell" ? "Sell" : "Buy");
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("USDT");
  const [currencyId, setCurrencyId] = useState<number | null>(null);

  useEffect(() => { p2pService.getCurrencies().then(r => { if(r?.data) { setCurrencies(r.data); const u = r.data.find((c:any)=>c.code==="USDT"); if(u) setCurrencyId(u.id); } }).catch(()=>{}); }, []);
  useEffect(() => { const c = currencies.find((c:any)=>c.code===selectedAsset); if(c) setCurrencyId(c.id); }, [selectedAsset, currencies]);

  const fetchAds = useCallback(async () => {
    if(!currencyId) return;
    setLoading(true);
    try { const r = await p2pService.getMarketplaceAds(tradeType==="Buy"?"sell":"buy", currencyId); setAds(r?.data || []); } catch { setAds([]); }
    finally { setLoading(false); }
  }, [tradeType, currencyId]);

  useEffect(() => { if(currencyId) fetchAds(); }, [fetchAds, currencyId]);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#1D3B53]">P2P Trading</h1>
        <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5"><span className="text-sm font-semibold">NGN</span><ChevronDown size={14}/></div>
      </div>
      <Link href="/bulk-coins-purchase" className="block bg-gradient-to-r from-[#3B5998] to-[#4472B7] rounded-2xl p-5 text-white mb-6">
        <p className="font-bold">Click Here To Buy Bulk Coins</p><p className="text-sm opacity-80">Purchase large coin amounts directly from us.</p>
      </Link>
      <div className="flex bg-gray-100 rounded-full p-1 w-fit mb-6">
        {(["Buy","Sell"] as const).map(t=>(
          <button key={t} onClick={()=>setTradeType(t)} className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${tradeType===t?"bg-white text-[#1D3B53] shadow-sm":"text-gray-500"}`}>{t}</button>
        ))}
      </div>
      <div className="flex items-center gap-4 mb-6">
        <button className="flex items-center gap-1 text-sm font-medium"><span className="w-5 h-5 rounded-full bg-[#4472B7]/10 flex items-center justify-center text-xs font-bold text-[#4472B7]">U</span>{selectedAsset}<ChevronDown size={14}/></button>
        <button className="flex items-center gap-1 text-sm font-medium">Amount <ChevronDown size={14}/></button>
        <div className="flex-1"/>
        <button className="p-2"><SlidersHorizontal size={20} className="text-[#1D3B53]"/></button>
      </div>
      {loading ? <p className="text-center text-gray-400 py-12">Loading ads...</p> : ads.length===0 ? <p className="text-center text-gray-400 py-12">No ads available.</p> : (
        <div className="space-y-4">
          {ads.map((ad:any) => {
            const name = ad.advertiser?.username || "Trader";
            return (
              <div key={ad.id} className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-2"><div className="w-4 h-4 rounded-full bg-[#4472B7]"/><div><p className="text-sm font-semibold text-[#1D3B53]">{name}</p><p className="text-xs text-[#4472B7]">{ad.completed_orders||0} order(s)</p></div></div>
                <p className="text-2xl font-bold text-[#1D3B53] mb-2">₦{parseFloat(ad.price).toLocaleString("en-US",{minimumFractionDigits:2})}</p>
                <div className="flex items-end justify-between">
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Limits: <span className="text-[#1D3B53] font-medium">{parseFloat(ad.min_amount).toLocaleString()} - {parseFloat(ad.max_amount).toLocaleString()} NGN</span></p>
                    <p>Quantity: <span className="text-[#1D3B53] font-medium">{parseFloat(ad.total_quantity||ad.amount||"0").toLocaleString()} {selectedAsset}</span></p>
                    <p>Fee: <span className="text-[#1D3B53] font-medium">0 NGN</span></p>
                  </div>
                  <Link href={tradeType==="Buy"?`/buy-crypto?ad=${ad.id}`:`/sell-crypto?ad=${ad.id}`} className={`px-6 py-2.5 rounded-xl font-bold text-white text-sm ${tradeType==="Buy"?"bg-green-500":"bg-red-500"}`}>{tradeType}</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function P2PPage() { return <Suspense fallback={<div className="p-6"><p className="text-gray-400">Loading...</p></div>}><P2PContent/></Suspense>; }
EOF

# BUY CRYPTO
cat > "$APP/buy-crypto/page.tsx" << 'EOF'
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertCircle } from "lucide-react";
import P2PDisclaimerModal from "@/components/modals/P2PDisclaimerModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import P2POrderSuccessModal from "@/components/modals/P2POrderSuccessModal";

function BuyCryptoContent() {
  const router = useRouter();
  const [paymentTab, setPaymentTab] = useState<"Fiat"|"Crypto">("Fiat");
  const [amount, setAmount] = useState("6000");
  const [errorType, setErrorType] = useState<string|null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const PRICE = 1486;
  const isFiat = paymentTab === "Fiat";
  const val = parseFloat(amount) || 0;
  const calc = isFiat ? (val/PRICE).toFixed(4) : (val*PRICE).toFixed(2);

  const handleBuy = () => { setErrorType(null); const ngn = isFiat ? val : val*PRICE; if(ngn<5000||ngn>8000){setErrorType("LIMIT");return;} setDisclaimerOpen(true); };
  const handleConfirm = () => { setDisclaimerOpen(false); setPinOpen(true); };
  const handlePin = () => { setPinOpen(false); setSuccessOpen(true); };

  return (
    <div className="p-6 max-w-2xl">
      {errorType==="LIMIT" && <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 mb-4"><AlertCircle size={18}/>Ad Limit Exceeded!</div>}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><button onClick={()=>router.back()}><ArrowLeft size={24}/></button><h1 className="text-lg font-bold text-[#1D3B53]">Buy USDT</h1></div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-full px-3 py-1 text-xs"><ShieldCheck size={14} className="text-green-500"/>Security Protection</div>
      </div>
      <p className="text-sm font-semibold mb-4">Price: <span className="text-green-500">{PRICE.toFixed(2)} NGN</span></p>
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(["Fiat","Crypto"] as const).map(t=>(<button key={t} onClick={()=>{setPaymentTab(t);setAmount("");}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${paymentTab===t?"bg-white shadow-sm text-[#4472B7]":"text-gray-500"}`}>With {t}</button>))}
      </div>
      <div className="bg-blue-50 border border-[#4472B7] rounded-2xl p-5 mb-4">
        <p className="text-sm mb-2">Amount</p>
        <div className="flex items-center justify-between mb-3"><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="text-3xl font-bold bg-transparent outline-none flex-1 w-0" placeholder="0.00"/><span className="text-gray-500 text-sm">{isFiat?"NGN":"USDT"} | <span className="text-[#4472B7] font-semibold">Max</span></span></div>
        <hr className="border-gray-200 mb-3"/>
        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Limits: <span className="text-[#1D3B53] font-medium">5,000 - 8,000 NGN</span></span><span>Fee: <span className="text-[#4472B7]">0 NGN</span></span></div>
        <p className="text-sm font-semibold text-[#1D3B53]">{isFiat ? `I will Receive: ${calc} USDT` : `I will Pay: ${calc} NGN`}</p>
      </div>
      <div className="bg-blue-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between mb-6"><span className="text-xs text-gray-500">Available Balance: <span className="text-[#4472B7] font-semibold">15,000</span> NGN</span><button className="text-xs text-[#1D3B53] font-medium">+ Add funds</button></div>
      <div className="bg-yellow-50 rounded-xl p-4 mb-6 text-xs text-yellow-800 leading-relaxed"><strong>Advertiser Terms:</strong> Quick and secure wallet trades. Happy trading!</div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <div><p className="text-2xl font-bold">{amount||"0"} <span className="text-sm text-gray-500">{isFiat?"NGN":"USDT"}</span></p><p className="text-xs text-gray-500">Total Payable</p></div>
        <button onClick={handleBuy} className="bg-[#4472B7] text-white px-10 py-3 rounded-2xl font-bold">Buy</button>
      </div>
      <P2PDisclaimerModal open={disclaimerOpen} onClose={()=>setDisclaimerOpen(false)} onConfirm={handleConfirm}/>
      <P2PEnterPinModal open={pinOpen} onClose={()=>setPinOpen(false)} onConfirm={handlePin}/>
      <P2POrderSuccessModal open={successOpen} onClose={()=>{setSuccessOpen(false);router.push("/wallet");}}/>
    </div>
  );
}
export default function BuyCryptoPage() { return <Suspense fallback={<div className="p-6">Loading...</div>}><BuyCryptoContent/></Suspense>; }
EOF

# SELL CRYPTO
cat > "$APP/sell-crypto/page.tsx" << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertCircle } from "lucide-react";
import P2PDisclaimerModal from "@/components/modals/P2PDisclaimerModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import P2POrderSuccessModal from "@/components/modals/P2POrderSuccessModal";

function SellCryptoContent() {
  const router = useRouter();
  const [paymentTab, setPaymentTab] = useState<"Fiat"|"Crypto">("Crypto");
  const [amount, setAmount] = useState("");
  const [errorType, setErrorType] = useState<string|null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const PRICE = 1486;
  const isFiat = paymentTab === "Fiat";
  const val = parseFloat(amount) || 0;
  const calc = isFiat ? (val/PRICE).toFixed(4) : (val*PRICE).toFixed(2);

  const handleSell = () => { setErrorType(null); const ngn = isFiat ? val : val*PRICE; if(ngn<5000||ngn>8000){setErrorType("LIMIT");return;} setDisclaimerOpen(true); };
  const handleConfirm = () => { setDisclaimerOpen(false); setPinOpen(true); };
  const handlePin = () => { setPinOpen(false); setSuccessOpen(true); };

  return (
    <div className="p-6 max-w-2xl">
      {errorType==="LIMIT" && <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 mb-4"><AlertCircle size={18}/>Ad Limit Exceeded!</div>}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><button onClick={()=>router.back()}><ArrowLeft size={24}/></button><h1 className="text-lg font-bold text-[#1D3B53]">Sell USDT</h1></div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-full px-3 py-1 text-xs"><ShieldCheck size={14} className="text-green-500"/>Security Protection</div>
      </div>
      <p className="text-sm font-semibold mb-4">Price: <span className="text-red-500">{PRICE.toFixed(2)} NGN</span></p>
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(["Fiat","Crypto"] as const).map(t=>(<button key={t} onClick={()=>{setPaymentTab(t);setAmount("");}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${paymentTab===t?"bg-white shadow-sm text-[#4472B7]":"text-gray-500"}`}>With {t}</button>))}
      </div>
      <div className="bg-blue-50 border border-[#4472B7] rounded-2xl p-5 mb-4">
        <p className="text-sm mb-2">Amount</p>
        <div className="flex items-center justify-between mb-3"><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="text-3xl font-bold bg-transparent outline-none flex-1 w-0" placeholder="0.00"/><span className="text-gray-500 text-sm">{isFiat?"NGN":"USDT"} | <span className="text-[#4472B7] font-semibold">Max</span></span></div>
        <hr className="border-gray-200 mb-3"/>
        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Limits: 5,000 - 8,000 NGN</span><span>Fee: <span className="text-[#4472B7]">0 NGN</span></span></div>
        <p className="text-sm font-semibold text-[#1D3B53]">{isFiat ? `I will Receive: ${calc} USDT` : `I will Receive: ${calc} NGN`}</p>
      </div>
      <div className="bg-yellow-50 rounded-xl p-4 mb-6 text-xs text-yellow-800 leading-relaxed"><strong>Advertiser Terms:</strong> Quick and secure wallet trades. Happy trading!</div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <div><p className="text-2xl font-bold">{amount||"0"} <span className="text-sm text-gray-500">{isFiat?"NGN":"USDT"}</span></p><p className="text-xs text-gray-500">Total Quantity</p></div>
        <button onClick={handleSell} className="bg-red-500 text-white px-10 py-3 rounded-2xl font-bold">Sell</button>
      </div>
      <P2PDisclaimerModal open={disclaimerOpen} onClose={()=>setDisclaimerOpen(false)} onConfirm={handleConfirm}/>
      <P2PEnterPinModal open={pinOpen} onClose={()=>setPinOpen(false)} onConfirm={handlePin}/>
      <P2POrderSuccessModal open={successOpen} onClose={()=>{setSuccessOpen(false);router.push("/wallet");}}/>
    </div>
  );
}
export default function SellCryptoPage() { return <Suspense fallback={<div className="p-6">Loading...</div>}><SellCryptoContent/></Suspense>; }
EOF

echo "Core pages done"
