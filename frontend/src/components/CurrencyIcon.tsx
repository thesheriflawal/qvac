"use client";
import Image from "next/image";

const CURRENCY_META: Record<string, { color: string; label: string }> = {
  BTC: { color: "#F7931A", label: "₿" },
  ETH: { color: "#627EEA", label: "Ξ" },
  USDT: { color: "#26A17B", label: "₮" },
  USDC: { color: "#2775CA", label: "$" },
  SOL: { color: "#9945FF", label: "S" },
  TRX: { color: "#FF0013", label: "T" },
  XRP: { color: "#23292F", label: "X" },
  BNB: { color: "#F3BA2F", label: "B" },
  TON: { color: "#0098EA", label: "T" },
  NGN: { color: "#008751", label: "₦" },
  USD: { color: "#85bb65", label: "$" },
  EUR: { color: "#003399", label: "€" },
  GBP: { color: "#C8102E", label: "£" },
};

const ICON_IMAGES: Record<string, string> = {
  BTC: "/assets/icons/btc.svg",
  ETH: "/assets/icons/eth.svg",
  USDT: "/assets/icons/usdt.svg",
  USDC: "/usdc-logo.png",
  SOL: "/assets/icons/sol.svg",
  EUR: "/assets/icons/eur.svg",
  GBP: "/assets/icons/gbp.svg",
  NGN: "/ngn-icon.png",
};

export default function CurrencyIcon({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const upper = (symbol || "").toUpperCase();
  const meta = CURRENCY_META[upper] || { color: "#8E8E93", label: upper.charAt(0) || "?" };
  const imgSrc = ICON_IMAGES[upper];

  if (imgSrc) {
    return (
      <div
        className="rounded-full overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image src={imgSrc} alt={upper} width={size} height={size} className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: meta.color, fontSize: size * 0.4 }}
    >
      {meta.label}
    </div>
  );
}
