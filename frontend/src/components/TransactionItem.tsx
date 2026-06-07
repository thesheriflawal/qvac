import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
export default function TransactionItem({ type, asset, amount, date, status }: { type: string; asset: string; amount: string; date: string; status: string }) {
  const isReceive = type.toLowerCase().includes("receive") || type.toLowerCase().includes("deposit");
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isReceive ? "bg-green-100" : "bg-red-100"}`}>
          {isReceive ? <ArrowDownLeft size={16} className="text-green-600"/> : <ArrowUpRight size={16} className="text-red-500"/>}
        </div>
        <div><p className="text-sm font-semibold">{type} {asset}</p><p className="text-xs text-gray-400">{date}</p></div>
      </div>
      <div className="text-right"><p className="text-sm font-semibold">{amount}</p><p className={`text-xs ${status === "confirmed" || status === "completed" ? "text-green-500" : status === "failed" ? "text-red-500" : "text-yellow-500"}`}>{status}</p></div>
    </div>
  );
}
