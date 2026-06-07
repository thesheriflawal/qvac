import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Fee Schedule - Kynettic",
  description: "Kynettic fee schedule for P2P trading, fiat wallets, and crypto wallets.",
};

export default function FeesPage() {
  return (
    <main className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-[#151E31] py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-bold text-xl"
          >
            <Image
              src="/KynetticLogo.png"
              alt="Kynettic"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span>Kynettic</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[#4472B7] mb-2">
          Fee Schedule
        </h1>
        <p className="text-gray-400 text-sm mb-6">Last Updated: April 3, 2026</p>
        <p className="text-gray-700 leading-relaxed mb-8">
          Kynettic&apos;s fees are straightforward and transparent. The exact fee for every action is shown to you before you confirm — no hidden charges, no surprises.
        </p>

        <div className="mb-8">
          <Link href="/" className="text-[#4472B7] font-semibold hover:underline">
            &larr; Back to Home
          </Link>
        </div>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">

          {/* P2P Trading */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">P2P Trading</h2>
          <p>
            All P2P trades on Kynettic settle instantly through our automated system — no bank transfers, no waiting, no manual steps. A small fee applies to both sides of every successfully completed trade.
          </p>

          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">Advertiser (Merchant)</td>
                  <td className="px-4 py-3 text-gray-600">0.15% of trade value</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">Trader (User)</td>
                  <td className="px-4 py-3 text-gray-600">0.15% of trade value</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul className="list-disc pl-6 space-y-1">
            <li>Fees are only charged when a trade completes successfully. No fee is applied if a trade does not complete.</li>
            <li>The exact fee amount is calculated and displayed before you confirm any trade.</li>
            <li>Fees are automatically deducted from your wallet at the moment of settlement.</li>
          </ul>

          {/* Fiat Wallet */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">Fiat (NGN) Wallet</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Deposits</h3>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-medium">NGN deposit</td>
                  <td className="px-4 py-3 text-gray-600">1% of amount (capped at &#8358;100)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Fiat is deposited into your Kynettic NGN wallet via your unique virtual bank account. Once your transfer is confirmed, your wallet is credited automatically.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Withdrawals</h3>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Charge</th>
                  <th className="text-left px-4 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">Bank processing fee</td>
                  <td className="px-4 py-3 text-gray-600">&#8358;30 flat</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">Stamp duty (on amounts above &#8358;10,000)</td>
                  <td className="px-4 py-3 text-gray-600">&#8358;50 flat</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-6 space-y-1">
            <li>Fiat withdrawals are processed only to the bank account registered under your verified name. Withdrawals to third-party accounts are not permitted.</li>
            <li>The total fee for your withdrawal is calculated and shown before you confirm.</li>
          </ul>

          {/* Crypto Wallet */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">Crypto Wallet</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Deposits</h3>
          <p>
            Crypto deposits are completely free. No fees applied.
          </p>
          <p>
            Send crypto to your Kynettic deposit address on any supported network and it will be credited to your wallet automatically once confirmed on-chain.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">Withdrawals</h3>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-medium">Crypto withdrawal</td>
                  <td className="px-4 py-3 text-gray-600">1 USDT per withdrawal</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Network conditions may affect withdrawal fees. The exact fee is always displayed before you confirm.</p>

          {/* Supported Networks */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">Supported Networks</h2>
          <p>The following networks are supported for crypto deposits and withdrawals:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>BNB Smart Chain (BSC)</li>
            <li>Arbitrum</li>
            <li>Celo</li>
            <li>ERC-20 (Ethereum)</li>
            <li>Lisk</li>
            <li>Optimism</li>
            <li>Polygon</li>
            <li>Solana</li>
            <li>TON</li>
            <li>TRC-20 (Tron)</li>
          </ul>

          {/* Fee Summary */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">Fee Summary</h2>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Action</th>
                  <th className="text-left px-4 py-3 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">P2P trade — Advertiser (Merchant)</td>
                  <td className="px-4 py-3 text-gray-600">0.15% of trade value</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">P2P trade — Trader (User)</td>
                  <td className="px-4 py-3 text-gray-600">0.15% of trade value</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">NGN deposit</td>
                  <td className="px-4 py-3 text-gray-600">&#8358;50</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">NGN withdrawal</td>
                  <td className="px-4 py-3 text-gray-600">&#8358;30 + &#8358;50 stamp duty (if above &#8358;10,000)</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">Crypto deposit</td>
                  <td className="px-4 py-3 text-gray-600">Free</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">Crypto withdrawal</td>
                  <td className="px-4 py-3 text-gray-600">1 USDT</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Important Notes */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">Important Notes</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>All fees are displayed before you confirm any action — you will never be charged without first seeing the amount.</li>
            <li>Fees are final and non-refundable once a transaction completes successfully.</li>
            <li>Kynettic may update its fee schedule from time to time. Any changes will be communicated before they take effect.</li>
            <li>Kynettic reserves the right to restrict or suspend accounts found abusing the platform, manipulating fees, or exploiting system behaviour.</li>
          </ul>

          <p className="text-gray-500 italic mt-6">
            Kynettic does not provide financial or investment advice. Cryptocurrency trading carries risk. Please trade responsibly.
          </p>

          <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-400">
            Kynettic &mdash; Fee Schedule &mdash; Last Updated April 3, 2026
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/" className="text-[#4472B7] font-semibold hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </article>
    </main>
  );
}
