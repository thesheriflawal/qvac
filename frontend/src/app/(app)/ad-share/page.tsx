"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, CheckCircle2, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAds } from "@/context/AdsContext";
import { useAuth } from "@/context/AuthContext";
import { walletService } from "@/services/wallet.service";

function AdShareContent() {
  const router = useRouter();
  const params = useSearchParams();
  const ad = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : {};
  const [copied, setCopied] = useState(false);
  const { currencies } = useAds();
  const { user } = useAuth();
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const asset = ad.asset || ad.currency || "USDT";
  const isRelative = ad.priceType === "Relative" || ad.price_type === "relative";
  const relativePercent = parseFloat(ad.relativePercent || ad.relative_percent || "0");

  useEffect(() => {
    if (!isRelative || !asset) return;
    fetch(`/api/market-price?symbol=${asset.toUpperCase()}`)
      .then(r => r.json())
      .then(data => {
        const p = parseFloat(data?.price || "0");
        if (p > 0) setLivePrice(p);
      })
      .catch(() => {});
  }, [isRelative, asset]);

  const advertiser = ad.advertiser || ad.username
    || (user as any)?.username
    || (user as any)?.first_name
    || "Trader";

  const displayPrice = (() => {
    if (isRelative) {
      if (livePrice) return (livePrice + relativePercent).toLocaleString("en-NG", { minimumFractionDigits: 2 });
      const sign = relativePercent >= 0 ? "+" : "";
      return `Market ${sign}${relativePercent} NGN`;
    }
    const p = parseFloat(ad.price || "0");
    return p > 0 ? p.toLocaleString("en-NG", { minimumFractionDigits: 2 }) : "—";
  })();

  const priceIsNumeric = isRelative ? !!livePrice : parseFloat(ad.price || "0") > 0;
  const adType = (ad.type || "Buy").toLowerCase();
  const tradeAction = adType === "sell" ? "Buy" : "Sell";
  const isBuy = tradeAction === "Buy";
  const minLimit = ad.minLimit || ad.min_amount ? parseFloat(ad.minLimit || ad.min_amount).toLocaleString() : "—";
  const maxLimit = (ad.remainingQuantity || ad.remaining_quantity || ad.totalQuantity || ad.total_quantity)
    ? parseFloat(ad.remainingQuantity || ad.remaining_quantity || ad.totalQuantity || ad.total_quantity).toLocaleString()
    : "—";

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/p2p/ad/${ad.id}`
    : `/p2p/ad/${ad.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${tradeAction} ${asset} on Kynettic`,
        text: `${advertiser} is ${adType === "sell" ? "selling" : "buying"} ${asset} at ₦${displayPrice}. Click to trade directly.`,
        url: shareUrl,
      });
    } else {
      copyLink();
    }
  };

  return (
    <div className="bg-white flex flex-col -mx-4 md:-mx-6 -mt-6 pb-8">
      {/* Blue Header — avatar lives inside so no clipping */}
      <div className="bg-primary pt-4 pb-8 px-5 flex flex-col items-center rounded-b-3xl">
        <div className="flex items-center justify-between w-full mb-4">
          <button onClick={() => router.push("/my-ads")} className="text-white cursor-pointer p-1">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span className="font-bold text-white text-base">Share Ad</span>
          <div className="w-8" />
        </div>
        {/* Avatar inside header — no overlap, no clipping */}
        <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center shadow-md mb-2">
          <span className="text-2xl font-bold text-white">{advertiser.charAt(0).toUpperCase()}</span>
        </div>
        <p className="text-white font-bold text-base">{advertiser}</p>
        <span className={`text-xs font-semibold px-3 py-0.5 rounded-full mt-1 ${isBuy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
          {tradeAction} {asset}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center px-5 pt-5 gap-4">
        {/* QR Code */}
        <div className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col items-center">
          <QRCodeSVG value={shareUrl} size={150} />
          <p className="text-xs text-[#8E8E93] mt-2">Scan to open this ad</p>
        </div>

        {/* Details */}
        <div className="w-full bg-[#F9FAFB] rounded-2xl px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Price</span>
            <span className="font-semibold text-[#1D3B53]">{priceIsNumeric ? "₦" : ""}{displayPrice} / {asset}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Action</span>
            <span className={`font-semibold ${isBuy ? "text-green-600" : "text-red-500"}`}>{tradeAction} {asset}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8E8E93]">Limits</span>
            <span className="font-semibold text-[#1D3B53]">₦{minLimit} – ₦{maxLimit}</span>
          </div>
        </div>

        {/* Shareable link */}
        <div className="w-full">
          <p className="text-xs text-gray-400 mb-1.5">Shareable link</p>
          <div className="flex items-center gap-2 bg-[#F0F4F8] rounded-xl px-3 py-2.5">
            <p className="flex-1 text-xs text-primary truncate">{shareUrl}</p>
            <button onClick={copyLink} className="shrink-0 cursor-pointer">
              {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-400 hover:text-primary" />}
            </button>
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={nativeShare}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer hover:bg-primary/90"
        >
          <Share2 size={16} /> Share Ad
        </button>
      </div>
    </div>
  );
}

export default function AdSharePage() {
  return <Suspense><AdShareContent /></Suspense>;
}
