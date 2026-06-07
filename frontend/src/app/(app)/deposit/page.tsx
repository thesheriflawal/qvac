"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, Copy, CheckCircle2, AlertTriangle, WifiOff, Layers, X } from "lucide-react";
import Image from "next/image";
import { walletService } from "@/services/wallet.service";
import CurrencyIcon from "@/components/CurrencyIcon";

interface Network {
  id: string;
  chain_key: string;
  name: string;
  network_type: string;
  is_active: boolean;
}

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

const deduplicateNetworks = (list: Network[]) => {
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

function DepositPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const coin = params.get("coin") || "USDT";
  const currencyId = params.get("currencyId") || "";

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [networksLoading, setNetworksLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyNotif, setCopyNotif] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<Network | null>(null);
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);

  useEffect(() => { fetchNetworks(); }, [currencyId]);
  useEffect(() => { if (selectedNetwork) fetchAddress(); }, [selectedNetwork]);

  const fetchNetworks = async () => {
    if (!currencyId) { setNetworksLoading(false); setIsSupported(false); return; }
    setNetworksLoading(true);
    try {
      const res = await walletService.getCurrencyNetworks(currencyId);
      const list: Network[] = deduplicateNetworks(
        (res?.data || []).filter((n: Network) => n.is_active)
      );
      setNetworks(list);
      if (list.length > 0) { setNetworkModalOpen(true); setIsSupported(true); }
      else setIsSupported(false);
    } catch { setNetworks([]); setIsSupported(false); }
    finally { setNetworksLoading(false); }
  };

  const fetchAddress = async () => {
    if (!selectedNetwork) return;
    setLoading(true); setAddress("");
    try {
      const data = await walletService.getWalletAddress(selectedNetwork.chain_key, coin);
      if (data?.data?.address) { setAddress(data.data.address); setIsSupported(true); }
      else setIsSupported(false);
    } catch { setIsSupported(false); }
    finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true); setCopyNotif(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setCopyNotif(false), 3000);
    setTimeout(() => navigator.clipboard.writeText(""), 60000);
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Copy notification */}
      {copyNotif && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#34C759] px-5 py-4 text-white">
          <p className="font-bold text-sm uppercase tracking-wide">Copied Successfully</p>
          <p className="text-xs opacity-90">Wallet address has been copied successfully</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-2">
        <button onClick={() => router.push("/deposit-search")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-gray-800" />
        </button>
        <div className="flex items-center gap-2">
          <CurrencyIcon symbol={coin} size={22} />
          <span className="font-bold text-lg text-[#1D3B53]">Deposit {coin}</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Network Selector */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-sm text-gray-500">Choose Network:</span>
        <button
          onClick={() => networks.length > 0 && setNetworkModalOpen(true)}
          className="flex items-center gap-1 cursor-pointer"
        >
          <span className="font-bold text-primary text-sm">
            {networksLoading ? "Loading..." : (selectedNetwork?.name || "Select a network")}
          </span>
          <ChevronDown size={16} className="text-gray-800" />
        </button>
      </div>

      {/* Network Modal */}
      {networkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setNetworkModalOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl pb-10" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-[#1D3B53]">Select Network</h3>
                <button onClick={() => setNetworkModalOpen(false)} className="text-gray-400 cursor-pointer"><X size={18}/></button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh] px-6 space-y-2 pb-4">
              {networks.map(net => (
                <button
                  key={net.id}
                  onClick={() => { setPendingNetwork(net); setNetworkModalOpen(false); setAck1(false); setAck2(false); setRiskModal(true); }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${
                    selectedNetwork?.id === net.id
                      ? "bg-[#EBF4FF] border border-primary"
                      : "bg-[#F7F9FC] hover:bg-gray-100"
                  }`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm text-[#1D3B53]">{net.name}</p>
                    <p className="text-xs text-[#8E8E93] mt-0.5">{net.chain_key.toUpperCase()}</p>
                  </div>
                  {selectedNetwork?.id === net.id && (
                    <CheckCircle2 size={20} className="text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {networksLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isSupported && !selectedNetwork ? (
        <div className="flex flex-col items-center py-10 px-5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#FFEBEE] flex items-center justify-center mb-5">
            <WifiOff size={40} className="text-[#FF3B30]" />
          </div>
          <p className="font-bold text-xl text-[#1D3B53] mb-2">Networks Unavailable</p>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Could not load networks for <strong>{coin}</strong>. This may be a connectivity issue — please retry.
          </p>
          <button
            onClick={fetchNetworks}
            className="bg-primary text-white font-bold text-sm px-6 py-3 rounded-xl cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : !selectedNetwork ? (
        <div className="flex flex-col items-center py-10 px-5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#EBF4FF] flex items-center justify-center mb-5">
            <Layers size={40} className="text-primary" />
          </div>
          <p className="font-bold text-xl text-[#1D3B53] mb-2">Select a Network</p>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Please choose a network above to get your <strong>{coin}</strong> deposit address.
          </p>
          <button
            onClick={() => networks.length > 0 && setNetworkModalOpen(true)}
            className="bg-primary text-white font-bold text-sm px-6 py-3 rounded-xl cursor-pointer"
          >
            Choose Network
          </button>
        </div>
      ) : !isSupported && !loading ? (
        <div className="flex flex-col items-center py-10 px-5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#FFEBEE] flex items-center justify-center mb-5">
            <WifiOff size={40} className="text-[#FF3B30]" />
          </div>
          <p className="font-bold text-xl text-[#1D3B53] mb-2">Service Unavailable</p>
          <p className="text-sm text-gray-500 mb-2 leading-relaxed">
            Deposits for <strong>{coin}</strong>{selectedNetwork ? ` on the ${selectedNetwork.name} network` : ""} are currently unavailable.
          </p>
          <p className="text-xs text-[#8E8E93]">Please check back later or try a different network.</p>
        </div>
      ) : (
        <>
          {/* Address Card */}
          <div className="bg-[#EBF4FF] rounded-xl p-4 mb-4 relative">
            <p className="font-bold text-sm text-[#1D3B53] mb-1">Wallet Address</p>
            <p className="text-xs text-primary pr-16 break-all leading-relaxed">
              {loading ? "Generating address..." : (address || "No address available")}
            </p>
            <button
              onClick={handleCopy}
              disabled={loading || !address}
              className="absolute right-4 top-4 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>}
              Copy
            </button>
          </div>

          {/* Quidax trust badge */}
          <div className="flex items-center justify-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3.5 py-2.5 mb-4 shadow-sm">
            <span className="text-xs text-gray-400">Crypto infrastructure by</span>
            <Image src="/QUIDAX.png" alt="Quidax" width={60} height={20} className="object-contain" />
          </div>

          {/* Info Card */}
          <div className="bg-[#F7F9FC] rounded-xl p-4 mb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8E93]">Minimum Deposit Amount:</span>
              <span className="text-gray-600 font-medium">0.00001 {coin}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8E93]">Deposit Arrival:</span>
              <span className="text-[#34C759] font-medium">1 confirmation</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8E93]">Withdrawal Unlocked:</span>
              <span className="text-gray-600 font-medium">2 confirmations</span>
            </div>
          </div>

          {/* Warning Card */}
          <div className="bg-[#FFF2F2] border border-[#FFCDD2] rounded-xl p-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-[#D92D20] shrink-0" />
              <p className="text-sm font-bold text-[#D92D20]">Network Risk Warning</p>
            </div>
            <ul className="space-y-1.5 text-xs text-[#7F1D1D] leading-relaxed list-disc list-inside">
              <li>Only send <strong>{coin}</strong> on the <strong>{selectedNetwork?.name}</strong> network to this address.</li>
              <li>Sending on the wrong network will result in <strong>permanent, unrecoverable loss</strong> of your funds.</li>
              <li>We cannot reverse, refund, or recover any cross-chain deposits.</li>
              <li>Double-check the network on your sending platform matches exactly.</li>
            </ul>
          </div>

          {/* Bottom Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/wallet")}
              className="flex-1 bg-[#EBF4FF] text-primary font-bold py-4 rounded-xl cursor-pointer"
            >
              Go to wallet
            </button>
            <button
              onClick={handleCopy}
              disabled={loading || !address}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Copy Address
            </button>
          </div>
        </>
      )}
      {/* Risk Acknowledgment Modal */}
      {riskModal && pendingNetwork && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            {/* Red header */}
            <div className="bg-[#D92D20] px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-base">Network Risk Warning</p>
                <p className="text-white/80 text-xs mt-0.5">Read carefully before proceeding</p>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-[#1D3B53] font-semibold mb-1">
                You selected: <span className="text-primary">{pendingNetwork.name} ({pendingNetwork.chain_key.toUpperCase()})</span>
              </p>
              <p className="text-xs text-[#8E8E93] mb-5 leading-relaxed">
                You are about to receive a deposit address for <strong>{coin}</strong> on the <strong>{pendingNetwork.name}</strong> network.
                Sending funds from a different network to this address will result in permanent loss.
              </p>

              <div className="bg-[#FFF2F2] border border-[#FFCDD2] rounded-xl p-4 mb-5 space-y-2 text-xs text-[#7F1D1D] leading-relaxed">
                <p>⚠ Crypto sent to the wrong network address <strong>cannot be recovered</strong> — not by us, not by anyone.</p>
                <p>⚠ There are no refunds, reversals, or exceptions for cross-chain deposits.</p>
                <p>⚠ Always confirm the network on your sending platform matches <strong>{pendingNetwork.name}</strong> before sending.</p>
                {(() => {
                  const ca = getContractAddress(coin, pendingNetwork.chain_key);
                  return (
                    <p className="pt-1 border-t border-[#FFCDD2]">
                      {ca
                        ? <>Contract address: <span className="font-mono font-bold tracking-tight">{abbrevAddr(ca)}</span></>
                        : <>Token type: <span className="font-bold">Native asset — no contract address</span></>
                      }
                    </p>
                  );
                })()}
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 mb-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ack1}
                    onChange={() => setAck1(!ack1)}
                    className="mt-0.5 w-4 h-4 accent-[#D92D20] cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-[#1D3B53] leading-relaxed">
                    I understand that sending <strong>{coin}</strong> on the wrong network will result in <strong>permanent and unrecoverable loss</strong> of my funds.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ack2}
                    onChange={() => setAck2(!ack2)}
                    className="mt-0.5 w-4 h-4 accent-[#D92D20] cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-[#1D3B53] leading-relaxed">
                    I will verify that my sending platform is set to <strong>{pendingNetwork.name} ({pendingNetwork.chain_key.toUpperCase()})</strong> before making any transfer.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRiskModal(false); setPendingNetwork(null); setNetworkModalOpen(true); }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-[#555] cursor-pointer hover:bg-gray-50"
                >
                  Go Back
                </button>
                <button
                  onClick={() => { setSelectedNetwork(pendingNetwork); setRiskModal(false); }}
                  disabled={!ack1 || !ack2}
                  className="flex-1 py-3 rounded-xl bg-[#D92D20] text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b82519] transition-colors"
                >
                  I Understand, Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DepositPage() {
  return <Suspense><DepositPageContent /></Suspense>;
}
