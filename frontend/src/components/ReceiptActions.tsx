"use client";
import { useState } from "react";
import { Share2, Download, ImageIcon, FileText, Loader2 } from "lucide-react";

interface Props {
  onDownloadImage: () => Promise<void>;
  onDownloadPDF: () => Promise<void>;
  onShare: () => Promise<void>;
  working: boolean;
}

export default function ReceiptActions({ onDownloadImage, onDownloadPDF, onShare, working }: Props) {
  const [downloadOpen, setDownloadOpen] = useState(false);

  const handle = (fn: () => Promise<void>) => async () => {
    setDownloadOpen(false);
    await fn();
  };

  return (
    <div className="flex gap-2 relative">
      {/* Share */}
      <button
        onClick={handle(onShare)}
        disabled={working}
        className="flex items-center gap-2 flex-1 justify-center py-3 rounded-xl bg-[#EBF4FF] text-primary font-semibold text-sm cursor-pointer disabled:opacity-50"
      >
        {working ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
        Share
      </button>

      {/* Download dropdown */}
      <div className="relative flex-1">
        <button
          onClick={() => setDownloadOpen(!downloadOpen)}
          disabled={working}
          className="flex items-center gap-2 w-full justify-center py-3 rounded-xl bg-[#EBF4FF] text-primary font-semibold text-sm cursor-pointer disabled:opacity-50"
        >
          {working ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Download
        </button>
        {downloadOpen && (
          <div className="absolute bottom-full mb-2 right-0 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10">
            <button
              onClick={handle(onDownloadImage)}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#1D3B53] hover:bg-gray-50 cursor-pointer border-b border-gray-100"
            >
              <ImageIcon size={16} className="text-primary" /> Save as Image
            </button>
            <button
              onClick={handle(onDownloadPDF)}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-[#1D3B53] hover:bg-gray-50 cursor-pointer"
            >
              <FileText size={16} className="text-primary" /> Save as PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
