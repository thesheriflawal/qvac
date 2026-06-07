"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { p2pService } from "@/services/p2p.service";

export default function AdLandingPage() {
  const router = useRouter();
  const { adId } = useParams<{ adId: string }>();

  useEffect(() => {
    if (!adId) { router.replace("/p2p"); return; }
    p2pService.getAdById(adId)
      .then(res => {
        const ad = res?.data || res;
        if (!ad?.id) { router.replace("/p2p"); return; }
        const adType = (ad.type || "sell").toLowerCase();
        const page = adType === "sell" ? "buy-crypto" : "sell-crypto";
        router.replace(`/${page}?ad=${encodeURIComponent(JSON.stringify(ad))}`);
      })
      .catch(() => router.replace("/p2p"));
  }, [adId]);

  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
