"use client";
import { X } from "lucide-react";

export default function ConfirmationModal({
  visible, onClose, onConfirm, title, message,
  confirmText = "Confirm", loading = false, variant = "primary",
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  loading?: boolean;
  variant?: "danger" | "primary";
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg text-[#1D3B53]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-[#8E8E93] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-primary text-primary font-bold cursor-pointer hover:bg-[#EBF4FF] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl font-bold text-white cursor-pointer disabled:opacity-50 transition-colors ${
              variant === "danger" ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
