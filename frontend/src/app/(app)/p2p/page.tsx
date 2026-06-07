"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { useAds } from "@/context/AdsContext";
import { ChevronDown, ChevronUp } from "lucide-react";
import CurrencyIcon from "@/components/CurrencyIcon";
import { useVerificationGate } from "@/hooks/useVerificationGate";
import VerificationGateModal from "@/components/VerificationGateModal";

const BANNERS = [
  {
    gradient: "linear-gradient(to right, #3B5998, #4472B7)",
    title: "Click Here To Buy Bulk Coins",
    desc: "Purchase large coin amounts directly from us.",
    href: "/bulk-coins-purchase",
    image: "/assets/bannerImg.png",
  },
  // {
  //   gradient: "linear-gradient(135deg, #14532D 0%, #16A34A 60%, #22C55E 100%)",
  //   title: "Trade $1K. Get $10 Free.",
  //   desc: "This week only — bonus on all qualifying $1,000+ trades.",
  //   href: null,
  //   image: null,
  // },
];

export default function P2PPage() {
  const router = useRouter();
  const { requireVerification, showGate, setShowGate, handleVerifyNow } = useVerificationGate();
  const [activeBanner, setActiveBanner] = useState(0);
  const [tradeType, setTradeType] = useState<"Buy"|"Sell">("Buy");
  const [selectedAsset, setSelectedAsset] = useState("ALL");
  const [selectedFiat, setSelectedFiat] = useState("NGN");
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { p2pFeeMultiplier } = useAds();
  const [amountOpen, setAmountOpen] = useState(false);
  const [filterAmount, setFilterAmount] = useState("");
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [fiatDropdownOpen, setFiatDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setActiveBanner(p => (p + 1) % BANNERS.length), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { fetchCurrencies(); }, []);

  const fetchCurrencies = async () => {
    try {
      const res = await p2pService.getCurrencies();
      if (res?.data) setCurrencies(res.data);
    } catch {}
  };

  // Buy side: user wants to buy → looking at sell ads → lowest price first
  // Sell side: user wants to sell → looking at buy ads → highest price first
  const isDepletedAd = (ad: any) => {
    const rawQty = parseFloat(String(ad.available_quantity || ad.remaining_quantity || "0"))
      || parseFloat(String(ad.total_quantity || "0"));
    const effectiveMax = rawQty > 0 ? rawQty / p2pFeeMultiplier : 0;
    return parseFloat(ad.min_amount || "0") > effectiveMax;
  };

  const TOKEN_ORDER: Record<string, number> = { USDT: 0, USDC: 1, SOL: 2, ETH: 3 };
  const getTokenRank = (currency: string) => TOKEN_ORDER[(currency || "").toUpperCase()] ?? 4;

  const sortAds = (list: any[], side: "Buy" | "Sell") => {
    return [...list].sort((a, b) => {
      const aDepleted = isDepletedAd(a) ? 1 : 0;
      const bDepleted = isDepletedAd(b) ? 1 : 0;
      if (aDepleted !== bDepleted) return aDepleted - bDepleted;
      const aRank = getTokenRank(a.currency);
      const bRank = getTokenRank(b.currency);
      if (aRank !== bRank) return aRank - bRank;
      const pa = parseFloat(a.effective_price || a.price || "0");
      const pb = parseFloat(b.effective_price || b.price || "0");
      return side === "Buy" ? pa - pb : pb - pa;
    });
  };

  const fetchAds = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const apiType = tradeType === "Buy" ? "sell" : "buy";
      const curr = currencies.find((c: any) => (c.code || c.symbol) === selectedAsset);
      const res = curr
        ? await p2pService.getMarketplaceAds(apiType, curr.id, page)
        : await p2pService.getMarketplaceAds(apiType, undefined, page);
      const items = res?.data || [];
      setAds(sortAds(items, tradeType));
      // Derive total pages from API meta if available, else assume more exist when full page returned
      const total = res?.meta?.total ?? res?.total ?? null;
      const pageSize = res?.meta?.page_size ?? res?.page_size ?? 50;
      if (total !== null) {
        setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
      } else {
        setTotalPages(prev => items.length === pageSize ? Math.max(prev, page + 1) : page);
      }
    } catch { setAds([]); setTotalPages(1); }
    finally { setLoading(false); }
  }, [tradeType, selectedAsset, currencies]);

  // Reset to page 1 and debounce when filters change
  useEffect(() => {
    if (currencies.length === 0) return;
    setCurrentPage(1);
    const t = setTimeout(() => fetchAds(1), 300);
    return () => clearTimeout(t);
  }, [tradeType, selectedAsset, currencies]);

  const PREFERRED_ORDER = ["USDT", "USDC", "SOL", "ETH"];
  const rawAssets = currencies.length > 0
    ? currencies.map((c: any) => c.code || c.symbol).filter(Boolean).filter((s: string) => s !== "NGN")
    : ["USDT", "USDC", "SOL", "ETH", "BTC", "TRX", "XRP", "BNB"];
  const assetOptions = [
    "ALL",
    ...PREFERRED_ORDER.filter(t => rawAssets.includes(t)),
    ...rawAssets.filter((t: string) => !PREFERRED_ORDER.includes(t)),
  ];

  const fiatOptions = ["NGN"];

  return (
    <div className="w-full">
      <h1 className="text-xl font-bold text-[#1D3B53] mb-4">P2P Trading</h1>

      {/* Banner Slideshow */}
      <div className="relative w-full rounded-2xl overflow-hidden mb-5" style={{ height: "110px" }}>
        {BANNERS.map((banner, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-700 ${activeBanner === idx ? "opacity-100 z-10" : "opacity-0 z-0"} ${banner.href ? "cursor-pointer" : ""}`}
            style={{ background: banner.gradient }}
            onClick={banner.href ? () => router.push(banner.href!) : undefined}
          >
            <div className="flex items-stretch h-full relative">
              <div className="flex flex-col justify-center pl-5 py-5 z-10 w-[58%]">
                <p className="text-white font-bold text-sm leading-snug mb-1">{banner.title}</p>
                <p className="text-white/70 text-xs leading-relaxed">{banner.desc}</p>
              </div>
              {banner.image ? (
                <div className="absolute bottom-0 right-3 h-full w-[45%] flex items-end justify-end">
                  <img src={banner.image} alt="" className="h-full w-full object-contain object-bottom" />
                </div>
              ) : (
                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
                  <span className="text-white font-black text-4xl leading-none drop-shadow-lg">$10</span>
                  <span className="text-white/70 text-[9px] font-bold tracking-widest uppercase mt-1">BONUS</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Dot indicators */}
        <div className="absolute bottom-2.5 right-4 flex gap-1.5 z-20">
          {BANNERS.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setActiveBanner(idx); }}
              className={`rounded-full transition-all duration-300 cursor-pointer ${activeBanner === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>

      {/* Trade Type Toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {(["Buy","Sell"] as const).map(t => (
          <button key={t} onClick={() => setTradeType(t)} className={`px-6 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${tradeType===t?"bg-white shadow-sm":"text-gray-500"} ${tradeType===t&&t==="Buy"?"text-[#5CB85C]":""} ${tradeType===t&&t==="Sell"?"text-[#D92D20]":""}`}>{t}</button>
        ))}
      </div>

      {/* Filter Bar: Asset dropdown, Amount toggle, Fiat dropdown */}
      <div className="flex items-center gap-3 mb-2">
        {/* Asset Selector */}
        <div className="relative">
          <button
            onClick={() => { setAssetDropdownOpen(!assetDropdownOpen); setFiatDropdownOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#1D3B53] cursor-pointer"
          >
            {selectedAsset !== "ALL" && <CurrencyIcon symbol={selectedAsset} size={18} />}
            <span>{selectedAsset}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {assetDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[120px]">
              {assetOptions.map(a => (
                <button key={a} onClick={() => { setSelectedAsset(a); setAssetDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl flex items-center gap-2 ${selectedAsset===a?"text-primary font-semibold":"text-[#1D3B53]"}`}>
                  {a !== "ALL" && <CurrencyIcon symbol={a} size={18} />}
                  <span>{a}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount Toggle */}
        <button onClick={() => setAmountOpen(!amountOpen)} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[#1D3B53] cursor-pointer">
          <span>Amount</span>
          {amountOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        <div className="ml-auto" />

        {/* Fiat Selector */}
        <div className="relative">
          <button
            onClick={() => { setFiatDropdownOpen(!fiatDropdownOpen); setAssetDropdownOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-[#1D3B53] cursor-pointer"
          >
            <span>{selectedFiat}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {fiatDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[100px]">
              {fiatOptions.map(f => (
                <button key={f} onClick={() => { setSelectedFiat(f); setFiatDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl ${selectedFiat===f?"text-primary font-semibold":"text-[#1D3B53]"}`}>{f}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Amount Filter (collapsible) */}
      {amountOpen && (
        <div className="bg-white rounded-2xl border border-primary p-5 mb-6">
          <p className="text-sm font-semibold text-[#1D3B53] mb-3">Amount</p>
          <input
            type="number"
            inputMode="decimal"
            value={filterAmount}
            onChange={e => setFilterAmount(e.target.value)}
            placeholder=""
            className="w-full border border-primary rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary mb-2"
          />
          <p className="text-xs text-gray-400 mb-4">Min. 4500</p>
          <button
            onClick={() => { setCurrentPage(1); fetchAds(1); }}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Ads */}
      <div className="space-y-4">
        {loading ? <p className="text-center text-gray-400 py-10">Loading ads...</p> : ads.length === 0 ? <p className="text-center text-gray-400 py-10">No ads available</p> :
          ads.map((ad: any, i: number) => {
            const name = ad.advertiser?.username || ad.username || "Trader";
            const badge = ad.advertiser?.badge || ad.badge || null;
            const price = parseFloat(ad.effective_price || ad.price).toLocaleString("en-US", { minimumFractionDigits: 2 });
            const adCurrency = ad.currency || selectedAsset;
            // Sell ads: limits & quantity in crypto. Buy ads: limits & quantity in fiat (NGN).
            const unitLabel = ad.type === "sell" ? adCurrency : "NGN";
            // Use available/remaining quantity from the ad; fallback to total_quantity
            const rawQty = parseFloat(String(ad.available_quantity || ad.remaining_quantity || "0"))
              || parseFloat(String(ad.total_quantity || "0"));
            const effectiveMax = rawQty > 0 ? rawQty / p2pFeeMultiplier : null;
            const limits = `${parseFloat(ad.min_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} - ${effectiveMax != null ? effectiveMax.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"} ${unitLabel}`;
            const qty = `${rawQty.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${unitLabel}`;
            return (
              <div key={i} className="bg-white rounded-2xl p-5">
                {/* Top: Advertiser + Currency badge */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{name.charAt(0)}</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#5CB85C] rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1D3B53]">{name}</p>
                      <p className="text-xs text-gray-400">{badge || "Pro Trader"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#F0F9F4] rounded-full px-3 py-1">
                    <CurrencyIcon symbol={adCurrency} size={18} />
                    <span className="text-xs font-semibold text-[#1D3B53]">{adCurrency}</span>
                  </div>
                </div>
                {/* Price */}
                <p className="text-xl font-bold text-[#1D3B53] mb-3">
                  <span className="text-xs align-top">₦</span>{price}
                </p>
                {/* Info + Button */}
                <div className="flex items-end justify-between">
                  <div className="space-y-1 text-xs text-gray-500">
                    <p>Limits: <span className="text-[#1D3B53] font-medium">{limits}</span></p>
                    <p>Quantity: <span className="text-[#1D3B53] font-medium">{qty}</span></p>
                  </div>
                  <button
                    onClick={() => requireVerification(() => router.push(`/${tradeType.toLowerCase()}-crypto?ad=${encodeURIComponent(JSON.stringify({...ad, advertiser: name}))}`))}                    className={`px-8 py-2 rounded-xl text-white text-sm font-semibold cursor-pointer transition-colors shrink-0 ${tradeType==="Buy"?"bg-[#5CB85C] hover:bg-[#4a9f4a]":"bg-[#D92D20] hover:bg-[#b82519]"}`}
                  >
                    {tradeType}
                  </button>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchAds(p); }}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg text-sm font-medium text-[#1D3B53] bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => { setCurrentPage(p); fetchAds(p); }}
              className={`w-8 h-8 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${p === currentPage ? "bg-primary text-white" : "bg-white text-[#1D3B53] hover:bg-gray-100"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchAds(p); }}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg text-sm font-medium text-[#1D3B53] bg-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      )}

      <VerificationGateModal
        visible={showGate}
        onClose={() => setShowGate(false)}
        onVerify={handleVerifyNow}
      />
    </div>
  );
}
