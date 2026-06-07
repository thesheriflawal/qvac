"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
export default function P2PFeesPage() {
  const router = useRouter();
  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => router.push("/")} className="flex items-center gap-2 text-primary hover:underline mb-4 cursor-pointer"><ArrowLeft size={18} /> Back to Home</button>
      <p className="text-sm text-gray-400 mb-1">P2P Trading</p>
      <h1 className="text-2xl font-bold mb-1">Kynettic P2P: Fees Explained</h1>
      <p className="text-gray-500 text-sm mb-6">Everything you need to know about trading fees on Kynettic</p>
      <p className="mb-4 text-gray-700">At Kynettic, we believe in keeping things simple and transparent. Below is a breakdown of how fees work on our P2P trading platform so there are no surprises when you trade.</p>
      <h2 className="font-semibold text-lg mt-8 mb-2">1. What Are P2P Trading Fees?</h2>
      <p className="text-gray-700 mb-4">Every time a trade is completed on Kynettic, a small fee is charged to help maintain the platform, ensure security, and keep everything running smoothly. This fee is automatically calculated and shown to you before you confirm any trade.</p>
      <h2 className="font-semibold text-lg mt-8 mb-2">2. Who Pays the Fee?</h2>
      <p className="text-gray-700 mb-2">Both the <strong>ad creator</strong> (maker) and the <strong>ad responder</strong> (taker) pay a fee. When a trade is completed, a small percentage is charged to each party.</p>
      <p className="text-gray-700 mb-4">This applies whether you are posting an ad or responding to one.</p>
      <h2 className="font-semibold text-lg mt-8 mb-2">3. How Much Is the Fee?</h2>
      <p className="text-gray-700 mb-2">Kynettic charges a flat, equal fee to both sides of every trade:</p>
      <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-4"><li><strong>Ad Maker Fee:</strong> 0.15% of the trade value</li><li><strong>Ad Taker Fee:</strong> 0.15% of the trade value</li></ul>
      <h2 className="font-semibold text-lg mt-8 mb-2">4. When Is the Fee Deducted?</h2>
      <p className="text-gray-700 mb-4">Fees are deducted automatically at the time of trade completion. You will see the fee amount in your order summary and transaction history. There are no hidden charges — what you see is what you pay.</p>
      <h2 className="font-semibold text-lg mt-8 mb-2">5. Are There Any Other Fees?</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-4"><li><strong>Wallet Funding:</strong> Depositing funds into your Kynettic wallet is free.</li><li><strong>Withdrawals:</strong> A small network or processing fee may apply when withdrawing funds from your wallet, depending on the method and currency.</li><li><strong>Internal Transfers:</strong> Sending funds to another Kynettic user internally is free.</li></ul>
      <h2 className="font-semibold text-lg mt-8 mb-2">6. Why Does Kynettic Charge Fees?</h2>
      <p className="text-gray-700 mb-4">Fees help us keep the platform secure, fund ongoing development, provide 24/7 support, and maintain the automated escrow system that protects every trade. We keep fees as low as possible while ensuring a safe trading experience.</p>
      <h2 className="font-semibold text-lg mt-8 mb-2">7. Fee Transparency</h2>
      <p className="text-gray-700 mb-4">You will always see the exact fee amount before confirming any action on Kynettic. We never charge surprise fees. If our fee structure ever changes, we will notify all users in advance.</p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8 mb-10"><p className="text-gray-800 text-sm"><strong>Have questions about fees?</strong> Reach out to us at <a href="mailto:support@kynettic.com" className="text-primary underline">support@kynettic.com</a> and we&apos;ll be happy to help.</p></div>
      <button onClick={() => router.push("/")} className="flex items-center gap-2 text-primary hover:underline mt-4 cursor-pointer"><ArrowLeft size={18} /> Back to Home</button>
    </div>
  );
}
