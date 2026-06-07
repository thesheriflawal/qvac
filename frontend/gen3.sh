#!/bin/bash
cd /Users/home/Desktop/kynettic-web

#=============================================================================
# (app)/layout.tsx — 3-column desktop layout with auth guard
#=============================================================================
cat > 'src/app/(app)/layout.tsx' << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import LoadingScreen from "@/components/LoadingScreen";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) { router.replace("/login"); }
      else { setReady(true); }
    }
  }, [user, loading, router]);

  if (loading || !ready) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      <Sidebar />
      <main className="flex-1 ml-[230px] p-6 max-w-[1200px]">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">{children}</div>
          <RightSidebar />
        </div>
      </main>
    </div>
  );
}
EOF

echo "App layout done"

#=============================================================================
# WALLET PAGE
#=============================================================================
cat > 'src/app/(app)/wallet/page.tsx' << 'EOF'
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Search, Bell } from "lucide-react";
import DepositModal from "@/components/modals/DepositModal";

const FIAT = ["NGN", "USD", "EUR", "GBP"];
const isFiat = (c: string) => FIAT.includes(c);

export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallets, loading, fetchWallets } = useWallet();
  const [viewMode, setViewMode] = useState<"Crypto" | "Fiat">("Crypto");
  const [hidden, setHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);

  useEffect(() => { fetchWallets(); }, []);

  const displayName = (user as Record<string,string>)?.first_name || (user as Record<string,string>)?.username || "User";
  const filtered = wallets.filter((w: Record<string,string>) => viewMode === "Fiat" ? isFiat(w.currency) : !isFiat(w.currency)).filter((w: Record<string,string>) => w.currency.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Welcome, {displayName}</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/notifications")} className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer"><Bell size={16} className="text-gray-500"/></button>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(["Crypto","Fiat"] as const).map(t => (
          <button key={t} onClick={() => setViewMode(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${viewMode === t ? "bg-white shadow-sm text-primary" : "text-gray-500"}`}>{t}</button>
        ))}
      </div>

      {/* Balance Card */}
      <div className="bg-primary rounded-2xl p-6 text-white mb-6 bg-[url('/assets/waves.png')] bg-cover bg-center">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm opacity-80">Total Assets</span>
          <button onClick={() => setHidden(!hidden)} className="cursor-pointer opacity-80">{hidden ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
        </div>
        <p className="text-3xl font-bold mb-1 cursor-pointer" onClick={() => router.push("/balance")}>{hidden ? "****" : "---"}</p>
        <p className="text-sm opacity-70">≈ $0.00</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setDepositOpen(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"><ArrowDownLeft size={16}/>Deposit</button>
          <button onClick={() => router.push(viewMode === "Fiat" ? "/withdraw-fiat" : "/withdraw-search")} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"><ArrowUpRight size={16}/>Withdraw</button>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Holdings</h2>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" className="pl-8 pr-3 py-2 bg-gray-50 rounded-lg text-sm w-48"/></div>
        </div>
        {loading ? <p className="text-gray-400 text-center py-10">Loading...</p> : filtered.length === 0 ? <p className="text-gray-400 text-center py-10">No assets found</p> : (
          <div className="divide-y divide-gray-50">
            {filtered.map((w: Record<string,string>, i: number) => (
              <button key={i} onClick={() => router.push(`/asset-detail?symbol=${w.currency}&balance=${w.balance}`)} className="flex items-center justify-between py-3.5 w-full hover:bg-gray-50 rounded-lg px-2 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">{w.currency?.charAt(0)}</div>
                  <div className="text-left"><p className="text-sm font-semibold">{w.currency}</p><p className="text-xs text-gray-400">---</p></div>
                </div>
                <div className="text-right"><p className="text-sm font-semibold">{hidden ? "****" : parseFloat(w.balance || "0").toFixed(4)}</p><p className="text-xs text-gray-400">≈ $---</p></div>
              </button>
            ))}
          </div>
        )}
      </div>

      <DepositModal visible={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
EOF

#=============================================================================
# HISTORY PAGE
#=============================================================================
cat > 'src/app/(app)/history/page.tsx' << 'EOF'
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import TransactionItem from "@/components/TransactionItem";
import FilterModal from "@/components/FilterModal";
import { SlidersHorizontal } from "lucide-react";

const FIAT = ["NGN","USD","EUR","GBP"];

export default function HistoryPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"Crypto"|"Fiat">("Crypto");
  const [filterOpen, setFilterOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const wRes = await walletService.getWallets();
      const wallets = wRes.data || [];
      const map = new Map<string,string>();
      wallets.forEach((w: any) => map.set(w.id, w.currency));
      const txRes = await walletService.getTransactions();
      const txs = (txRes.data || []).map((tx: any) => {
        const currency = map.get(tx.wallet_id) || "Unknown";
        return { ...tx, currency, isFiat: FIAT.includes(currency), uiType: tx.type === "deposit" ? "Received" : tx.type === "withdrawal" ? "Sent" : tx.type, uiStatus: tx.status };
      });
      setTransactions(txs);
    } catch {} finally { setLoading(false); }
  };

  const filtered = transactions.filter(t => viewMode === "Fiat" ? t.isFiat : !t.isFiat);
  const today = new Date().toISOString().split("T")[0];
  const todayTxs = filtered.filter(t => t.created_at?.startsWith(today));
  const olderTxs = filtered.filter(t => !t.created_at?.startsWith(today));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Transaction History</h1>
        <button onClick={() => setFilterOpen(true)} className="text-primary cursor-pointer"><SlidersHorizontal size={20}/></button>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["Crypto","Fiat"] as const).map(t => (
            <button key={t} onClick={() => setViewMode(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer ${viewMode===t?"bg-white shadow-sm text-primary":"text-gray-500"}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5">
        {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : filtered.length === 0 ? <p className="text-center text-gray-400 py-10">No transactions</p> : (
          <>
            {todayTxs.length > 0 && <><p className="text-xs font-semibold text-gray-400 mb-2">Today</p>{todayTxs.map((t: any, i: number)=><div key={i} onClick={()=>router.push(`/transaction-details?id=${t.id}`)} className="cursor-pointer hover:bg-gray-50 rounded-lg"><TransactionItem type={t.uiType} asset={t.currency} amount={t.isFiat?`${t.amount} ${t.currency}`:`$${t.amount}`} date={new Date(t.created_at).toLocaleDateString()} status={t.uiStatus}/></div>)}</>}
            {olderTxs.length > 0 && <><p className="text-xs font-semibold text-gray-400 mb-2 mt-4">Older</p>{olderTxs.map((t: any, i: number)=><div key={i} onClick={()=>router.push(`/transaction-details?id=${t.id}`)} className="cursor-pointer hover:bg-gray-50 rounded-lg"><TransactionItem type={t.uiType} asset={t.currency} amount={t.isFiat?`${t.amount} ${t.currency}`:`$${t.amount}`} date={new Date(t.created_at).toLocaleDateString()} status={t.uiStatus}/></div>)}</>}
          </>
        )}
      </div>
      <FilterModal visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={() => {}} />
    </div>
  );
}
EOF

#=============================================================================
# P2P PAGE
#=============================================================================
cat > 'src/app/(app)/p2p/page.tsx' << 'EOF'
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { SlidersHorizontal } from "lucide-react";

export default function P2PPage() {
  const router = useRouter();
  const [tradeType, setTradeType] = useState<"Buy"|"Sell">("Buy");
  const [selectedAsset, setSelectedAsset] = useState("USDT");
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCurrencies(); }, []);

  const fetchCurrencies = async () => {
    try {
      const res = await p2pService.getCurrencies();
      if (res?.data) setCurrencies(res.data);
    } catch {}
  };

  const fetchAds = useCallback(async () => {
    const curr = currencies.find((c: any) => c.code === selectedAsset);
    if (!curr) return;
    setLoading(true);
    try {
      const apiType = tradeType === "Buy" ? "sell" : "buy";
      const res = await p2pService.getMarketplaceAds(apiType, curr.id);
      setAds(res?.data || []);
    } catch { setAds([]); }
    finally { setLoading(false); }
  }, [tradeType, selectedAsset, currencies]);

  useEffect(() => { if (currencies.length > 0) fetchAds(); }, [fetchAds, currencies]);

  const assetOptions = currencies.length > 0 ? currencies.map((c: any) => c.code) : ["USDT","BTC","ETH"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">P2P Trading</h1>
      </div>
      {/* Trade Type Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
        {(["Buy","Sell"] as const).map(t => (
          <button key={t} onClick={() => setTradeType(t)} className={`px-6 py-2 rounded-lg text-sm font-semibold cursor-pointer ${tradeType===t?"bg-white shadow-sm":"text-gray-500"} ${tradeType===t&&t==="Buy"?"text-green-600":""} ${tradeType===t&&t==="Sell"?"text-red-500":""}`}>{t}</button>
        ))}
      </div>
      {/* Asset Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {assetOptions.map((a: string) => (
          <button key={a} onClick={() => setSelectedAsset(a)} className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer whitespace-nowrap ${selectedAsset===a?"bg-primary text-white":"bg-gray-100 text-gray-600"}`}>{a}</button>
        ))}
      </div>
      {/* Ads */}
      <div className="space-y-4">
        {loading ? <p className="text-center text-gray-400 py-10">Loading ads...</p> : ads.length === 0 ? <p className="text-center text-gray-400 py-10">No ads available</p> :
          ads.map((ad: any, i: number) => {
            const name = ad.advertiser?.username || "Trader";
            const price = parseFloat(ad.price).toLocaleString("en-US", { minimumFractionDigits: 2 });
            const limits = `${parseFloat(ad.min_amount).toLocaleString()} - ${parseFloat(ad.max_amount).toLocaleString()} NGN`;
            const qty = `${parseFloat(ad.total_quantity || ad.amount).toLocaleString()} ${selectedAsset}`;
            return (
              <div key={i} className="bg-white rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{name.charAt(0)}</div>
                  <div><p className="text-sm font-semibold">{name}</p><p className="text-xs text-gray-400">{ad.completed_orders || 0} orders</p></div>
                </div>
                <p className="text-lg font-bold mb-3">₦{price}</p>
                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-gray-400">Limits</span><span>{limits}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span>{qty}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Fee</span><span>0 NGN</span></div>
                </div>
                <button onClick={() => router.push(`/${tradeType.toLowerCase()}-crypto?ad=${encodeURIComponent(JSON.stringify({...ad, advertiser: name}))}`)} className={`w-full py-2.5 rounded-xl text-white font-semibold cursor-pointer ${tradeType==="Buy"?"bg-green-500 hover:bg-green-600":"bg-red-500 hover:bg-red-600"}`}>{tradeType}</button>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
EOF

#=============================================================================
# ORDERS PAGE
#=============================================================================
cat > 'src/app/(app)/orders/page.tsx' << 'EOF'
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { SlidersHorizontal, FolderOpen, Copy } from "lucide-react";

export default function OrdersPage() {
  const router = useRouter();
  const [topTab, setTopTab] = useState<"Completed"|"Failed">("Completed");
  const [filterType, setFilterType] = useState<"All"|"Buy"|"Sell">("All");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await p2pService.getOrders({ page_size: 100 });
      const mapped = (res.data || []).map((o: any) => ({
        id: o.id.toString(), type: o.side === "buy" ? "Buy" : "Sell", asset: o.currency,
        amount: `${o.total?.toLocaleString()} NGN`, price: `${o.price?.toLocaleString()} NGN`,
        quantity: `${o.amount} ${o.currency}`, orderNo: o.order_number,
        date: new Date(o.created_at).toLocaleString(), status: o.status, raw: o,
      }));
      setOrders(mapped);
    } catch {} finally { setLoading(false); }
  };

  const filtered = orders.filter(o => {
    const matchStatus = topTab === "Completed" ? o.status === "completed" : ["cancelled","disputed","failed"].includes(o.status);
    const matchType = filterType === "All" || o.type === filterType;
    return matchStatus && matchType;
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Orders</h1>
      {/* Top tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
        {(["Completed","Failed"] as const).map(t => (
          <button key={t} onClick={() => setTopTab(t)} className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer ${topTab===t?"bg-white shadow-sm text-primary":"text-gray-500"}`}>{t}</button>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        {(["All","Buy","Sell"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer ${filterType===t?"bg-primary text-white":"bg-gray-100 text-gray-600"}`}>{t}</button>
        ))}
      </div>
      {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : filtered.length === 0 ? (
        <div className="text-center py-16"><FolderOpen size={64} className="text-primary mx-auto mb-4"/><p className="text-gray-400">No Records Found!</p></div>
      ) : (
        <div className="space-y-4">
          {filtered.map((o: any) => (
            <button key={o.id} onClick={() => router.push(`/order-details?order=${encodeURIComponent(JSON.stringify(o))}`)} className="w-full bg-white rounded-2xl p-5 text-left hover:shadow-sm cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold"><span className={o.type==="Buy"?"text-green-600":"text-red-500"}>{o.type}</span> {o.asset}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.status==="completed"?"bg-green-100 text-green-600":"bg-red-100 text-red-500"}`}>{o.status.charAt(0).toUpperCase()+o.status.slice(1)}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                {[["Amount",o.amount],["Price",o.price],["Quantity",o.quantity],["Order No.",o.orderNo],["Order Time",o.date]].map(([k,v])=>
                  <div key={k} className="flex justify-between"><span className="text-gray-400">{k}</span><span className="font-medium">{v}</span></div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

#=============================================================================
# MY ADS PAGE
#=============================================================================
cat > 'src/app/(app)/my-ads/page.tsx' << 'EOF'
"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAds } from "@/context/AdsContext";
import { Plus, Share2, Edit, Trash2 } from "lucide-react";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

export default function MyAdsPage() {
  const router = useRouter();
  const { ads, toggleAdStatus, deleteAd, loading, refreshAds } = useAds();
  const [filter, setFilter] = useState<"All"|"Active"|"Inactive">("All");
  const [deleteModal, setDeleteModal] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);

  const allActive = ads.length > 0 && ads.every((a: any) => a.active);

  const handleGlobalToggle = async () => {
    const val = !allActive;
    for (const ad of ads) { if (ad.active !== val) await toggleAdStatus(ad.id, ad.active); }
  };

  const filtered = ads.filter((a: any) => filter === "All" ? true : filter === "Active" ? a.active : !a.active);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">My Ads</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <span className="text-gray-500">All ads</span>
            <button onClick={handleGlobalToggle} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${allActive?"bg-primary":"bg-gray-300"}`}>
              <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${allActive?"translate-x-4":"translate-x-0"}`}/>
            </button>
          </label>
          <button onClick={() => router.push("/post-ad")} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer hover:bg-primary/90"><Plus size={16}/>Post Ad</button>
        </div>
      </div>
      <div className="flex gap-2 mb-6">
        {(["All","Active","Inactive"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer ${filter===t?"bg-primary text-white":"bg-gray-100 text-gray-600"}`}>{t}</button>
        ))}
      </div>
      {loading ? <p className="text-center text-gray-400 py-10">Loading...</p> : filtered.length === 0 ? <p className="text-center text-gray-400 py-10">No ads found</p> : (
        <div className="space-y-4">
          {filtered.map((ad: any) => (
            <div key={ad.id} className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold"><span className={ad.type==="Buy"?"text-green-600":"text-red-500"}>{ad.type}</span> {ad.asset}</p>
                <button onClick={() => toggleAdStatus(ad.id, ad.active)} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${ad.active?"bg-primary":"bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${ad.active?"translate-x-4":"translate-x-0"}`}/>
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">{new Date(ad.createdAt).toLocaleString()}</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between"><span className="text-gray-400">Price</span><span>{ad.price} {ad.fiat}/{ad.asset}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span>{ad.totalQuantity} {ad.asset}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Limits</span><span>{ad.minLimit} - {ad.maxLimit} {ad.fiat}</span></div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ad.active?"bg-green-100 text-green-600":"bg-red-100 text-red-500"}`}>{ad.active?"Active":"Inactive"}</span>
                <div className="flex gap-3">
                  <button onClick={() => router.push(`/ad-share?ad=${encodeURIComponent(JSON.stringify(ad))}`)} className="flex items-center gap-1 text-gray-400 text-sm cursor-pointer hover:text-gray-600"><Share2 size={14}/>Share</button>
                  <button onClick={() => router.push(`/post-ad?ad=${encodeURIComponent(JSON.stringify(ad))}`)} className="flex items-center gap-1 text-gray-400 text-sm cursor-pointer hover:text-gray-600"><Edit size={14}/>Edit</button>
                  <button onClick={() => { setAdToDelete(ad.id); setDeleteModal(true); }} className="flex items-center gap-1 text-red-400 text-sm cursor-pointer hover:text-red-600"><Trash2 size={14}/>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmationModal visible={deleteModal} onClose={() => setDeleteModal(false)} onConfirm={() => { if (adToDelete) deleteAd(adToDelete); setDeleteModal(false); }} title="Delete Ad" message="Are you sure you want to delete this ad?" confirmText="Delete" variant="danger"/>
    </div>
  );
}
EOF

echo "Main 5 tab pages done"

#=============================================================================
# POST AD PAGE
#=============================================================================
cat > 'src/app/(app)/post-ad/page.tsx' << 'EOF'
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAds } from "@/context/AdsContext";
import { p2pService } from "@/services/p2p.service";
import { getErrorMessage } from "@/utils/errorHandler";
import StatusModal from "@/components/modals/StatusModal";

function Content() {
  const router = useRouter(); const params = useSearchParams();
  const editData = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : null;
  const { refreshAds } = useAds();

  const [type, setType] = useState<"Buy"|"Sell">(editData?.type || "Buy");
  const [asset, setAsset] = useState(editData?.asset || "USDT");
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [price, setPrice] = useState(editData?.price?.toString() || "");
  const [qty, setQty] = useState(editData?.totalQuantity?.toString() || "");
  const [minLimit, setMinLimit] = useState(editData?.minLimit?.toString() || "");
  const [maxLimit, setMaxLimit] = useState(editData?.maxLimit?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{visible:boolean;type:"success"|"error";title:string;message:string}>({visible:false,type:"success",title:"",message:""});

  useEffect(() => { p2pService.getCurrencies().then(r => { if(r?.data) setCurrencies(r.data); }).catch(()=>{}); }, []);

  const handle = async () => {
    if (!price || !qty || !minLimit || !maxLimit) { setStatusModal({visible:true,type:"error",title:"Error",message:"Fill all fields"}); return; }
    setLoading(true);
    try {
      const curr = currencies.find((c:any) => c.code === asset);
      if (editData?.id) { await p2pService.updateAd(editData.id, { price: parseFloat(price), total_quantity: parseFloat(qty), min_amount: parseFloat(minLimit), max_amount: parseFloat(maxLimit) }); }
      else { await p2pService.createAd({ type: type.toLowerCase(), currency_id: curr?.id, price: parseFloat(price), total_quantity: parseFloat(qty), min_amount: parseFloat(minLimit), max_amount: parseFloat(maxLimit) }); }
      await refreshAds();
      setStatusModal({visible:true,type:"success",title:editData?"Ad Updated":"Ad Posted",message:editData?"Your ad has been updated.":"Your ad is now live."});
    } catch (e) { setStatusModal({visible:true,type:"error",title:"Error",message:getErrorMessage(e)}); }
    finally { setLoading(false); }
  };

  const assetOptions = currencies.length > 0 ? currencies.map((c:any)=>c.code) : ["USDT","BTC","ETH"];

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">{editData ? "Edit Ad" : "Post Ad"}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        <label className="text-sm text-gray-600 block mb-1">Type</label>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {(["Buy","Sell"] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer ${type===t?"bg-white shadow-sm":"text-gray-500"} ${type===t&&t==="Buy"?"text-green-600":""} ${type===t&&t==="Sell"?"text-red-500":""}`}>{t}</button>
          ))}
        </div>
        <label className="text-sm text-gray-600 block mb-1">Asset</label>
        <div className="flex gap-2 mb-4">{assetOptions.map((a:string) => (
          <button key={a} onClick={() => setAsset(a)} className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer ${asset===a?"bg-primary text-white":"bg-gray-100 text-gray-600"}`}>{a}</button>
        ))}</div>
        {[{l:"Price (NGN)",v:price,s:setPrice,p:"0.00"},{l:"Quantity",v:qty,s:setQty,p:"0.00"},{l:"Min Limit (NGN)",v:minLimit,s:setMinLimit,p:"0"},{l:"Max Limit (NGN)",v:maxLimit,s:setMaxLimit,p:"0"}].map(({l,v,s,p})=>(
          <div key={l} className="mb-4"><label className="text-sm text-gray-600 block mb-1">{l}</label><input type="number" value={v} onChange={e=>s(e.target.value)} placeholder={p} className="w-full border border-gray-200 rounded-xl p-3 text-sm"/></div>
        ))}
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50 mt-2">{loading ? "Processing..." : editData ? "Update Ad" : "Post Ad"}</button>
      </div>
      <StatusModal visible={statusModal.visible} onClose={() => { setStatusModal(s=>({...s,visible:false})); if(statusModal.type==="success") router.push("/my-ads"); }} type={statusModal.type} title={statusModal.title} message={statusModal.message} buttonText={statusModal.type==="success"?"Done":"OK"}/>
    </div>
  );
}
export default function PostAdPage() { return <Suspense><Content/></Suspense>; }
EOF

#=============================================================================
# BUY CRYPTO PAGE
#=============================================================================
cat > 'src/app/(app)/buy-crypto/page.tsx' << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PDisclaimerModal from "@/components/modals/P2PDisclaimerModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import P2POrderSuccessModal from "@/components/modals/P2POrderSuccessModal";
import StatusModal from "@/components/modals/StatusModal";
import { ArrowLeft } from "lucide-react";

function Content() {
  const router = useRouter(); const params = useSearchParams();
  const ad = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : {};
  const [amount, setAmount] = useState(""); const [loading, setLoading] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false); const [pinModal, setPinModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false); const [errorModal, setErrorModal] = useState<{visible:boolean;message:string}>({visible:false,message:""});
  const [orderResult, setOrderResult] = useState<any>(null);

  const qty = amount && ad.price ? (parseFloat(amount) / parseFloat(ad.price)).toFixed(6) : "0";
  const fee = "0";

  const handleBuy = () => { if (!amount) return; setDisclaimer(true); };
  const onDisclaimer = () => { setDisclaimer(false); setPinModal(true); };
  const onPin = async (pin: string) => {
    setPinModal(false); setLoading(true);
    try {
      const res = await p2pService.createOrder({ ad_id: ad.id, amount: parseFloat(amount), pin });
      setOrderResult({ type: "Buy", amount: `${amount} NGN`, price: `${ad.price} NGN`, fee, quantity: `${qty} ${ad.currency?.code || "USDT"}`, orderNo: res.data?.order_number || "---", orderTime: new Date().toLocaleString(), advertiser: ad.advertiser || "Trader" });
      setSuccessModal(true);
    } catch (e) { setErrorModal({visible:true,message:getErrorMessage(e)}); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer hover:text-gray-700"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Buy {ad.currency?.code || "Crypto"}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{(ad.advertiser||"T").charAt(0)}</div><p className="font-semibold text-sm">{ad.advertiser||"Trader"}</p></div>
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between"><span className="text-gray-400">Price</span><span className="font-semibold">₦{parseFloat(ad.price||0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Limits</span><span>{parseFloat(ad.min_amount||0).toLocaleString()} - {parseFloat(ad.max_amount||0).toLocaleString()} NGN</span></div>
        </div>
        <label className="text-sm text-gray-600 block mb-1">Amount (NGN)</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-2"/>
        <p className="text-xs text-gray-400 mb-6">You&apos;ll receive ≈ {qty} {ad.currency?.code||"USDT"}</p>
        <button onClick={handleBuy} disabled={loading||!amount} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Processing...":"Buy"}</button>
      </div>
      <P2PDisclaimerModal visible={disclaimer} onClose={() => setDisclaimer(false)} onConfirm={onDisclaimer}/>
      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin}/>
      {orderResult && <P2POrderSuccessModal visible={successModal} onClose={() => setSuccessModal(false)} order={orderResult}/>}
      <StatusModal visible={errorModal.visible} onClose={() => setErrorModal({visible:false,message:""})} type="error" title="Error" message={errorModal.message}/>
    </div>
  );
}
export default function BuyCryptoPage() { return <Suspense><Content/></Suspense>; }
EOF

#=============================================================================
# SELL CRYPTO PAGE
#=============================================================================
cat > 'src/app/(app)/sell-crypto/page.tsx' << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PDisclaimerModal from "@/components/modals/P2PDisclaimerModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import P2POrderSuccessModal from "@/components/modals/P2POrderSuccessModal";
import StatusModal from "@/components/modals/StatusModal";
import { ArrowLeft } from "lucide-react";

function Content() {
  const router = useRouter(); const params = useSearchParams();
  const ad = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : {};
  const [amount, setAmount] = useState(""); const [loading, setLoading] = useState(false);
  const [disclaimer, setDisclaimer] = useState(false); const [pinModal, setPinModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false); const [errorModal, setErrorModal] = useState<{visible:boolean;message:string}>({visible:false,message:""});
  const [orderResult, setOrderResult] = useState<any>(null);

  const total = amount && ad.price ? (parseFloat(amount) * parseFloat(ad.price)).toFixed(2) : "0";

  const handleSell = () => { if (!amount) return; setDisclaimer(true); };
  const onDisclaimer = () => { setDisclaimer(false); setPinModal(true); };
  const onPin = async (pin: string) => {
    setPinModal(false); setLoading(true);
    try {
      const res = await p2pService.createOrder({ ad_id: ad.id, amount: parseFloat(amount), pin });
      setOrderResult({ type: "Sell", amount: `${total} NGN`, price: `${ad.price} NGN`, fee: "0", quantity: `${amount} ${ad.currency?.code||"USDT"}`, orderNo: res.data?.order_number||"---", orderTime: new Date().toLocaleString(), advertiser: ad.advertiser||"Trader" });
      setSuccessModal(true);
    } catch (e) { setErrorModal({visible:true,message:getErrorMessage(e)}); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer hover:text-gray-700"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Sell {ad.currency?.code||"Crypto"}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{(ad.advertiser||"T").charAt(0)}</div><p className="font-semibold text-sm">{ad.advertiser||"Trader"}</p></div>
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between"><span className="text-gray-400">Price</span><span className="font-semibold">₦{parseFloat(ad.price||0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Limits</span><span>{parseFloat(ad.min_amount||0).toLocaleString()} - {parseFloat(ad.max_amount||0).toLocaleString()} NGN</span></div>
        </div>
        <label className="text-sm text-gray-600 block mb-1">Amount ({ad.currency?.code||"USDT"})</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter quantity" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-2"/>
        <p className="text-xs text-gray-400 mb-6">You&apos;ll receive ≈ ₦{parseFloat(total).toLocaleString()}</p>
        <button onClick={handleSell} disabled={loading||!amount} className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Processing...":"Sell"}</button>
      </div>
      <P2PDisclaimerModal visible={disclaimer} onClose={() => setDisclaimer(false)} onConfirm={onDisclaimer}/>
      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin}/>
      {orderResult && <P2POrderSuccessModal visible={successModal} onClose={() => setSuccessModal(false)} order={orderResult}/>}
      <StatusModal visible={errorModal.visible} onClose={() => setErrorModal({visible:false,message:""})} type="error" title="Error" message={errorModal.message}/>
    </div>
  );
}
export default function SellCryptoPage() { return <Suspense><Content/></Suspense>; }
EOF

echo "Post Ad + Buy/Sell done"

#=============================================================================
# MISSING PAGES FROM GAP ANALYSIS
#=============================================================================

# NOTIFICATIONS
cat > 'src/app/(app)/notifications/page.tsx' << 'EOF'
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
EOF

# NOTIFICATION DETAILS
cat > 'src/app/(app)/notification-details/page.tsx' << 'EOF'
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams();
  const id = params.get("id");
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <div className="bg-white rounded-2xl p-6"><h1 className="text-xl font-bold mb-4">Notification</h1><p className="text-sm text-gray-500">Notification ID: {id}</p></div>
    </div>
  );
}
export default function NotificationDetailsPage() { return <Suspense><Content/></Suspense>; }
EOF

# MANAGE NOTIFICATIONS
cat > 'src/app/(app)/manage-notifications/page.tsx' << 'EOF'
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
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
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
EOF

# AD SHARE
cat > 'src/app/(app)/ad-share/page.tsx' << 'EOF'
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdShareModal from "@/components/modals/AdShareModal";
import { ArrowLeft } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams();
  const ad = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : {};
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <AdShareModal visible={true} onClose={() => router.back()} adId={ad.id||""} adType={ad.type||"Buy"} asset={ad.asset||"USDT"} price={ad.price||"0"} fiat={ad.fiat||"NGN"}/>
    </div>
  );
}
export default function AdSharePage() { return <Suspense><Content/></Suspense>; }
EOF

# ASSET DETAIL
cat > 'src/app/(app)/asset-detail/page.tsx' << 'EOF'
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import TransactionItem from "@/components/TransactionItem";
import DepositModal from "@/components/modals/DepositModal";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams();
  const symbol = params.get("symbol") || "BTC"; const balance = params.get("balance") || "0";
  const [txs, setTxs] = useState<any[]>([]); const [depositOpen, setDepositOpen] = useState(false);
  useEffect(() => { walletService.getTransactions().then(r => setTxs((r.data||[]).slice(0,10))).catch(()=>{}); }, []);
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <div className="bg-white rounded-2xl p-6 mb-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold mx-auto mb-3">{symbol.charAt(0)}</div>
        <h2 className="text-2xl font-bold">{parseFloat(balance).toFixed(4)} {symbol}</h2>
        <p className="text-gray-400 text-sm">≈ $---</p>
        <div className="flex justify-center gap-4 mt-4">
          <button onClick={() => setDepositOpen(true)} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"><ArrowDownLeft size={16}/>Deposit</button>
          <button onClick={() => router.push(`/withdraw-crypto?symbol=${symbol}`)} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"><ArrowUpRight size={16}/>Withdraw</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5">
        <h3 className="font-bold mb-3">Recent Transactions</h3>
        {txs.length === 0 ? <p className="text-center text-gray-400 py-6">No transactions</p> : txs.map((t: any, i: number) => <TransactionItem key={i} type={t.type} asset={symbol} amount={`${t.amount}`} date={new Date(t.created_at).toLocaleDateString()} status={t.status}/>)}
      </div>
      <DepositModal visible={depositOpen} onClose={() => setDepositOpen(false)} symbol={symbol}/>
    </div>
  );
}
export default function AssetDetailPage() { return <Suspense><Content/></Suspense>; }
EOF

# BALANCE
cat > 'src/app/(app)/balance/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { ArrowLeft } from "lucide-react";
const FIAT = ["NGN","USD","EUR","GBP"];
export default function BalancePage() {
  const router = useRouter(); const { wallets } = useWallet();
  const crypto = wallets.filter((w:any) => !FIAT.includes(w.currency));
  const fiat = wallets.filter((w:any) => FIAT.includes(w.currency));
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Balance Breakdown</h1>
      {[{title:"Crypto",items:crypto},{title:"Fiat",items:fiat}].map(s => (
        <div key={s.title} className="bg-white rounded-2xl p-5 mb-4">
          <h2 className="font-bold mb-3">{s.title}</h2>
          {s.items.length === 0 ? <p className="text-gray-400 text-sm">No {s.title.toLowerCase()} wallets</p> : s.items.map((w:any,i:number) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm font-medium">{w.currency}</span><span className="text-sm">{parseFloat(w.balance).toFixed(4)}</span></div>
          ))}
        </div>
      ))}
    </div>
  );
}
EOF

# TRANSACTION DETAILS
cat > 'src/app/(app)/transaction-details/page.tsx' << 'EOF'
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams(); const id = params.get("id");
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Transaction Details</h1>
      <div className="bg-white rounded-2xl p-6">
        <p className="text-sm text-gray-500 mb-4">Transaction ID: {id}</p>
        <p className="text-center text-gray-400 py-6">Details will load from the blockchain explorer.</p>
      </div>
    </div>
  );
}
export default function TransactionDetailsPage() { return <Suspense><Content/></Suspense>; }
EOF

# ORDER DETAILS
cat > 'src/app/(app)/order-details/page.tsx' << 'EOF'
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams();
  const order = params.get("order") ? JSON.parse(decodeURIComponent(params.get("order")!)) : {};
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Order Details</h1>
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold"><span className={order.type==="Buy"?"text-green-600":"text-red-500"}>{order.type}</span> {order.asset}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${order.status==="completed"?"bg-green-100 text-green-600":"bg-red-100 text-red-500"}`}>{order.status}</span>
        </div>
        <div className="space-y-3 text-sm">
          {[["Amount",order.amount],["Price",order.price],["Quantity",order.quantity],["Order No.",order.orderNo],["Date",order.date]].map(([k,v])=>
            <div key={k} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">{k}</span><span className="font-medium">{v}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
export default function OrderDetailsPage() { return <Suspense><Content/></Suspense>; }
EOF

# ACCOUNT SUMMARY
cat > 'src/app/(app)/account-summary/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
export default function AccountSummaryPage() {
  const router = useRouter(); const { user } = useAuth();
  const u = user as Record<string,any> || {};
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Account Summary</h1>
      <div className="bg-white rounded-2xl p-6 space-y-3 text-sm">
        {[["Username",u.username],["Email",u.email],["Phone",u.phone||"Not set"],["KYC Level",u.kyc_level||"Unverified"],["Created",u.created_at?new Date(u.created_at).toLocaleDateString():"---"]].map(([k,v])=>
          <div key={k} className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">{k}</span><span className="font-medium">{v}</span></div>
        )}
      </div>
    </div>
  );
}
EOF

# MANAGE BLACKLIST
cat > 'src/app/(app)/manage-blacklist/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
export default function ManageBlacklistPage() {
  const router = useRouter(); const [blacklist] = useState<any[]>([]);
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Manage Blacklist</h1>
      <div className="bg-white rounded-2xl p-5">
        {blacklist.length === 0 ? (
          <div className="text-center py-16"><UserX size={48} className="text-gray-200 mx-auto mb-4"/><p className="text-gray-400">No blacklisted users</p></div>
        ) : blacklist.map((u: any, i: number) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50"><span className="text-sm">{u.username}</span><button className="text-red-500 text-sm cursor-pointer">Remove</button></div>
        ))}
      </div>
    </div>
  );
}
EOF

# SUPPORT
cat > 'src/app/(app)/support/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
export default function SupportPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Support</h1>
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <a href="mailto:support@kynettic.com" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100"><Mail size={20} className="text-primary"/><div><p className="font-semibold text-sm">Email Support</p><p className="text-xs text-gray-400">support@kynettic.com</p></div></a>
        <button className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer"><MessageCircle size={20} className="text-primary"/><div className="text-left"><p className="font-semibold text-sm">Live Chat</p><p className="text-xs text-gray-400">Chat with our support team</p></div></button>
      </div>
    </div>
  );
}
EOF

# TERMS
cat > 'src/app/(app)/terms/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function TermsPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Terms & Conditions</h1>
      <div className="bg-white rounded-2xl p-6 prose prose-sm max-w-none">
        <h2>1. Introduction</h2><p>Welcome to Kynettic. By using our services, you agree to these terms.</p>
        <h2>2. Services</h2><p>Kynettic provides P2P cryptocurrency trading services. All trades are automated and secured.</p>
        <h2>3. User Responsibilities</h2><p>Users must complete KYC verification. Users are responsible for the security of their accounts.</p>
        <h2>4. Privacy</h2><p>We collect and process data in accordance with our Privacy Policy.</p>
        <h2>5. Limitation of Liability</h2><p>Kynettic is not liable for losses due to market volatility or third-party actions.</p>
      </div>
    </div>
  );
}
EOF

# CHANGE PIN SUCCESS
cat > 'src/app/(app)/change-pin-success/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function ChangePinSuccessPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
        <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">PIN Changed!</h1>
        <p className="text-sm text-gray-500 mb-6">Your transaction PIN has been updated successfully.</p>
        <button onClick={() => router.push("/security-settings")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Done</button>
      </div>
    </div>
  );
}
EOF

echo "Missing pages done"

#=============================================================================
# REMAINING APP PAGES — Profile, Security, KYC, Deposit/Withdraw flows, etc.
#=============================================================================

# PROFILE
cat > 'src/app/(app)/profile/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { User, Shield, Key, CreditCard, Users, FileText, HelpCircle, LogOut, ChevronRight } from "lucide-react";
const MENU = [
  { label: "Personal Details", href: "/personal-details", icon: User },
  { label: "Security Settings", href: "/security-settings", icon: Shield },
  { label: "Verification", href: "/verification-dashboard", icon: Key },
  { label: "Account Summary", href: "/account-summary", icon: CreditCard },
  { label: "Referrals", href: "/referrals", icon: Users },
  { label: "Terms & Conditions", href: "/terms", icon: FileText },
  { label: "Support", href: "/support", icon: HelpCircle },
];
export default function ProfilePage() {
  const router = useRouter(); const { user, logout } = useAuth();
  const u = user as Record<string,any> || {};
  const name = u.first_name || u.username || "User";
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Profile</h1>
      <div className="bg-white rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold">{name.charAt(0).toUpperCase()}</div>
        <div><p className="font-bold text-lg">{name}</p><p className="text-sm text-gray-400">{u.email || ""}</p></div>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden">
        {MENU.map(m => (
          <button key={m.label} onClick={() => router.push(m.href)} className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center gap-3"><m.icon size={18} className="text-gray-400"/><span className="text-sm font-medium">{m.label}</span></div>
            <ChevronRight size={16} className="text-gray-300"/>
          </button>
        ))}
        <button onClick={async () => { await logout(); router.replace("/login"); }} className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 cursor-pointer">
          <LogOut size={18}/><span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}
EOF

# PERSONAL DETAILS
cat > 'src/app/(app)/personal-details/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ChevronRight } from "lucide-react";
export default function PersonalDetailsPage() {
  const router = useRouter(); const { user } = useAuth();
  const u = user as Record<string,any> || {};
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Personal Details</h1>
      <div className="bg-white rounded-2xl overflow-hidden">
        {[{l:"Username",v:u.username||"---",href:"/edit-username"},{l:"Email",v:u.email||"---"},{l:"Phone",v:u.phone||"Not set",href:"/edit-contact-details"},{l:"First Name",v:u.first_name||"---"},{l:"Last Name",v:u.last_name||"---"}].map(item => (
          <button key={item.l} onClick={() => item.href && router.push(item.href)} className={`w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 ${item.href?"hover:bg-gray-50 cursor-pointer":"cursor-default"}`}>
            <div><p className="text-xs text-gray-400">{item.l}</p><p className="text-sm font-medium">{item.v}</p></div>
            {item.href && <ChevronRight size={16} className="text-gray-300"/>}
          </button>
        ))}
      </div>
    </div>
  );
}
EOF

# EDIT USERNAME
cat > 'src/app/(app)/edit-username/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userService } from "@/services/user.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function EditUsernamePage() {
  const router = useRouter(); const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState((user as Record<string,any>)?.username || "");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await userService.updateUsername(username); await refreshUser(); router.back(); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Edit Username</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}
EOF

# EDIT CONTACT DETAILS
cat > 'src/app/(app)/edit-contact-details/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { userService } from "@/services/user.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function EditContactDetailsPage() {
  const router = useRouter(); const { user, refreshUser } = useAuth();
  const u = user as Record<string,any> || {};
  const [phone, setPhone] = useState(u.phone || "");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await userService.updatePhone(phone); await refreshUser(); router.back(); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Edit Contact Details</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <label className="text-sm text-gray-600 block mb-1">Phone</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Saving...":"Save"}</button>
      </div>
    </div>
  );
}
EOF

# SECURITY SETTINGS
cat > 'src/app/(app)/security-settings/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Key, Lock, Shield, Smartphone } from "lucide-react";
const ITEMS = [
  { label: "Change Password", desc: "Update your account password", href: "/change-password", icon: Lock },
  { label: "Transaction PIN", desc: "Set or change your PIN", href: "/pin-setup", icon: Key },
  { label: "Two-Factor Auth", desc: "Add extra security layer", href: "/two-factor-setup", icon: Smartphone },
  { label: "Manage Blacklist", desc: "Manage blocked users", href: "/manage-blacklist", icon: Shield },
];
export default function SecuritySettingsPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Security Settings</h1>
      <div className="bg-white rounded-2xl overflow-hidden">
        {ITEMS.map(m => (
          <button key={m.label} onClick={() => router.push(m.href)} className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center gap-3"><m.icon size={18} className="text-gray-400"/><div><p className="text-sm font-medium">{m.label}</p><p className="text-xs text-gray-400">{m.desc}</p></div></div>
            <ChevronRight size={16} className="text-gray-300"/>
          </button>
        ))}
      </div>
    </div>
  );
}
EOF

# CHANGE PASSWORD
cat > 'src/app/(app)/change-password/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(""); const [newPw, setNewPw] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if (newPw !== confirm) { setError("Passwords don't match"); return; } setLoading(true); setError(""); try { await securityService.changePassword(current, newPw); router.push("/password-changed"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Change Password</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="Current Password" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"/>
        <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New Password" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"/>
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm New Password" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Changing...":"Change Password"}</button>
      </div>
    </div>
  );
}
EOF

# PIN SETUP
cat > 'src/app/(app)/pin-setup/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function PinSetupPage() {
  const router = useRouter();
  const [pin, setPin] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if(pin!==confirm){setError("PINs don't match");return;} if(pin.length<4){setError("PIN must be 4 digits");return;} setLoading(true); setError(""); try { await securityService.setPin(pin); router.push("/change-pin-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Setup Transaction PIN</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="Enter 4-digit PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-3"/>
        <input type="password" maxLength={4} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,""))} placeholder="Confirm PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Setting...":"Set PIN"}</button>
      </div>
    </div>
  );
}
EOF

# CHANGE PIN VERIFY + CHANGE PIN NEW (for changing existing PIN)
cat > 'src/app/(app)/change-pin-verify/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function ChangePinVerifyPage() {
  const router = useRouter();
  const [pin, setPin] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await securityService.verifyPin(pin); router.push("/change-pin-new"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Verify Current PIN</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="Current PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button onClick={handle} disabled={loading||pin.length<4} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Verifying...":"Continue"}</button>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/change-pin-new/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function ChangePinNewPage() {
  const router = useRouter();
  const [pin, setPin] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if(pin!==confirm){setError("PINs don't match");return;} setLoading(true); setError(""); try { await securityService.changePin(pin, pin); router.push("/change-pin-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Set New PIN</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="New PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-3"/>
        <input type="password" maxLength={4} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,""))} placeholder="Confirm PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Setting...":"Change PIN"}</button>
      </div>
    </div>
  );
}
EOF

# TWO FACTOR SETUP
cat > 'src/app/(app)/two-factor-setup/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft, Smartphone } from "lucide-react";
export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"intro"|"verify">("intro"); const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await securityService.enable2FA(code); router.push("/security-settings"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Two-Factor Authentication</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {step === "intro" ? (
          <div className="text-center">
            <Smartphone size={48} className="text-primary mx-auto mb-4"/>
            <h3 className="font-bold text-lg mb-2">Secure Your Account</h3>
            <p className="text-sm text-gray-500 mb-6">Enable 2FA for an extra layer of security. You&apos;ll need a verification code each time you log in.</p>
            <button onClick={() => setStep("verify")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Enable 2FA</button>
          </div>
        ) : (
          <div>
            {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
            <p className="text-sm text-gray-500 mb-4">Enter the verification code sent to your email.</p>
            <input type="text" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="Enter code" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
            <button onClick={handle} disabled={loading||code.length<4} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Verifying...":"Confirm"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
EOF

# VERIFICATION DASHBOARD
cat > 'src/app/(app)/verification-dashboard/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
const TIERS = [
  { level: 1, name: "Basic Verification", desc: "Personal data + BVN", href: "/tier1-basic", features: ["Deposit up to ₦500,000", "Trade up to ₦200,000/day"] },
  { level: 2, name: "Intermediate", desc: "BVN + NIN verification", href: "/tier2-address", features: ["Deposit up to ₦5,000,000", "Trade up to ₦2,000,000/day"] },
  { level: 3, name: "Advanced", desc: "Facial recognition + NIN photo", href: "/tier3-advanced", features: ["Unlimited deposits", "Unlimited trading"] },
];
export default function VerificationDashboardPage() {
  const router = useRouter(); const { user } = useAuth();
  const kycLevel = (user as Record<string,any>)?.kyc_level || 0;
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Verification</h1>
      <div className="space-y-4">
        {TIERS.map(t => {
          const completed = kycLevel >= t.level;
          return (
            <button key={t.level} onClick={() => !completed && router.push(t.href)} className={`w-full bg-white rounded-2xl p-5 text-left hover:shadow-sm cursor-pointer ${completed?"opacity-70":""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">{completed ? <CheckCircle2 size={20} className="text-green-500"/> : <Circle size={20} className="text-gray-300"/>}<div><p className="font-semibold text-sm">Tier {t.level}: {t.name}</p><p className="text-xs text-gray-400">{t.desc}</p></div></div>
                {!completed && <ChevronRight size={16} className="text-gray-300"/>}
              </div>
              <ul className="ml-8 mt-2 space-y-1">{t.features.map(f => <li key={f} className="text-xs text-gray-400">• {f}</li>)}</ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
EOF

# KYC TIER PAGES (simplified)
for tier in tier1-basic tier1-id tier1-selfie tier2-address tier2-proof tier3-advanced; do
  cat > "src/app/(app)/${tier}/page.tsx" << TIEREOF
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { kycService } from "@/services/kyc.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
const TITLES: Record<string,string> = { "tier1-basic": "Basic Verification", "tier1-id": "ID Verification", "tier1-selfie": "Selfie Verification", "tier2-address": "Address Verification", "tier2-proof": "Proof of Address", "tier3-advanced": "Advanced Verification" };
export default function KYCPage() {
  const router = useRouter();
  const title = TITLES["${tier}"] || "Verification";
  const [value, setValue] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await kycService.submitTier1({ bvn: value }); router.push("/verification-dashboard"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">{title}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="Enter required information" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Submitting...":"Submit"}</button>
      </div>
    </div>
  );
}
TIEREOF
done

# REFERRALS
cat > 'src/app/(app)/referrals/page.tsx' << 'EOF'
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { referralService } from "@/services/referral.service";
import { ArrowLeft, Copy, CheckCircle2, Users } from "lucide-react";
export default function ReferralsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null); const [copied, setCopied] = useState(false);
  useEffect(() => { referralService.getReferralInfo().then(r => setData(r.data)).catch(()=>{}); }, []);
  const code = data?.referral_code || "---";
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Referrals</h1>
      <div className="bg-primary rounded-2xl p-6 text-white mb-6 text-center">
        <Users size={32} className="mx-auto mb-3 opacity-80"/>
        <h2 className="font-bold text-lg mb-1">Invite Friends</h2>
        <p className="text-sm opacity-80 mb-4">Share your referral code and earn rewards</p>
        <div className="bg-white/20 rounded-xl p-3 flex items-center justify-between"><span className="font-mono font-semibold">{code}</span><button onClick={copy} className="cursor-pointer">{copied?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button></div>
      </div>
      <div className="bg-white rounded-2xl p-5">
        <h3 className="font-bold mb-3">Referred Users</h3>
        <p className="text-sm text-gray-400">{data?.referred_count || 0} users referred</p>
      </div>
    </div>
  );
}
EOF

# BULK COINS PURCHASE
cat > 'src/app/(app)/bulk-coins-purchase/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function BulkCoinsPurchasePage() {
  const router = useRouter();
  const [asset, setAsset] = useState("BTC"); const [amount, setAmount] = useState("");
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Bulk Coins Purchase</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        <div className="bg-gradient-to-br from-[#4472B7] to-[#2d5a9e] rounded-xl p-6 text-white text-center mb-6">
          <h3 className="font-bold text-lg mb-2">Buy Large Amounts</h3>
          <p className="text-sm opacity-80">Purchase bulk cryptocurrency directly from Kynettic at competitive rates.</p>
        </div>
        <label className="text-sm text-gray-600 block mb-1">Select Asset</label>
        <div className="flex gap-2 mb-4">{["BTC","ETH","USDT"].map(a=><button key={a} onClick={()=>setAsset(a)} className={`px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer ${asset===a?"bg-primary text-white":"bg-gray-100 text-gray-600"}`}>{a}</button>)}</div>
        <label className="text-sm text-gray-600 block mb-1">Amount (USD)</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Minimum $1,000" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Request Quote</button>
      </div>
    </div>
  );
}
EOF

# DEPOSIT FLOWS
cat > 'src/app/(app)/deposit/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import DepositModal from "@/components/modals/DepositModal";
export default function DepositPage() { const router = useRouter(); return <DepositModal visible={true} onClose={() => router.back()}/>; }
EOF

cat > 'src/app/(app)/deposit-search/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { ArrowLeft, Search } from "lucide-react";
const FIAT = ["NGN","USD","EUR","GBP"];
export default function DepositSearchPage() {
  const router = useRouter(); const { wallets } = useWallet(); const [q, setQ] = useState("");
  const crypto = wallets.filter((w:any)=>!FIAT.includes(w.currency)).filter((w:any)=>w.currency.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-4">Select Asset to Deposit</h1>
      <div className="relative mb-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-3 bg-white rounded-xl text-sm"/></div>
      <div className="bg-white rounded-2xl overflow-hidden">{crypto.map((w:any,i:number)=>(
        <button key={i} onClick={()=>router.push(`/asset-detail?symbol=${w.currency}&balance=${w.balance}`)} className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">{w.currency.charAt(0)}</div>
          <span className="text-sm font-medium">{w.currency}</span>
        </button>
      ))}</div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/deposit-fiat/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function DepositFiatPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Deposit Fiat</h1>
      <div className="bg-white rounded-2xl p-6">
        <div className="bg-blue-50 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">Transfer to:</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">Kynettic Bank</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-medium font-mono">1234567890</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">Kynettic Limited</span></div>
          </div>
        </div>
        <button onClick={() => router.push("/deposit-success")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">I have made this transfer</button>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/deposit-success/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function DepositSuccessPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Deposit Initiated!</h1>
        <p className="text-sm text-gray-500 mb-6">Your deposit is being processed. You&apos;ll be notified when confirmed.</p>
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Back to Wallet</button>
      </div>
    </div>
  );
}
EOF

# WITHDRAW FLOWS
cat > 'src/app/(app)/withdraw-search/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { ArrowLeft, Search } from "lucide-react";
const FIAT = ["NGN","USD","EUR","GBP"];
export default function WithdrawSearchPage() {
  const router = useRouter(); const { wallets } = useWallet(); const [q, setQ] = useState("");
  const crypto = wallets.filter((w:any)=>!FIAT.includes(w.currency)).filter((w:any)=>w.currency.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-4">Select Asset to Withdraw</h1>
      <div className="relative mb-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-3 bg-white rounded-xl text-sm"/></div>
      <div className="bg-white rounded-2xl overflow-hidden">{crypto.map((w:any,i:number)=>(
        <button key={i} onClick={()=>router.push(`/withdraw-crypto?symbol=${w.currency}`)} className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">{w.currency.charAt(0)}</div><span className="text-sm font-medium">{w.currency}</span></div>
          <span className="text-sm text-gray-400">{parseFloat(w.balance).toFixed(4)}</span>
        </button>
      ))}</div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/withdraw-crypto/page.tsx' << 'EOF'
"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
function Content() {
  const router = useRouter(); const params = useSearchParams(); const symbol = params.get("symbol") || "BTC";
  const [address, setAddress] = useState(""); const [amount, setAmount] = useState(""); const [network, setNetwork] = useState("ERC20");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if(!address||!amount){setError("Fill all fields");return;} setLoading(true); setError(""); try { await walletService.withdrawCrypto({ currency: symbol, address, amount: parseFloat(amount), network }); router.push("/withdraw-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Withdraw {symbol}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <label className="text-sm text-gray-600 block mb-1">Network</label>
        <select value={network} onChange={e=>setNetwork(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4">{["ERC20","TRC20","BTC","BEP20"].map(n=><option key={n} value={n}>{n}</option>)}</select>
        <label className="text-sm text-gray-600 block mb-1">Wallet Address</label>
        <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Paste address" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <label className="text-sm text-gray-600 block mb-1">Amount</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Processing...":"Withdraw"}</button>
      </div>
    </div>
  );
}
export default function WithdrawCryptoPage() { return <Suspense><Content/></Suspense>; }
EOF

cat > 'src/app/(app)/withdraw-fiat/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function WithdrawFiatPage() {
  const router = useRouter();
  const [bank, setBank] = useState(""); const [account, setAccount] = useState(""); const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if(!bank||!account||!amount){setError("Fill all fields");return;} setLoading(true); setError(""); try { await walletService.withdrawFiat({ bank_name: bank, account_number: account, amount: parseFloat(amount), currency: "NGN" }); router.push("/fiat-withdraw-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Withdraw Fiat</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input value={bank} onChange={e=>setBank(e.target.value)} placeholder="Bank Name" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"/>
        <input value={account} onChange={e=>setAccount(e.target.value)} placeholder="Account Number" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"/>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Processing...":"Withdraw"}</button>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/withdraw-success/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function WithdrawSuccessPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Withdrawal Initiated!</h1>
        <p className="text-sm text-gray-500 mb-6">Your withdrawal is being processed.</p>
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Back to Wallet</button>
      </div>
    </div>
  );
}
EOF

cat > 'src/app/(app)/fiat-withdraw-success/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export default function FiatWithdrawSuccessPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Fiat Withdrawal Initiated!</h1>
        <p className="text-sm text-gray-500 mb-6">Your fiat withdrawal is being processed.</p>
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Back to Wallet</button>
      </div>
    </div>
  );
}
EOF

# FIAT INTERNAL TRANSFER
cat > 'src/app/(app)/fiat-internal-transfer/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function FiatInternalTransferPage() {
  const router = useRouter();
  const [recipient, setRecipient] = useState(""); const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await walletService.internalTransfer({ recipient, amount: parseFloat(amount), currency: "NGN" }); router.push("/fiat-withdraw-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Internal Transfer</h1>
      <div className="bg-white rounded-2xl p-6 max-w-lg">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Recipient username or email" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-3"/>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Sending...":"Send"}</button>
      </div>
    </div>
  );
}
EOF

# BANK TRANSFER
cat > 'src/app/(app)/bank-transfer/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function BankTransferPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Bank Transfer</h1>
      <div className="bg-white rounded-2xl p-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">Transfer Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">Kynettic Bank</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-medium font-mono">1234567890</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">Kynettic Limited</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

# FIAT SECURITY
cat > 'src/app/(app)/fiat-security/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
export default function FiatSecurityPage() {
  const router = useRouter();
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Fiat Security</h1>
      <div className="bg-white rounded-2xl p-6 text-center">
        <Shield size={48} className="text-primary mx-auto mb-4"/>
        <h3 className="font-bold text-lg mb-2">Your fiat is secure</h3>
        <p className="text-sm text-gray-500">All fiat deposits are protected by our security protocols. Withdrawals require PIN verification.</p>
      </div>
    </div>
  );
}
EOF

# SECURITY VERIFICATION
cat > 'src/app/(app)/security-verification/page.tsx' << 'EOF'
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export default function SecurityVerificationPage() {
  const router = useRouter(); const [code, setCode] = useState("");
  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Security Verification</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        <p className="text-sm text-gray-500 mb-4">Enter the verification code sent to your email.</p>
        <input type="text" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="Enter code" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50" disabled={code.length<4}>Verify</button>
      </div>
    </div>
  );
}
EOF

# EMAIL CONFIRMATION
cat > 'src/app/(app)/email-confirmation/page.tsx' << 'EOF'
"use client";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
export default function EmailConfirmationPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <Mail size={48} className="text-primary mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-sm text-gray-500 mb-6">We&apos;ve sent a confirmation link to your email. Please verify to continue.</p>
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Done</button>
      </div>
    </div>
  );
}
EOF

echo "=== gen3.sh complete ==="
