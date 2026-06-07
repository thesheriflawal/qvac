"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, AlertCircle, PlusCircle } from "lucide-react";
import { p2pService } from "@/services/p2p.service";
import { useWallet } from "@/context/WalletContext";
import { useAds } from "@/context/AdsContext";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PDisclaimerModal from "@/components/modals/P2PDisclaimerModal";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";
import { useRequirePin } from "@/hooks/useRequirePin";
import P2POrderSuccessModal from "@/components/modals/P2POrderSuccessModal";
import StatusModal from "@/components/modals/StatusModal";

function SellCryptoContent() {
  const router = useRouter();
  const requirePin = useRequirePin();
  const params = useSearchParams();
  const { getWalletByCurrency } = useWallet();
  const { p2pFeeMultiplier, takerFeePercent } = useAds();

  const adParam = params.get("ad") ? JSON.parse(decodeURIComponent(params.get("ad")!)) : null;
  const adId = params.get("adId") || adParam?.id;

  const [ad, setAd] = useState<any>(adParam);
  const [adLoading, setAdLoading] = useState(!adParam && !!adId);
  const [adError, setAdError] = useState(false);

  const [paymentTab, setPaymentTab] = useState<"Crypto" | "Fiat">("Crypto");
  const [amount, setAmount] = useState("");
  const [errorType, setErrorType] = useState<"LIMIT" | "BALANCE" | null>(null);
  const [disclaimer, setDisclaimer] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState({ visible: false, message: "" });
  const [orderResult, setOrderResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adParam || !adId) { if (!adParam) setAdError(true); setAdLoading(false); return; }
    p2pService.getAdById(adId)
      .then(d => setAd(d?.data || d))
      .catch(() => setAdError(true))
      .finally(() => setAdLoading(false));
  }, [adId]);

  const MIN_LIMIT = ad?.min_amount ? parseFloat(ad.min_amount) : 50;
  // For non-rollover: remaining_quantity = remaining fiat capacity. For rollover: remaining_quantity reflects creator's live balance.
  const MAX_LIMIT = parseFloat(ad?.remaining_quantity || "0") || parseFloat(ad?.total_quantity || "0");
  // EFFECTIVE_MAX accounts for taker fee — what the taker can actually input. null means no frontend cap.
  const EFFECTIVE_MAX = MAX_LIMIT > 0 ? MAX_LIMIT / p2pFeeMultiplier : null;
  const takerFeeRate = p2pFeeMultiplier - 1;
  const takerFeeDisplay = takerFeePercent + "%";
  const PRICE = parseFloat(ad?.effective_price || "") || parseFloat(ad?.price || "0");
  const adCurrency = ad?.currency || "USDT";
  const advertiser = ad?.username || ad?.advertiser?.username || ad?.advertiser || "Trader";

  const cryptoWallet = getWalletByCurrency(adCurrency);
  const AVAILABLE_BALANCE = Math.max(
    0,
    parseFloat(String(cryptoWallet?.balance || 0)) - parseFloat(String(cryptoWallet?.locked_balance || 0))
  );

  const isFiat = paymentTab === "Fiat";
  const parsedAmount = parseFloat(amount) || 0;

  const calculatedValue = !parsedAmount || !PRICE
    ? "0.00"
    : isFiat
      ? (parsedAmount / PRICE).toFixed(4)
      : (parsedAmount * PRICE).toFixed(2);

  const fiatTotal = isFiat ? parsedAmount : parsedAmount * PRICE;
  const fiatTotalCents = Math.round(fiatTotal * 100);
  const platformFeeCents = Math.round(fiatTotalCents * takerFeeRate);
  const platformFee = platformFeeCents / 100;
  const totalToReceive = (fiatTotalCents - platformFeeCents) / 100;

  const handleMax = () => {
    if (isFiat) {
      // Fee is charged in crypto from balance on top of trade amount.
      // Crypto needed = fiatAmount / PRICE, total USDT used = (fiatAmount / PRICE) * (1 + takerFeeRate)
      // So max fiatAmount = AVAILABLE_BALANCE / (1 + takerFeeRate) * PRICE
      const maxFiatFromBalance = (AVAILABLE_BALANCE / (1 + takerFeeRate)) * PRICE;
      const max = EFFECTIVE_MAX != null ? Math.min(maxFiatFromBalance, EFFECTIVE_MAX) : maxFiatFromBalance;
      setAmount((Math.floor(max * 100) / 100).toFixed(2));
    } else {
      // Fee charged from balance: total USDT used = amount * (1 + takerFeeRate)
      // So max amount = AVAILABLE_BALANCE / (1 + takerFeeRate)
      const maxFromBalance = AVAILABLE_BALANCE / (1 + takerFeeRate);
      const adMaxInCrypto = EFFECTIVE_MAX != null ? EFFECTIVE_MAX / PRICE : Infinity;
      const max = Math.min(maxFromBalance, adMaxInCrypto);
      setAmount((Math.floor(max * 10000) / 10000).toFixed(4).replace(/\.?0+$/, ""));
    }
  };

  const handleSell = () => {
    setErrorType(null);
    if (!parsedAmount || parsedAmount <= 0) return;

    let fiatVal = 0;
    let usdtVal = 0;
    if (isFiat) {
      fiatVal = parsedAmount;
      usdtVal = parsedAmount / PRICE;
    } else {
      usdtVal = parsedAmount;
      fiatVal = parsedAmount * PRICE;
    }

    if (!isFinite(fiatVal) || fiatVal < MIN_LIMIT || (EFFECTIVE_MAX != null && fiatVal > EFFECTIVE_MAX)) { setErrorType("LIMIT"); return; }
    if (usdtVal * (1 + takerFeeRate) > AVAILABLE_BALANCE) { setErrorType("BALANCE"); return; }
    setDisclaimer(true);
  };

  const onPin = async (pin: string) => {
    setPinModal(false); setLoading(true);
    try {
      const res = await p2pService.executeTrade(String(ad.id), amount, isFiat ? "fiat" : "crypto", pin);
      setOrderResult({
        type: "Sell", amount: `${amount} ${isFiat ? "NGN" : adCurrency}`,
        price: `${PRICE} NGN`, fee: `${platformFee} NGN`,
        quantity: `${calculatedValue} ${isFiat ? adCurrency : "NGN"}`,
        orderNo: res?.data?.order_number || "---",
        orderTime: new Date().toLocaleString(), advertiser,
      });
      setSuccessModal(true);
    } catch (e) { setErrorModal({ visible: true, message: getErrorMessage(e) }); }
    finally { setLoading(false); }
  };

  if (adLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (adError || !ad) return (
    <div className="flex flex-col items-center justify-center py-20 px-5">
      <p className="text-[#1D3B53] text-base mb-4">Failed to load ad details.</p>
      <button onClick={() => router.push("/p2p")} className="text-primary font-semibold cursor-pointer">Go Back</button>
    </div>
  );

  return (
    <div className="w-full pb-32">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push("/p2p")} className="p-1 cursor-pointer"><ArrowLeft size={18} className="text-[#1D3B53]" /></button>
        <span className="text-sm text-[#8E8E93]">P2P / <span className="text-[#1D3B53]">sell {adCurrency}</span></span>
      </div>

      {/* Error Banner */}
      {errorType === "LIMIT" && (
        <div className="flex items-start gap-2 bg-[#FEF0EF] border border-[#D92D20] text-[#D92D20] px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">AD LIMIT EXCEEDED!</p>
            <p className="text-xs">Please set your amount within the ad limit</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-bold text-xl text-[#1D3B53]">Sell {adCurrency}</h1>
        <div className="flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1">
          <ShieldCheck size={13} className="text-[#5CB85C]" />
          <span className="text-xs text-[#8E8E93]">Security Protection</span>
        </div>
      </div>

      {/* Price */}
      <p className="text-sm font-semibold text-[#1D3B53] mb-4">
        Price: <span className={errorType === "LIMIT" ? "text-[#D92D20] line-through" : "text-[#D92D20]"}>{PRICE.toFixed(2)} NGN</span>
      </p>

      {/* Tabs */}
      <div className="flex bg-[#F7F9FC] rounded-xl p-1 w-fit mb-5">
        {(["Crypto", "Fiat"] as const).map(t => (
          <button key={t} onClick={() => { setPaymentTab(t); setAmount(""); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${paymentTab === t ? "bg-white shadow text-[#1D3B53]" : "text-[#8E8E93]"}`}
          >
            With {t}
          </button>
        ))}
      </div>

      {/* Input Card */}
      <div className="bg-[#FFF5F5] rounded-2xl p-5 border border-[#D92D20] mb-4">
        <p className="text-sm text-[#1D3B53] mb-3">Amount</p>
        <div className="flex items-center justify-between mb-3">
          <input
            type="number" inputMode="decimal" value={amount}
            onChange={e => setAmount(e.target.value)}
            onWheel={e => e.currentTarget.blur()}
            placeholder="0.00"
            className={`min-w-0 flex-1 text-3xl font-bold bg-transparent outline-none ${errorType ? "text-[#D92D20]" : "text-black"}`}
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-[#8E8E93]">{isFiat ? "NGN" : adCurrency}</span>
            <button onClick={handleMax} className="text-sm text-[#D92D20] font-semibold border-l border-gray-300 pl-2 cursor-pointer">Max</button>
          </div>
        </div>
        <div className="h-px bg-gray-200 mb-3" />
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#8E8E93]">
            Limits: <span className="text-[#1D3B53] font-medium">{MIN_LIMIT.toLocaleString("en-US", { minimumFractionDigits: 2 })} - {EFFECTIVE_MAX != null ? EFFECTIVE_MAX.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"} NGN</span>
          </span>
          <span className="text-[#D92D20]">Fee: {takerFeeDisplay}</span>
        </div>


        <p className="text-sm font-semibold text-[#1D3B53]">
          {isFiat ? `I will Sell: ${calculatedValue} ${adCurrency}` : `I will Receive: ${calculatedValue} NGN`}
        </p>
      </div>

      {/* Balance Card */}
      <div className={`bg-[#FFF5F5] rounded-2xl p-4 mb-5 flex justify-between items-center border ${errorType === "BALANCE" ? "border-[#D92D20]" : "border-gray-200"}`}>
        <div>
          <p className="text-xs text-[#8E8E93]">
            Available Balance:{" "}
            <span className="text-[#D92D20] font-semibold text-sm">{AVAILABLE_BALANCE.toLocaleString("en-US", { minimumFractionDigits: 4 })}</span>{" "}{adCurrency}
          </p>
          {errorType === "BALANCE" && <p className="text-xs text-[#D92D20] mt-0.5">Insufficient balance</p>}
        </div>
        <button onClick={() => router.push(isFiat ? "/deposit-fiat" : "/deposit-crypto")} className="flex items-center gap-1 text-xs font-medium text-[#1D3B53] cursor-pointer">
          <PlusCircle size={15} /> Add funds
        </button>
      </div>

      {/* Advertiser */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-base font-bold text-[#1D3B53]">{advertiser}</span>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-[#1D3B53]"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <p className="text-xs text-[#8E8E93] mb-5">Advertiser</p>

      {/* Terms */}
      <p className="font-bold text-sm text-[#1D3B53] mb-2">Advertiser Terms</p>
      <div className="bg-[#FFF8E1] rounded-xl p-4 flex gap-3 mb-3">
        <AlertCircle size={18} className="text-[#F5A623] shrink-0 mt-0.5" />
        <p className="text-xs text-[#856404] leading-relaxed">
          Merchants may include additional terms in their Advertiser Terms. Please review them carefully before placing an order.
          In the event of any conflict, the P2P Taker Terms of Use and P2P Privacy Agreement shall prevail.
          Violations will not be protected under platform protection.
        </p>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        Quick and secure wallet trades. I&apos;m online all day for smooth deals and best rates. Happy trading!
      </p>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-30 md:left-[230px] xl:right-[280px]">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="shrink-0">
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-black">{amount || "0"}</span>
              <span className="text-sm text-[#8E8E93] mb-0.5">{isFiat ? "NGN" : adCurrency}</span>
            </div>
            <p className="text-xs text-[#8E8E93]">{isFiat ? "Total Amount" : "Total Quantity"}</p>
          </div>
          <button
            onClick={handleSell}
            disabled={loading || !amount}
            className="flex-1 bg-[#D92D20] text-white font-bold py-3.5 rounded-2xl cursor-pointer disabled:opacity-50 text-center"
          >
            {loading ? "..." : "Sell"}
          </button>
        </div>
      </div>

      <P2PDisclaimerModal visible={disclaimer} onClose={() => setDisclaimer(false)} onConfirm={() => { setDisclaimer(false); requirePin(() => setPinModal(true)); }} />
      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin} />
      {orderResult && <P2POrderSuccessModal visible={successModal} onClose={() => setSuccessModal(false)} order={orderResult} />}
      <StatusModal visible={errorModal.visible} onClose={() => setErrorModal({ visible: false, message: "" })} type="error" title="Error" message={errorModal.message} />
    </div>
  );
}

export default function SellCryptoPage() {
  return <Suspense><SellCryptoContent /></Suspense>;
}
