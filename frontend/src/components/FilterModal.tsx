"use client";
import { X } from "lucide-react";
import { useState } from "react";
export default function FilterModal({ visible, onClose, onApply }: { visible: boolean; onClose: () => void; onApply: (f: Record<string,string>) => void }) {
  const [type, setType] = useState("all"); const [period, setPeriod] = useState("all");
  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Filters</h3><button onClick={onClose} className="text-gray-400 cursor-pointer"><X size={20}/></button></div>
        <label className="text-sm text-gray-500 block mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 mb-4 text-sm">{["all","deposit","withdrawal","trade"].map(t=><option key={t} value={t}>{t}</option>)}</select>
        <label className="text-sm text-gray-500 block mb-1">Period</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 mb-6 text-sm">{["all","today","week","month"].map(t=><option key={t} value={t}>{t}</option>)}</select>
        <div className="flex gap-3">
          <button onClick={() => { setType("all"); setPeriod("all"); }} className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold cursor-pointer">Reset</button>
          <button onClick={() => { onApply({ type, period }); onClose(); }} className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold cursor-pointer">Apply</button>
        </div>
      </div>
    </div>
  );
}
