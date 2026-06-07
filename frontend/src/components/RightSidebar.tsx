"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { p2pService } from "@/services/p2p.service";
import { useVerificationGate } from "@/hooks/useVerificationGate";

const PLATFORM_ICONS: Record<string, string> = {
  telegram:  "https://cdn.simpleicons.org/telegram/229ED9",
  whatsapp:  "https://cdn.simpleicons.org/whatsapp/25D366",
  twitter:   "https://cdn.simpleicons.org/x/000000",
  x:         "https://cdn.simpleicons.org/x/000000",
  instagram: "https://cdn.simpleicons.org/instagram/E1306C",
  discord:   "https://cdn.simpleicons.org/discord/5865F2",
  facebook:  "https://cdn.simpleicons.org/facebook/1877F2",
  youtube:   "https://cdn.simpleicons.org/youtube/FF0000",
};

const CARDS = [
  { title: "Click here to Buy Bulk Coins", desc: "Purchase large coin amounts directly from us.", href: "/bulk-coins-purchase", bg: "bg-gradient-to-br from-[#4472B7] to-[#2d5a9e]", image: "/crypto-tokens.png" },
  { title: "P2P Trading", desc: "Buy and sell crypto automatically on the P2P market. Fast and secured.", href: "/p2p", bg: "bg-gradient-to-br from-[#4472B7] to-[#355f9e]", image: "/bannerImg.png" },
];

export default function RightSidebar({ children }: { children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [communityLinks, setCommunityLinks] = useState<any[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [noVerification, setNoVerification] = useState(false);
  const [sortBy, setSortBy] = useState("overall");
  const { isVerified, requireVerification } = useVerificationGate();

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % CARDS.length), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    p2pService.getCommunityLinks()
      .then(res => setCommunityLinks(res?.data || []))
      .catch(() => {});
  }, []);

  const c = CARDS[i];

  return (
    <aside className="w-[320px] shrink-0 hidden xl:block">
      <div className="sticky top-6 space-y-4 bg-[#DAE3F1] p-5 rounded-2xl">
        {children}

        {/* Filter Panel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <SlidersHorizontal size={16} className="text-primary" />
            <span className="font-bold text-[#1D3B53] text-sm">Filter</span>
          </div>

          {/* Ad Types */}
          <p className="text-xs font-semibold text-[#1D3B53] mb-3">Ad Types</p>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={() => setVerifiedOnly(!verifiedOnly)}
              className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
            />
            <span className="text-xs text-[#1D3B53]">Show Only Verified Advertisers</span>
          </label>
          <label className="flex items-center gap-2 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={noVerification}
              onChange={() => setNoVerification(!noVerification)}
              className="w-4 h-4 rounded border-gray-300 text-primary accent-primary cursor-pointer"
            />
            <span className="text-xs text-[#1D3B53]">Ads with No Verification Required</span>
          </label>

          {/* Sort By */}
          <p className="text-xs font-semibold text-[#1D3B53] mb-3">Sort By</p>
          {[
            { value: "overall", label: "Overall Sorting" },
            { value: "completed", label: "Completed Order Number" },
            { value: "price", label: "Price (lowest to highest)" },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="radio"
                name="sortBy"
                checked={sortBy === opt.value}
                onChange={() => setSortBy(opt.value)}
                className="w-4 h-4 text-primary accent-primary cursor-pointer"
              />
              <span className="text-xs text-[#1D3B53]">{opt.label}</span>
            </label>
          ))}

          {/* Reset / Apply */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setVerifiedOnly(true); setNoVerification(false); setSortBy("overall"); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[#1D3B53] text-xs font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Rotating promo card */}
        <div className={`${c.bg} rounded-2xl p-6 text-white text-center`}>
          <div className="w-32 h-32 mx-auto mb-4">
            <img src={c.image} alt="" className="w-full h-full object-contain" />
          </div>
          <h3 className="font-bold text-lg mb-2">{c.title}</h3>
          <p className="text-white/80 text-sm mb-4">{c.desc}</p>
          <button 
            onClick={() => requireVerification(() => window.location.href = c.href)}
            className={`inline-flex items-center gap-1 bg-white text-gray-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-100 cursor-pointer ${!isVerified && c.href === "/p2p" ? "opacity-70" : ""}`}
          >
            {c.title.includes("Bulk") ? "Click Here" : "P2P Trading"} &rsaquo;
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5">
          {CARDS.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} className={`w-2 h-2 rounded-full cursor-pointer ${idx === i ? "bg-primary" : "bg-gray-300"}`} />
          ))}
        </div>

        {/* Community links strip */}
        {communityLinks.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[#1D3B53] shrink-0">Join our community:</span>
            {communityLinks.map((link: any) => {
              const platform = (link.platform || "").toLowerCase();
              const iconUrl = PLATFORM_ICONS[platform];
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label || link.platform}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer shrink-0"
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={platform} className="w-4 h-4 object-contain" />
                  ) : null}
                  {link.label || link.platform}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
