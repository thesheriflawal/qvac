"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Check, RefreshCw, AlertCircle } from "lucide-react";
import { useAds } from "@/context/AdsContext";
import { useWallet } from "@/context/WalletContext";
import { p2pService } from "@/services/p2p.service";
import { walletService } from "@/services/wallet.service";
import { getErrorMessage } from "@/utils/errorHandler";
import StatusModal from "@/components/modals/StatusModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import { useRequirePin } from "@/hooks/useRequirePin";
import ConfirmationModal from "@/components/modals/ConfirmationModal";

function Content() {
  const router = useRouter();
  const requirePin = useRequirePin();
  const params = useSearchParams();
  const editData = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : null;
  const { refreshAds, currencies: ctxCurrencies, refreshCurrencies, ads: allAds, makerFeePercent, takerFeePercent } = useAds();
  const { getWalletByCurrency, fetchWallets } = useWallet();

  const cryptoCurrencies = ctxCurrencies.filter(c => c.type === "crypto");
  const fiatCurrencies = ctxCurrencies.filter(c => c.type === "fiat");

  const [type, setType] = useState<"Buy" | "Sell">(editData?.type || "Buy");
  const [asset, setAsset] = useState(editData?.asset || "USDT");
  const [currencyId, setCurrencyId] = useState<string>(editData?.currencyId || "");
  const [fiat, setFiat] = useState(editData?.fiat || "NGN");
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [fiatDropdown, setFiatDropdown] = useState(false);

  const [priceType, setPriceType] = useState<"Fixed" | "Relative">(editData?.priceType === "Relative" ? "Relative" : "Fixed");
  const [price, setPrice] = useState(editData?.priceType !== "Relative" ? (editData?.price?.toString() || "") : "");
  const [sign, setSign] = useState<string>(() => {
    if (editData?.priceType === "Relative" && editData?.relativePercent) {
      return parseFloat(editData.relativePercent) < 0 ? "-" : "+";
    }
    return "+";
  });
  const [relativeAmount, setRelativeAmount] = useState<string>(() => {
    if (editData?.priceType === "Relative" && editData?.relativePercent) {
      return Math.abs(parseFloat(editData.relativePercent)).toString();
    }
    return "";
  });
  const [signDropdown, setSignDropdown] = useState(false);

  const [totalQuantity, setTotalQuantity] = useState(
    // Use remainingQuantity when editing — it reflects what's actually in the ad after any trades
    editData?.id
      ? (editData?.remainingQuantity?.toString() || editData?.totalQuantity?.toString() || "")
      : ""
  );
  const [minLimit, setMinLimit] = useState(editData?.minLimit?.toString() || "");
  const [rolloverEnabled, setRolloverEnabled] = useState(editData?.rolloverEnabled || false);
  const [active, setActive] = useState(editData?.active ?? true);

  const [referencePrice, setReferencePrice] = useState("0.00");
  const [refLoading, setRefLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [rolloverModal, setRolloverModal] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [statusModal, setStatusModal] = useState<{ visible: boolean; type: "success" | "error"; title: string; message: string }>({ visible: false, type: "success", title: "", message: "" });

  const isBuy = type === "Buy";
  // Buy ads: all amounts in fiat (NGN). Sell ads: total_quantity in crypto, limits in crypto.
  const targetCurrency = isBuy ? "NGN" : asset;
  const targetWallet = getWalletByCurrency(targetCurrency);
  const walletTotal = parseFloat(String(targetWallet?.balance || 0));

  // Compute how much OTHER active ads lock for this currency (exclude the ad being edited)
  const otherAdsLocked = allAds
    .filter(a => a.active && !a.rolloverEnabled && a.id !== (editData?.id?.toString()))
    .reduce((sum, a) => {
      const adCurrency = (a.type === "Sell" ? a.asset : a.fiat).toUpperCase();
      if (adCurrency !== targetCurrency.toUpperCase()) return sum;
      const qty = parseFloat(a.remainingQuantity || "0") || parseFloat(a.totalQuantity || "0");
      return sum + qty;
    }, 0);

  // Available = total wallet balance minus what OTHER ads have locked
  const balance = Math.max(0, walletTotal - otherAdsLocked);

  // Auto-select currency ID when asset changes
  useEffect(() => {
    if (cryptoCurrencies.length > 0) {
      const match = cryptoCurrencies.find(c => c.code === asset);
      if (match && match.id !== currencyId) setCurrencyId(match.id);
    }
  }, [cryptoCurrencies, asset]);

  // Fetch reference price
  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setRefLoading(true);
    fetch(`/api/market-price?symbol=${asset}`)
      .then(r => r.json())
      .then(data => { if (!cancelled && data?.price) setReferencePrice(data.price); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRefLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  // Compute effective rate for relative pricing
  const effectiveRate = (() => {
    const ref = parseFloat(referencePrice);
    const adj = parseFloat(relativeAmount || "0");
    if (isNaN(ref) || ref === 0 || isNaN(adj)) return null;
    const result = sign === "-" ? ref - adj : ref + adj;
    return result > 0 ? result.toFixed(2) : null;
  })();

  const handleTotalMax = () => setTotalQuantity(balance.toString());
  const handleSingleMin = () => setMinLimit(isBuy ? "1000" : "1");

  const handleRolloverToggle = (val: boolean) => {
    if (val) setRolloverModal(true);
    else setRolloverEnabled(false);
  };

  const handlePublishClick = () => {
    if (!price && priceType === "Fixed") { setStatusModal({ visible: true, type: "error", title: "Error", message: "Please enter a price" }); return; }
    if (priceType === "Relative") {
      if (!relativeAmount) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Please enter a relative amount" }); return; }
      if (parseFloat(relativeAmount) === 0) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Relative amount must be greater than 0" }); return; }
    }
    if (!rolloverEnabled && !totalQuantity) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Please enter a total quantity" }); return; }
    if (!minLimit) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Please enter a min limit" }); return; }
    if (parseFloat(minLimit) <= 0) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Min limit must be positive" }); return; }
    if (!rolloverEnabled && parseFloat(totalQuantity) <= 0) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Total quantity must be positive" }); return; }
    setPublishConfirm(true);
  };

  const handlePin = async (pin: string) => {
    setPinModal(false);
    setLoading(true);
    try {
      const apiType = type.toLowerCase() as "buy" | "sell";
      const apiPriceType = priceType === "Fixed" ? "fixed" : "relative";

      if (editData?.id) {
        // max_amount: for non-rollover = total_quantity; for rollover = creator's available balance
        const derivedMax = rolloverEnabled ? balance.toFixed(isBuy ? 2 : 8) : (totalQuantity || balance.toFixed(isBuy ? 2 : 8));
        const updateData: any = {
          price_type: apiPriceType,
          min_amount: minLimit,
          max_amount: derivedMax,
          is_private: !active,
          status: active ? "active" : "paused",
          pin,
        };
        // Rollover ads must NOT include total_quantity — backend rejects it
        if (!rolloverEnabled && totalQuantity) updateData.total_quantity = totalQuantity;
        // Pricing fields are mutually exclusive — never send both
        if (apiPriceType === "relative") {
          updateData.price_offset = sign === "-" ? `-${relativeAmount}` : relativeAmount;
          delete updateData.price; // ensure no stale price leaks in
        } else {
          updateData.price = price;
          delete updateData.price_offset;
        }
        console.log("[updateAd] payload:", JSON.stringify(updateData, null, 2));
        await p2pService.updateAd(editData.id.toString(), updateData);
      } else {
        let finalCurrencyId = currencyId;
        if (!finalCurrencyId) {
          const match = cryptoCurrencies.find(c => c.code === asset);
          if (match) { finalCurrencyId = match.id; setCurrencyId(match.id); }
        }
        if (!finalCurrencyId) { setStatusModal({ visible: true, type: "error", title: "Error", message: "Could not resolve currency." }); setLoading(false); return; }

        // max_amount: for non-rollover = total_quantity; for rollover = creator's available balance
        const derivedMax = rolloverEnabled ? balance.toFixed(isBuy ? 2 : 8) : (totalQuantity || balance.toFixed(isBuy ? 2 : 8));
        const adData: any = {
          currency_id: finalCurrencyId.toString(),
          type: apiType,
          price_type: apiPriceType,
          min_amount: minLimit,
          max_amount: derivedMax,
          is_private: !active,
          rollover_enabled: rolloverEnabled,
          pin,
        };
        // Rollover ads use wallet balance dynamically — total_quantity must not be sent
        if (!rolloverEnabled && totalQuantity) adData.total_quantity = totalQuantity;
        // Pricing fields are mutually exclusive — never send both
        if (apiPriceType === "relative") {
          adData.price_offset = sign === "-" ? `-${relativeAmount}` : relativeAmount;
          delete adData.price;
        } else {
          adData.price = price;
          delete adData.price_offset;
        }
        console.log("[createAd] payload:", JSON.stringify(adData, null, 2));
        await p2pService.createAd(adData);
      }
      await Promise.all([refreshAds(), fetchWallets()]);
      setStatusModal({ visible: true, type: "success", title: editData ? "Ad Updated" : "Ad Published", message: editData ? "Your ad has been updated." : "Your ad is now live on the platform." });
    } catch (e: any) {
      console.error("[postAd] error:", e?.response?.status, JSON.stringify(e?.response?.data, null, 2), e);
      setStatusModal({ visible: true, type: "error", title: "Error", message: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !statusModal.visible) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="w-full max-w-xl pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/my-ads")} className="p-1 cursor-pointer"><ArrowLeft size={20} className="text-[#1D3B53]" /></button>
          <h1 className="text-lg font-bold text-[#1D3B53]">{editData ? "Edit Ad" : "Post My Ads"}</h1>
        </div>
        <button onClick={() => { setLoading(true); refreshCurrencies().finally(() => setLoading(false)); }} className="p-1 cursor-pointer"><RefreshCw size={18} className="text-[#1D3B53]" /></button>
      </div>

      {/* Buy/Sell Tabs */}
      <div className="flex gap-3 mb-5">
        {(["Buy", "Sell"] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`flex-1 py-3 rounded-full text-sm font-semibold cursor-pointer border transition-all ${type === t ? "bg-[#EBF4FF] border-primary text-primary" : "bg-[#F0F5FF] border-gray-200 text-[#1D3B53]"}`}>
            I want to {t.toLowerCase()}
          </button>
        ))}
      </div>

      {/* Coins & Fiat Dropdowns */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <label className="text-sm text-gray-500 block mb-1">Coins</label>
          <button onClick={() => { setAssetDropdown(!assetDropdown); setFiatDropdown(false); }}
            className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 text-sm text-[#1D3B53] cursor-pointer">
            <span>{asset}</span><ChevronDown size={14} />
          </button>
          {assetDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
              {cryptoCurrencies.length > 0 ? cryptoCurrencies.map(c => (
                <button key={c.id} onClick={() => { setAsset(c.code); setCurrencyId(c.id); setAssetDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl">{c.code}</button>
              )) : <p className="px-4 py-2.5 text-sm text-gray-400">Loading...</p>}
            </div>
          )}
        </div>
        <div className="flex-1 relative">
          <label className="text-sm text-gray-500 block mb-1">Fiat</label>
          <button onClick={() => { if (fiatCurrencies.length > 0) { setFiatDropdown(!fiatDropdown); setAssetDropdown(false); } }}
            className={`w-full flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 text-sm text-[#1D3B53] cursor-pointer ${fiatCurrencies.length === 0 ? "bg-gray-50" : ""}`}>
            <span>{fiat}</span><ChevronDown size={14} />
          </button>
          {fiatDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
              {fiatCurrencies.map(c => (
                <button key={c.id} onClick={() => { setFiat(c.code); setFiatDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl">{c.code}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fee Notice */}
      <div className="bg-[#FFF9E6] rounded-lg p-3 mb-5">
        <p className="text-xs text-[#F5A623]">Maker fee (you): {makerFeePercent}% · Taker fee: {takerFeePercent}% — deducted automatically on each completed trade.</p>
      </div>

      {/* Pricing Settings */}
      <p className="text-sm font-semibold text-[#1D3B53] mb-3">Pricing Settings</p>
      <div className="flex gap-3 mb-4">
        {(["Fixed", "Relative"] as const).map(t => (
          <button key={t} onClick={() => { setPriceType(t); if (t === "Relative") setPrice(""); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium cursor-pointer transition-all ${priceType === t ? "border-primary bg-[#F0F5FF] text-primary" : "border-gray-300 text-gray-500"}`}>
            {priceType === t && <Check size={14} />}
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[#EBF4FF] rounded-lg p-4 mb-4">
        <p className="text-xs text-primary leading-relaxed">
          {priceType === "Fixed"
            ? "You can set a constant rate for your ad. Your price remains the same regardless of market fluctuations."
            : "Link your price to the market rate. Your rate automatically adjusts by a set amount (+/-) based on current market movements."}
        </p>
      </div>

      {priceType === "Fixed" ? (
        <div className="flex items-center border border-gray-300 rounded-lg px-4 h-12 mb-2">
          <input type="number" placeholder="Enter your fixed price" value={price} onChange={e => setPrice(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            className="min-w-0 flex-1 bg-transparent outline-none text-sm text-[#1D3B53]" />
          <span className="text-sm font-bold text-[#1D3B53]">{fiat}</span>
        </div>
      ) : (
        <div className="flex gap-2 mb-2 relative">
          <div className="relative">
            <button onClick={() => setSignDropdown(!signDropdown)}
              className="flex items-center justify-center gap-1 w-16 h-12 border border-gray-300 rounded-lg text-[#1D3B53] font-bold cursor-pointer">
              {sign}<ChevronDown size={12} />
            </button>
            {signDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-16">
                {["+", "-"].map(s => (
                  <button key={s} onClick={() => { setSign(s); setSignDropdown(false); }}
                    className="w-full py-2 text-center font-bold text-[#1D3B53] hover:bg-gray-50 cursor-pointer">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center border border-gray-300 rounded-lg px-4 h-12">
            <input type="number" placeholder="Enter amount (e.g. 50)" value={relativeAmount} onChange={e => setRelativeAmount(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              className="min-w-0 flex-1 bg-transparent outline-none text-sm text-[#1D3B53]" />
            <span className="text-sm font-bold text-[#1D3B53]">{fiat}</span>
          </div>
        </div>
      )}

      {priceType === "Relative" && effectiveRate && (
        <div className="bg-[#E8F5E9] rounded-lg p-3 flex justify-between mb-2">
          <span className="text-xs text-[#2E7D32]">Your rate:</span>
          <span className="text-xs text-[#2E7D32] font-bold">{parseFloat(effectiveRate).toLocaleString("en-US", { minimumFractionDigits: 2 })} {fiat}/{asset}</span>
        </div>
      )}

      <div className="bg-[#FFF9E6] rounded-lg p-3 flex justify-between mb-6">
        <span className="text-xs text-[#F5A623]">Reference price:</span>
        <span className="text-xs text-[#F5A623] font-bold">
          {refLoading ? "Loading..." : `${parseFloat(referencePrice).toLocaleString("en-US", { minimumFractionDigits: 2 })} ${fiat}/${asset}`}
        </span>
      </div>

      {/* Rollover Trading */}
      <p className="text-sm font-semibold text-[#1D3B53] mb-3">Turn On Rollover Trading</p>
      <div className={`rounded-xl p-4 flex items-center gap-3 mb-6 ${editData?.id ? "bg-gray-50" : "bg-[#EBF4FF]"}`}>
        <div className="flex-1">
          <p className="text-xs text-gray-500 leading-relaxed">
            Rollover Trading lets the system automatically use your available balance whenever your ad matches a trade. Funds are deducted automatically from your wallet.
          </p>
          {editData?.id && (
            <p className="text-xs text-gray-400 mt-1">Rollover cannot be changed after an ad is created.</p>
          )}
        </div>
        <button
          onClick={() => !editData?.id && handleRolloverToggle(!rolloverEnabled)}
          disabled={!!editData?.id}
          className={`w-11 h-6 rounded-full transition-colors shrink-0 ${editData?.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${rolloverEnabled ? "bg-primary" : "bg-gray-300"}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full m-1 transition-transform ${rolloverEnabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Transaction Settings */}
      <p className="text-sm font-semibold text-[#1D3B53] mb-3">Transaction Setting</p>
      <p className="text-sm text-[#1D3B53] mb-2">Status</p>
      <div className="flex gap-5 mb-1">
        {[{ label: "Online", val: true }, { label: "Private", val: false }].map(opt => (
          <button key={opt.label} onClick={() => setActive(opt.val)} className="flex items-center gap-2 cursor-pointer">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active === opt.val ? "border-primary" : "border-gray-300"}`}>
              {active === opt.val && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
            <span className="text-sm text-[#1D3B53]">{opt.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-300 mb-5">Private ads will not appear in the P2P market. You can share directly with other users.</p>

      {/* Total Quantity / Amount — hidden when rollover is on */}
      {rolloverEnabled ? (
        <div className="bg-[#E8F5E9] rounded-xl p-3 mb-5">
          <p className="text-xs text-[#2E7D32] font-medium">Rollover enabled — your full available wallet balance will be used automatically for each matched trade.</p>
          <p className="text-xs text-[#2E7D32] mt-1">Balance: {Number(balance).toLocaleString("en-US", { minimumFractionDigits: isBuy ? 2 : 4, maximumFractionDigits: isBuy ? 2 : 4 })} {targetCurrency}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#1D3B53] mb-2">{isBuy ? "Total Amount" : "Total Quantity"}</p>
          <div className="flex items-center border border-gray-300 rounded-lg px-4 h-12 mb-1">
            <input type="number" placeholder={isBuy ? "Please Enter Amount" : "Please Enter Quantity"} value={totalQuantity} onChange={e => setTotalQuantity(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              className="flex-1 bg-transparent outline-none text-sm text-[#1D3B53]" />
            <div className="flex items-center gap-2">
              <button onClick={handleTotalMax} className="text-xs text-[#F5A623] font-medium cursor-pointer">Max</button>
              <div className="w-px h-4 bg-gray-300" />
              <span className="text-sm font-bold text-[#1D3B53]">{targetCurrency}</span>
            </div>
          </div>
          <p className="text-xs text-[#F5A623] mb-5">
            Balance: {Number(balance).toLocaleString("en-US", { minimumFractionDigits: isBuy ? 2 : 4, maximumFractionDigits: isBuy ? 2 : 4 })} {targetCurrency}
          </p>
        </>
      )}

      {/* Single Transaction Limit */}
      <p className="text-sm text-[#1D3B53] mb-2">Min Transaction Limit ({isBuy ? fiat : asset})</p>
      <div className="mb-1">
        <div className="flex items-center border border-gray-300 rounded-lg px-3 h-12">
          <input type="number" placeholder={isBuy ? "1000.00" : "1"} value={minLimit} onChange={e => setMinLimit(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#1D3B53]" />
          <button onClick={handleSingleMin} className="text-xs text-[#F5A623] font-medium cursor-pointer shrink-0 ml-1">Min</button>
          <div className="w-px h-4 bg-gray-300 mx-2 shrink-0" />
          <span className="text-xs font-bold text-[#1D3B53] shrink-0">{isBuy ? fiat : asset}</span>
        </div>
        <span className="text-xs text-gray-400 mt-1 block">
          Max per trade: <span className="text-[#1D3B53] font-medium">{Number(balance).toLocaleString("en-US", { minimumFractionDigits: isBuy ? 2 : 4, maximumFractionDigits: isBuy ? 2 : 4 })} {targetCurrency}</span> {rolloverEnabled ? "(wallet balance)" : "(your balance)"}
        </span>
      </div>

      {/* Warning */}
      <div className="bg-[#FFF9E6] rounded-xl p-4 flex gap-3 mt-6 mb-6">
        <AlertCircle size={18} className="text-[#F5A623] shrink-0 mt-0.5" />
        <p className="text-xs text-[#8B572A] leading-relaxed">
          Ensure your ad information is accurate. Avoid including remarks that clearly direct users to other platforms. Violation of platform policies may result in account restrictions.
        </p>
      </div>

      {/* Publish Button */}
      <button onClick={handlePublishClick} disabled={loading}
        className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-50 hover:bg-primary/90 transition-colors">
        {loading ? "Processing..." : "Publish"}
      </button>

      {/* Rollover Confirmation Modal */}
      <ConfirmationModal
        visible={rolloverModal}
        onClose={() => { setRolloverEnabled(false); setRolloverModal(false); }}
        onConfirm={() => { setRolloverEnabled(true); setRolloverModal(false); }}
        title="Enable Rollover Trading?"
        message="Enabling Rollover Trading allows the system to automatically use your available balance whenever a matching trade occurs. All rollover transactions are final once processed."
        confirmText="Yes, Enable"
      />

      {/* Publish Confirmation → PIN */}
      {publishConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setPublishConfirm(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg text-[#1D3B53]">Confirmation</h3>
              <button onClick={() => setPublishConfirm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">✕</button>
            </div>
            <div className="bg-[#F9FAFB] rounded-xl p-4 mb-5 space-y-2">
              <p className="text-base font-bold mb-3">
                <span className={type === "Buy" ? "text-green-600" : "text-red-500"}>{type}</span> <span className="text-[#1D3B53]">{asset}</span>
              </p>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Price</span><span className="font-semibold text-[#1D3B53]">{priceType === "Fixed" ? price : effectiveRate} {fiat}/{asset}</span></div>
              <div className="bg-[#EBF4FF] rounded-lg p-3 my-2">
                <p className="text-xs text-primary leading-relaxed">The price you&apos;ve set is {priceType === "Relative" ? "relative to" : "fixed at"} the current market rate. Please confirm to continue.</p>
              </div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Quantity</span><span className="font-semibold text-[#1D3B53]">{rolloverEnabled ? "Rollover (wallet balance)" : `${totalQuantity} ${targetCurrency}`}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Your Fee (maker)</span><span className="font-semibold text-[#1D3B53]">{makerFeePercent}%</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Limits</span><span className="font-semibold text-[#1D3B53]">{minLimit} – {Number(balance).toLocaleString("en-US", { minimumFractionDigits: isBuy ? 2 : 4, maximumFractionDigits: isBuy ? 2 : 4 })} {isBuy ? fiat : asset}</span></div>
            </div>
            <PublishAgreement onConfirm={() => { setPublishConfirm(false); requirePin(() => setPinModal(true)); }} onCancel={() => setPublishConfirm(false)} />
          </div>
        </div>
      )}

      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={handlePin} />
      <StatusModal visible={statusModal.visible} onClose={() => { setStatusModal(s => ({ ...s, visible: false })); if (statusModal.type === "success") router.push("/my-ads"); }} type={statusModal.type} title={statusModal.title} message={statusModal.message} buttonText={statusModal.type === "success" ? "Done" : "OK"} />
    </div>
  );
}

function PublishAgreement({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <>
      <div className="flex gap-2 bg-[#F0F5FF] rounded-lg p-3 mb-5">
        <button onClick={() => setAgreed(!agreed)} className="mt-0.5 cursor-pointer shrink-0">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${agreed ? "bg-primary border-primary" : "border-gray-300"}`}>
            {agreed && <Check size={12} className="text-white" />}
          </div>
        </button>
        <p className="text-xs text-[#1D3B53] leading-relaxed">
          I have read and agreed to the <a href="https://kynettic.com/terms-of-service" target="_blank" className="text-primary underline">terms and conditions</a> and <a href="https://kynettic.com/privacy-policy" target="_blank" className="text-primary underline">Privacy Policy</a>
        </p>
      </div>
      <button onClick={agreed ? onConfirm : undefined} disabled={!agreed}
        className="w-full bg-primary text-white font-bold py-3.5 rounded-full cursor-pointer disabled:opacity-50 mb-3">Post Now</button>
      <button onClick={onCancel} className="w-full bg-[#F0F5FF] text-primary font-bold py-3.5 rounded-full cursor-pointer">Cancel</button>
    </>
  );
}

export default function PostAdPage() {
  return <Suspense><Content /></Suspense>;
}
