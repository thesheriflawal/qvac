"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Clipboard, X, Copy, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import ReceiptActions from "@/components/ReceiptActions";
import { useReceiptDownload } from "@/hooks/useReceiptDownload";
import { walletService } from "@/services/wallet.service";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";
import { useRequirePin } from "@/hooks/useRequirePin";
import { getErrorMessage } from "@/utils/errorHandler";
import P2PEnterPinModal from "@/components/modals/P2PEnterPinModal";

const MIN_WITHDRAWAL: Record<string, number> = {
  ETH: 0.001,
  SOL: 0.01,
  BTC: 0.0001,
};

// Safe decimal helpers
const FACTOR = 1e10;
const safeGt = (a: number, b: number) => Math.round(a * FACTOR) > Math.round(b * FACTOR);
const safeSub = (a: number, b: number) => Math.round((a - b) * FACTOR) / FACTOR;

const ETH_RE = /^0x[0-9a-fA-F]{40}$/;
const TRX_RE = /^T[A-Za-z1-9]{33}$/;
const BTC_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{6,87}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const XRP_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const LTC_RE = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[ac-hj-np-z02-9]{6,87}$/;
const DOGE_RE = /^D[5-9A-HJ-NP-Za-km-z]{33}$/;
const BNB_RE = ETH_RE; // BNB Smart Chain uses EVM addresses
const MATIC_RE = ETH_RE; // Polygon uses EVM addresses

const CONTRACT_ADDRESSES: Record<string, Record<string, string>> = {
  USDT: {
    eth:      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    trx:      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    sol:      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    bsc:      "0x55d398326f99059fF775485246999027B3197955",
    matic:    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    arb:      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    ton:      "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    celo:     "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
    lisk:     "0x05D032ac25d322df992303dCa074EE7392C117b9",
  },
  USDC: {
    eth:      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    trx:      "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8",
    sol:      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    bsc:      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    matic:    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    arb:      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    base:     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    celo:     "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    lisk:     "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
  },
  ETH: {
    bsc:   "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    matic: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
  BTC: {
    bsc:   "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  },
  BNB: {
    eth:   "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
  },
};

const normalizeChainKey = (key: string) => {
  const k = (key || "").toLowerCase().replace(/\s+/g, "");
  if (k.includes("sol"))                                          return "sol";
  if (k.includes("trx") || k.includes("tron") || k.includes("trc20")) return "trx";
  if (k.includes("bnb") || k.includes("bsc") || k.includes("bep20"))  return "bsc";
  if (k.includes("matic") || k.includes("polygon"))              return "matic";
  if (k.includes("btc") || k.includes("bitcoin"))                return "btc";
  if (k.includes("arbitrum") || k.includes("arb"))               return "arb";
  if (k.includes("optimism") || k === "op")                      return "optimism";
  if (k.includes("ton"))                                         return "ton";
  if (k.includes("celo"))                                        return "celo";
  if (k.includes("lisk"))                                        return "lisk";
  if (k === "base" || k.includes("base"))                        return "base";
  if (k.includes("eth") || k.includes("erc20"))                  return "eth";
  return k;
};

const deduplicateNetworks = (list: any[]) => {
  const seen = new Set<string>();
  return list.filter(net => {
    const key = normalizeChainKey(net.chain_key || net.name || "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getContractAddress = (coin: string, chainKey: string) =>
  CONTRACT_ADDRESSES[coin.toUpperCase()]?.[normalizeChainKey(chainKey)] ?? null;

const abbrevAddr = (addr: string) =>
  addr.length <= 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;

function isValidAddress(addr: string, chainKey: string) {
  const c = chainKey.toLowerCase();
  if (c.includes("btc") || c.includes("bitcoin")) return BTC_RE.test(addr);
  if (c.includes("trx") || c.includes("tron") || c.includes("trc")) return TRX_RE.test(addr);
  if (c.includes("sol") || c.includes("solana")) return SOL_RE.test(addr);
  if (c.includes("xrp") || c.includes("ripple")) return XRP_RE.test(addr);
  if (c.includes("ltc") || c.includes("litecoin")) return LTC_RE.test(addr);
  if (c.includes("doge") || c.includes("dogecoin")) return DOGE_RE.test(addr);
  if (c.includes("bnb") || c.includes("bsc")) return BNB_RE.test(addr);
  if (c.includes("matic") || c.includes("polygon")) return MATIC_RE.test(addr);
  // Default: EVM-compatible (ETH, USDT-ERC20, etc.)
  return ETH_RE.test(addr);
}


function WithdrawCryptoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const symbol = params.get("symbol") || "BTC";
  const currencyId = params.get("currency_id") || "";

  const { getWalletByCurrency, fetchWallets } = useWallet() as any;
  const { user } = useAuth();
  const requirePin = useRequirePin();
  const wallet = getWalletByCurrency?.(symbol);
  const availableBalance = wallet
    ? parseFloat(String(wallet.balance || 0)) - parseFloat(String(wallet.locked_balance || 0))
    : 0;

  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [networks, setNetworks] = useState<any[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [liveFee, setLiveFee] = useState<string | null>(null);
  const [feeError, setFeeError] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const { downloadImage, downloadPDF, share, working } = useReceiptDownload(receiptRef, "withdrawal-receipt");

  const parsedAmount = parseFloat(amount) || 0;
  const feeNum = liveFee !== null && !feeLoading ? parseFloat(String(liveFee)) || 0 : 0;
  const totalRequired = parsedAmount + feeNum;
  const exceedsBalance = parsedAmount > 0 && safeGt(totalRequired, availableBalance);

  useEffect(() => {
    if (!currencyId) return;
    setNetworksLoading(true);
    walletService.getCurrencyNetworks(currencyId)
      .then(res => {
        const list = deduplicateNetworks(
          (res?.data || []).filter((n: any) => n.is_active && !/(arbitrum|arb)/i.test(n.chain_key || n.name || ""))
        );
        setNetworks(list);
        if (list.length > 0) setShowNetworkPicker(true);
      })
      .catch(() => {})
      .finally(() => setNetworksLoading(false));
  }, [currencyId]);

  const fetchFee = (network: any) => {
    if (!network || !symbol) return;
    setLiveFee(null);
    setFeeError(false);
    setFeeLoading(true);
    walletService.getCryptoWithdrawalFee(symbol, network.chain_key)
      .then(res => {
        // Handle multiple possible response shapes from backend/Quidax
        const d = res?.data;
        const feeValue =
          d?.fees?.[0]?.value ??       // { data: { fees: [{ value: 1 }] } }
          d?.fee ??                     // { data: { fee: "1.0" } }
          d?.withdrawal_fee ??          // { data: { withdrawal_fee: "1.0" } }
          d?.amount ??                  // { data: { amount: "1.0" } }
          res?.fee ??                   // { fee: "1.0" } (unwrapped)
          null;
        if (feeValue !== null && feeValue !== undefined && !isNaN(parseFloat(String(feeValue)))) {
          setLiveFee(String(feeValue));
          setFeeError(false);
        } else {
          setFeeError(true);
        }
      })
      .catch(() => setFeeError(true))
      .finally(() => setFeeLoading(false));
  };

  useEffect(() => {
    fetchFee(selectedNetwork);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork, symbol]);

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setAddress(text);
    } catch {
      // Clipboard API blocked (common on mobile) — focus the input so the user can paste via OS long-press menu
      addressInputRef.current?.focus();
    }
  };

  const handleMax = () => {
    if (feeLoading || feeError || liveFee === null) return; // fee must be known first
    const fee = parseFloat(String(liveFee)) || 0;
    const maxAmount = Math.max(0, safeSub(availableBalance, fee));
    setAmount(maxAmount > 0 ? maxAmount.toFixed(8).replace(/\.?0+$/, "") : "0");
  };

  const handleWithdraw = () => {
    setError("");
    if (!selectedNetwork) { setError("Please select a network"); return; }
    if (!address || address.trim().length < 10) { setError("Please enter a valid wallet address"); return; }
    if (!isValidAddress(address.trim(), selectedNetwork.chain_key)) { setError("Address format is not valid for the selected network"); return; }
    if (!amount || parsedAmount <= 0) { setError("Please enter a valid amount"); return; }
    const minWithdrawal = MIN_WITHDRAWAL[symbol.toUpperCase()];
    if (minWithdrawal && parsedAmount < minWithdrawal) { setError(`Minimum withdrawal for ${symbol} is ${minWithdrawal} ${symbol}`); return; }
    if (exceedsBalance) { setError(`Insufficient balance. Amount + fee requires ${totalRequired.toFixed(8).replace(/\.?0+$/, "")} ${symbol} but your balance is ${availableBalance} ${symbol}`); return; }
    requirePin(() => setPinModal(true));
  };

  const onPin = async (pin: string, authCode?: string) => {
    setPinModal(false);
    setLoading(true);
    setError("");
    try {
      const res = await walletService.withdrawCrypto(
        selectedNetwork.chain_key, symbol, address.trim(), amount, pin, authCode || ""
      );
      const tx = res?.data || res || {};
      setSuccessData({
        amount,
        currency: symbol,
        address: address.trim(),
        network: selectedNetwork.name,
        fee: liveFee || "0",
        orderNo: tx.order_number || tx.reference || tx.id || "",
        txHash: tx.tx_hash || tx.hash || "",
        orderTime: tx.created_at ? new Date(tx.created_at).toLocaleString() : new Date().toLocaleString(),
      });
      fetchWallets();
    } catch (e: any) {
      const status = e?.response?.status;
      // Backend occasionally returns 5xx even after accepting the withdrawal.
      // Treat it as pending and let the user verify via history.
      if (status === 500 || status === 502 || status === 503) {
        setSuccessData({
          amount,
          currency: symbol,
          address: address.trim(),
          network: selectedNetwork.name,
          fee: liveFee || "0",
          orderNo: "",
          txHash: "",
          orderTime: new Date().toLocaleString(),
          pending: true,
        });
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-2 border-b border-gray-100">
        <button onClick={() => router.push("/wallet")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-base font-bold text-[#1D3B53]">{symbol} - On-Chain</h1>
      </div>

      <div className="space-y-5 pt-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        {/* Address */}
        <div>
          <label className="block text-sm text-[#555] mb-2">Address</label>
          <div className="flex items-center bg-[#EBF4FF] border border-primary rounded-xl px-4 h-14 gap-2">
            <input
              ref={addressInputRef}
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter address"
              className="flex-1 bg-transparent text-sm text-[#1D3B53] outline-none"
            />
            <button onClick={handlePaste} className="text-primary font-semibold text-sm cursor-pointer shrink-0 flex items-center gap-1">
              <Clipboard size={14} /> Paste
            </button>
          </div>
        </div>

        {/* Network */}
        <div>
          <label className="block text-sm text-[#555] mb-2">Network</label>
          {networksLoading ? (
            <div className="h-14 bg-[#EBF4FF] border border-primary rounded-xl flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <button
              onClick={() => networks.length > 0 && setShowNetworkPicker(true)}
              className="w-full flex items-center justify-between bg-[#EBF4FF] border border-primary rounded-xl px-4 h-14 cursor-pointer"
            >
              <span className="text-sm font-bold text-[#1D3B53]">{selectedNetwork?.name || "Select a network"}</span>
              <ChevronDown size={20} className="text-[#1D3B53]" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-[#555] mb-2">Amount</label>
          <div className={`bg-[#EBF4FF] border rounded-2xl p-4 ${exceedsBalance ? "border-red-500" : "border-primary"}`}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-[#1D3B53] outline-none"
              />
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-[#555] font-semibold">{symbol}</span>
                <div className="w-px h-4 bg-gray-300" />
                <button onClick={handleMax} disabled={feeLoading || feeError || liveFee === null} className="text-primary font-bold text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Max</button>
              </div>
            </div>
          </div>
        </div>

        {/* Balance box */}
        <div className={`flex justify-between items-center rounded-xl p-4 border ${exceedsBalance ? "bg-red-50 border-red-300" : "bg-[#FFF9EB] border-[#FFE0B2]"}`}>
          <span className="text-xs text-[#8E8E93]">Available Balance: <span className={`font-bold ${exceedsBalance ? "text-red-500" : "text-orange-400"}`}>{availableBalance}</span> {symbol}</span>
          <button onClick={() => router.push(`/deposit?symbol=${symbol}&currency_id=${currencyId}`)} className="flex items-center gap-1 text-xs text-[#333]">
            + Add funds
          </button>
        </div>

        {exceedsBalance && (
          <p className="text-xs text-red-500 -mt-3">
            Amount + fee ({totalRequired.toFixed(8).replace(/\.?0+$/, "")} {symbol}) exceeds your balance
          </p>
        )}

        {/* Fee card */}
        {selectedNetwork && (
          <div className="bg-[#F0F7FF] border border-[#D6E4F0] rounded-xl p-4">
            <p className="text-xs font-bold text-[#1D3B53] mb-2">Withdrawal Fee</p>
            {feeLoading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : feeError ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-500">Fee info unavailable — tap Retry</span>
                <button
                  onClick={() => fetchFee(selectedNetwork)}
                  className="text-xs font-bold text-primary bg-[#EBF4FF] px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : liveFee !== null ? (
              <>
                <div className="flex justify-between">
                  <span className="text-xs text-[#555]">Network fee ({selectedNetwork.name})</span>
                  <span className="text-xs font-semibold text-[#555]">{liveFee} {symbol}</span>
                </div>
                {parsedAmount > 0 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-[#D6E4F0]">
                    <span className="text-xs font-semibold text-[#1D3B53]">Total debited from wallet</span>
                    <span className={`text-xs font-bold ${exceedsBalance ? "text-red-500" : "text-[#1D3B53]"}`}>
                      {totalRequired.toFixed(8).replace(/\.?0+$/, "")} {symbol}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-xs text-[#8E8E93]">Fee info unavailable</span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[230px] xl:right-[280px] bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div>
            <p className="text-xl font-bold text-[#1D3B53]">{parsedAmount || "0"} <span className="text-sm text-[#8E8E93] font-normal">{symbol}</span></p>
            <p className="text-xs text-[#8E8E93]">Total to be sent</p>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!selectedNetwork || !address || parsedAmount <= 0 || exceedsBalance || loading || feeLoading || feeError}
            className="bg-primary text-white font-bold py-3 px-8 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </div>
      </div>

      {/* Network picker modal */}
      {showNetworkPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowNetworkPicker(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h3 className="font-bold text-base text-[#1D3B53]">Select Network</h3>
            </div>
            <div className="overflow-y-auto max-h-[60vh] px-5 space-y-2 pb-8">
              {networks.map(net => {
                const ca = getContractAddress(symbol, net.chain_key);
                return (
                  <button
                    key={net.id}
                    onClick={() => { setSelectedNetwork(net); setShowNetworkPicker(false); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl cursor-pointer ${selectedNetwork?.id === net.id ? "bg-[#EBF4FF] border border-primary" : "bg-[#F7F9FC]"}`}
                  >
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-[#1D3B53]">{net.name}</p>
                      <p className="text-xs text-[#8E8E93]">{net.chain_key.toUpperCase()}</p>
                      <p className="text-[10px] text-[#8E8E93] font-mono mt-0.5">
                        {ca ? `CA: ${abbrevAddr(ca)}` : "Native asset"}
                      </p>
                    </div>
                    {selectedNetwork?.id === net.id && <span className="text-primary text-base">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <P2PEnterPinModal visible={pinModal} onClose={() => setPinModal(false)} onSubmit={onPin} />

      {/* Success Receipt Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md mx-auto max-h-[95vh] overflow-y-auto shadow-2xl">

            {/* Captured receipt area */}
            <div ref={receiptRef} className="bg-white rounded-3xl overflow-hidden">

              {/* Brand header */}
              <div className="bg-[#1D3B53] px-6 pt-6 pb-16 flex flex-col items-center relative">
                <button
                  onClick={() => { setSuccessData(null); router.push("/wallet"); }}
                  className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-2 mb-6">
                  <Image src="/KYNETTIC.png" alt="Kynettic" width={36} height={36} className="rounded-full" />
                  <span className="text-white font-bold text-lg tracking-wide">KYNETTIC</span>
                </div>
                <div className={`w-16 h-16 rounded-full ${successData.pending ? "bg-yellow-400" : "bg-[#34C759]"} flex items-center justify-center shadow-lg mb-3`}>
                  <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
                </div>
                <p className="text-white/80 text-sm font-medium">{successData.pending ? "Withdrawal Pending" : "Withdrawal Successful"}</p>
                {successData.pending && (
                  <p className="text-white/60 text-xs mt-1 text-center px-4">Your withdrawal is being processed. Check your history for the final status.</p>
                )}
              </div>

              {/* Amount card */}
              <div className="mx-6 -mt-5">
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-5 py-4 text-center">
                  <p className="text-xs text-[#8E8E93] mb-1 uppercase tracking-wider">Amount Sent</p>
                  <p className="text-3xl font-bold text-[#1D3B53]">{successData.amount}</p>
                  <p className="text-sm text-[#8E8E93] mt-1 font-medium">{successData.currency}</p>
                </div>
              </div>

              {/* Reference */}
              {successData.orderNo && (
                <div className="mx-6 mt-4">
                  <div className="bg-[#FFF8E7] border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#8E8E93]">Reference</p>
                      <p className="text-sm font-bold text-[#1D3B53] font-mono">{successData.orderNo}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(successData.orderNo);
                        setCopiedField("ref");
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className="cursor-pointer"
                    >
                      {copiedField === "ref" ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} className="text-[#8E8E93]" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Destination address */}
              <div className="mx-6 mt-4">
                <div className="bg-[#F0F7FF] border border-[#D6E4F0] rounded-xl px-4 py-2.5">
                  <p className="text-xs text-[#8E8E93] mb-1">Destination Address</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono font-semibold text-[#1D3B53] break-all">{successData.address}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(successData.address);
                        setCopiedField("addr");
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className="cursor-pointer shrink-0"
                    >
                      {copiedField === "addr" ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} className="text-[#8E8E93]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details table */}
              <div className="mx-6 mt-4 mb-2">
                <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider mb-3">Transaction Details</p>
                <div className="rounded-2xl border border-[#E8EFF7] overflow-hidden">
                  {[
                    { label: "Network", value: successData.network },
                    { label: "Network Fee", value: `${successData.fee} ${successData.currency}` },
                    { label: "Method", value: "On-Chain Transfer" },
                    { label: "Status", value: "Completed", green: true },
                    ...(successData.txHash ? [{ label: "Tx Hash", value: successData.txHash, mono: true, copyKey: "txhash" }] : []),
                    { label: "Date & Time", value: successData.orderTime },
                    { label: "Total Sent", value: `${successData.amount} ${successData.currency}`, bold: true },
                  ].map((row: any, i, arr) => (
                    <div key={i} className={`flex justify-between items-center px-4 py-3 ${i % 2 === 0 ? "bg-white" : "bg-[#F7FAFF]"} ${i < arr.length - 1 ? "border-b border-[#EDF2F7]" : ""}`}>
                      <span className="text-xs text-[#8E8E93] shrink-0">{row.label}</span>
                      <div className="flex items-center gap-1 max-w-[55%]">
                        <span className={`text-xs text-right truncate ${row.bold ? "font-bold text-[#1D3B53]" : row.green ? "font-semibold text-[#34C759]" : row.mono ? "font-mono font-medium text-[#4472B7]" : "font-medium text-[#1D3B53]"}`}>
                          {row.value}
                        </span>
                        {row.copyKey && (
                          <button onClick={async () => {
                            await navigator.clipboard.writeText(row.value);
                            setCopiedField(row.copyKey);
                            setTimeout(() => setCopiedField(null), 2000);
                          }} className="cursor-pointer shrink-0">
                            {copiedField === row.copyKey ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} className="text-[#8E8E93]" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt footer */}
              <div className="mx-6 mt-4 mb-6 flex flex-col items-center gap-1">
                <div className="w-full border-t-2 border-dashed border-[#E8EFF7]" />
                <div className="flex items-center gap-1.5 mt-3">
                  <Image src="/KYNETTIC.png" alt="Kynettic" width={16} height={16} className="rounded-full opacity-60" />
                  <p className="text-xs text-[#8E8E93]">Powered by <span className="font-bold text-[#1D3B53]">Kynettic</span></p>
                </div>
                <p className="text-[10px] text-[#BCBCBC]">kynettic.com · Safe. Fast. Reliable.</p>
              </div>

            </div>{/* end receipt capture */}

            {/* Share / Download */}
            <div className="px-6 pb-3 pt-1">
              <ReceiptActions onDownloadImage={downloadImage} onDownloadPDF={downloadPDF} onShare={share} working={working} />
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 space-y-3">
              <button
                onClick={() => { setSuccessData(null); router.push("/wallet"); }}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
              >
                Go to Wallet
              </button>
              <button className="w-full bg-[#F0F4F8] text-primary font-bold py-4 rounded-xl cursor-pointer">
                Order Dispute?
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WithdrawCryptoPage() {
  return <Suspense><WithdrawCryptoContent /></Suspense>;
}
