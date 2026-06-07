"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { p2pService } from "@/services/p2p.service";
import { SlidersHorizontal, FolderOpen, Copy, CheckCircle2, X, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function OrdersPage() {
  const router = useRouter();
  const [topTab, setTopTab] = useState<"Completed" | "Failed">("Completed");
  const [filterType, setFilterType] = useState<"All" | "Buy" | "Sell">("All");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [modalCopied, setModalCopied] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await p2pService.getOrders({ page_size: 100 });
      const mapped = (res.data || []).map((o: any) => ({
        id: o.id.toString(), type: o.side === "buy" ? "Buy" : "Sell", asset: o.currency,
        amount: `${(o.total ?? 0).toLocaleString()} NGN`,
        price: `${(o.price ?? 0).toLocaleString()} NGN`,
        quantity: `${o.amount} ${o.currency}`,
        orderNo: o.order_number,
        date: new Date(o.created_at).toLocaleString(),
        status: o.status, raw: o,
      }));
      setOrders(mapped);
    } catch {} finally { setLoading(false); }
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = orders.filter(o => {
    const matchStatus = topTab === "Completed"
      ? o.status === "completed"
      : ["cancelled", "disputed", "failed"].includes(o.status);
    const matchType = filterType === "All" || o.type === filterType;
    return matchStatus && matchType;
  });

  return (
    <div className="w-full pb-10">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs text-[#8E8E93] mb-2">Orders</p>
      </div>

      {/* Top tabs — underline style */}
      <div className="flex border-b border-[#E5E7EB] mb-4">
        {(["Completed", "Failed"] as const).map(t => (
          <button key={t} onClick={() => setTopTab(t)}
            className={`mr-6 pb-2.5 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${topTab === t ? "border-primary text-primary" : "border-transparent text-gray-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Sub filters */}
      <div className="flex gap-2 mb-5">
        {(["All", "Buy", "Sell"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-5 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all ${filterType === t ? "bg-[#EBF4FF] border-primary text-primary" : "bg-white border-[#E5E7EB] text-[#8E8E93]"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-20 h-20 rounded-full bg-[#F0F9FF] flex items-center justify-center mb-4">
            <FolderOpen size={40} className="text-primary" />
          </div>
          <p className="text-[#1D3B53] font-medium">No Records Found!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(o => (
            <div key={o.id}
              onClick={() => setSelectedOrder(o)}
              className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-shadow">
              {/* Type + Status */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-bold text-[#1D3B53]">
                  <span className={o.type === "Buy" ? "text-[#10B981]" : "text-[#EF4444]"}>{o.type}</span>{" "}{o.asset}
                </p>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${o.status === "completed" ? "bg-[#D1FAE5] text-[#10B981]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                  {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                {[
                  ["Amount", o.amount, true],
                  ["Price", o.price, false],
                  ["Quantity", o.quantity, false],
                  ["Order No.", o.orderNo, false, true],
                  ["Order Time", o.date, false],
                ].map(([label, value, bold, copyable]) => (
                  <div key={label as string} className="flex justify-between items-center">
                    <span className="text-[#9CA3AF] text-xs">{label}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs ${bold ? "font-bold text-[#1D3B53]" : "font-medium text-[#4B5563]"}`}>{value}</span>
                      {copyable && value && (
                        <button onClick={e => { e.stopPropagation(); copy(value as string, o.id); }} className="cursor-pointer">
                          {copied === o.id
                            ? <CheckCircle2 size={12} className="text-green-500" />
                            : <Copy size={12} className="text-[#8E8E93]" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Order Detail Modal */}
      {selectedOrder && (() => {
        const o = selectedOrder;
        const isBuy = o.type === "Buy";
        const raw = o.raw || {};
        const takerFee = raw?.taker_fee_amount;
        const takerFeeCurrency = raw?.taker_fee_currency || o.asset || "";
        const makerFee = raw?.maker_fee_amount;
        const makerFeeCurrency = raw?.maker_fee_currency || o.asset || "";
        const feeDisplay = takerFee != null && parseFloat(takerFee) > 0
          ? `${takerFee} ${takerFeeCurrency}`
          : makerFee != null && parseFloat(makerFee) > 0
          ? `${makerFee} ${makerFeeCurrency}`
          : "Free";
        const counterpartyName = raw?.counterparty?.name || raw?.advertiser_name || null;

        const copyOrderNo = async () => {
          if (!o.orderNo) return;
          await navigator.clipboard.writeText(o.orderNo);
          setModalCopied(true);
          setTimeout(() => setModalCopied(false), 2000);
        };

        const rows = [
          { label: "Amount:", value: o.amount || "0.00" },
          { label: "Price:", value: o.price || "0.00" },
          { label: "Fee:", value: feeDisplay },
          { label: "total Quantity:", value: o.quantity || "0.00" },
          { label: "Order No.:", value: o.orderNo || "N/A", copyable: true },
          { label: "Order Time:", value: o.date || "N/A" },
        ];

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-[#5CB85C] leading-tight">
                  Your {o.type} Order Has been {o.status === "failed" ? "Failed" : "Completed"}
                </h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-2">
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-[#8E8E93] leading-relaxed mb-5">
                Your transaction has been successfully processed, and the corresponding crypto and/or fiat funds have
                been transferred to the respective wallets or accounts. You can view the full details in your transaction history.
              </p>

              {/* Counterparty */}
              {counterpartyName && (
                <div className="flex items-center justify-between bg-[#F7F9FC] rounded-xl px-4 py-3 mb-5">
                  <span className="text-sm font-semibold text-[#1D3B53]">{counterpartyName}</span>
                  <button className="text-xs text-primary font-medium cursor-pointer hover:underline">View Profile</button>
                </div>
              )}

              <h4 className="font-bold text-sm text-[#1D3B53] mb-3">Order Details</h4>
              <div className="bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl p-4 space-y-0 text-sm mb-5">
                {/* Type row */}
                <div className="flex items-center gap-2 pb-3">
                  {isBuy
                    ? <ArrowDownCircle size={16} className="text-[#5CB85C]" />
                    : <ArrowUpCircle size={16} className="text-[#D92D20]" />}
                  <span className={`font-bold ${isBuy ? "text-[#5CB85C]" : "text-[#D92D20]"}`}>{o.type}</span>
                  <span className="font-bold text-[#1D3B53]">{o.asset}</span>
                </div>

                {rows.map((row, i) => (
                  <div key={i}>
                    <div className="h-px bg-[#E2E8F0]" />
                    <div className="flex justify-between items-center py-3">
                      <span className="text-[#8E8E93]">{row.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[#1D3B53]">{row.value}</span>
                        {row.copyable && o.orderNo && (
                          <button onClick={copyOrderNo} className="cursor-pointer text-gray-400 hover:text-primary">
                            {modalCopied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => { setSelectedOrder(null); router.push("/wallet"); }} className="w-full bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer hover:bg-primary/90 transition-colors mb-3">
                Go to wallet
              </button>
              <button onClick={() => { setSelectedOrder(null); router.push("/support"); }} className="w-full py-3 text-center text-sm text-[#1D3B53] font-semibold cursor-pointer hover:underline">
                Order Dispute?
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
