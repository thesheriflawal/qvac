"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAds } from "@/context/AdsContext";
import { useWallet } from "@/context/WalletContext";
import { walletService } from "@/services/wallet.service";
import { Plus, Share2, Edit, Trash2 } from "lucide-react";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

export default function MyAdsPage() {
  const router = useRouter();
  const { ads, currencies, toggleAdStatus, deleteAd, loading, refreshAds } = useAds();
  const { getWalletByCurrency } = useWallet();
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Fetch live NGN prices for all unique currencies used in relative ads
  useEffect(() => {
    const relativeAds = ads.filter(a => a.priceType === "Relative");
    const seen = new Set<string>();
    relativeAds.forEach(a => {
      const symbol = (a.asset || "").toUpperCase();
      if (!symbol || seen.has(symbol)) return;
      seen.add(symbol);
      fetch(`/api/market-price?symbol=${symbol}`)
        .then(r => r.json())
        .then(data => {
          const p = parseFloat(data?.price || "0");
          if (p > 0) setLivePrices(prev => ({ ...prev, [a.asset]: p }));
        })
        .catch(() => {});
    });
  }, [ads]);
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
    <div className="w-full">
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
                <div className="flex justify-between">
                  <span className="text-gray-400">Price</span>
                  <span>
                    {(() => {
                      if (ad.priceType === "Relative" && ad.relativePercent) {
                        const relVal = parseFloat(ad.relativePercent);
                        const sign = relVal >= 0 ? "+" : "";
                        const liveRef = livePrices[ad.asset];
                        const effective = liveRef ? liveRef + relVal : null;
                        return `Market ${sign}${relVal} NGN${effective ? ` (${effective.toLocaleString("en-NG", { minimumFractionDigits: 2 })})` : ""}`;
                      }
                      return `${parseFloat(ad.price || "0").toLocaleString("en-NG", { minimumFractionDigits: 2 })} ${ad.fiat}/${ad.asset}`;
                    })()}
                  </span>
                </div>
                {(() => {
                  const currency = ad.type === "Buy" ? ad.fiat : ad.asset;
                  const walletBal = parseFloat(String(getWalletByCurrency(currency)?.balance || "0"));
                  const displayQty = ad.rolloverEnabled
                    ? walletBal
                    : parseFloat(ad.remainingQuantity || ad.totalQuantity || "0");
                  return (
                    <>
                      <div className="flex justify-between"><span className="text-gray-400">Quantity</span><span>{displayQty.toLocaleString("en-US", { maximumFractionDigits: 6 })} {currency}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Limits</span><span>{parseFloat(ad.minLimit).toLocaleString()} - {displayQty.toLocaleString("en-US", { maximumFractionDigits: 6 })} {currency}</span></div>
                    </>
                  );
                })()}
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ad.active?"bg-green-100 text-green-600":"bg-red-100 text-red-500"}`}>{ad.active?"Active":"Inactive"}</span>
                <div className="flex gap-3">
                  <button onClick={() => router.push(`/ad-share?ad=${encodeURIComponent(JSON.stringify({ ...ad, id: ad.id }))}`)} className="flex items-center gap-1 text-gray-400 text-sm cursor-pointer hover:text-gray-600"><Share2 size={14}/>Share</button>
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
