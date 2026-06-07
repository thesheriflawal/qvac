"use client";
import { X, ShieldAlert } from "lucide-react";
export default function VerificationGateModal({ visible, onClose, onVerify }: { visible: boolean; onClose: () => void; onVerify: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 cursor-pointer"><X size={20}/></button>
        <ShieldAlert size={48} className="text-primary mx-auto mb-4"/>
        <h3 className="font-bold text-lg mb-2">Verification Required</h3>
        <p className="text-sm text-gray-500 mb-6">Complete identity verification to access this feature.</p>
        <button onClick={onVerify} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer hover:bg-primary/90">Verify Now</button>
      </div>
    </div>
  );
}
