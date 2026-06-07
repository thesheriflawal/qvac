"use client";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const ICONS = {
  success: { Icon: CheckCircle2, bg: "bg-green-100",  color: "text-green-500"  },
  error:   { Icon: XCircle,      bg: "bg-red-100",    color: "text-red-500"    },
  warning: { Icon: AlertCircle,  bg: "bg-yellow-100", color: "text-yellow-500" },
};

export default function StatusModal({
  visible, onClose, type, title, message,
  buttonText = "Done", onButtonClick,
}: {
  visible: boolean;
  onClose: () => void;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  buttonText?: string;
  onButtonClick?: () => void;
}) {
  if (!visible) return null;
  const { Icon, bg, color } = ICONS[type];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
        <div className={`w-16 h-16 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon size={32} className={color} />
        </div>
        <h3 className="font-bold text-lg text-[#1D3B53] mb-2">{title}</h3>
        <p className="text-sm text-[#8E8E93] mb-6">{message}</p>
        <button
          onClick={onButtonClick || onClose}
          className="w-full bg-primary text-white py-3.5 rounded-xl font-bold cursor-pointer hover:bg-primary/90 transition-colors"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
