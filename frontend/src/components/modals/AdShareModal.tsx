"use client";
import { X, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function AdShareModal({
  visible, onClose, adId, adType, asset, price, fiat,
}: {
  visible: boolean;
  onClose: () => void;
  adId: string;
  adType: string;
  asset: string;
  price: string;
  fiat: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!visible) return null;

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/p2p/ad/${adId}`;
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-lg text-[#1D3B53]">Share Ad</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Ad summary */}
        <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-4 mb-5 text-center">
          <p className="text-sm font-bold mb-1">
            <span className={adType === "Buy" ? "text-green-600" : "text-red-500"}>{adType}</span>{" "}
            <span className="text-[#1D3B53]">{asset}</span>
          </p>
          <p className="text-xs text-[#8E8E93]">Price: {price} {fiat}/{asset}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 inline-block">
            <QRCodeSVG value={url} size={160} level="M" />
          </div>
        </div>
        <p className="text-xs text-[#8E8E93] text-center mb-4">Scan to view this ad</p>

        {/* Copy link */}
        <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between mb-4">
          <span className="text-xs text-[#1D3B53] font-mono truncate mr-2">{url}</span>
          <button onClick={copy} className="text-primary shrink-0 cursor-pointer">
            {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-primary text-white py-3.5 rounded-xl font-bold cursor-pointer hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
