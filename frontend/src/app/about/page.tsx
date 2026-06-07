"use client";
export default function AboutPage() {
  return (
    <article className="prose prose-gray max-w-3xl mx-auto p-6">
      <p className="text-sm text-gray-400 mb-1">Company</p>
      <h1 className="!mb-3">About Kynettic</h1>
      <p>Kynettic is a wallet‑to‑wallet trading platform designed to remove the delays and uncertainty of traditional P2P. Our Autopay engine executes trades the moment you place an order—escrow, deductions, and settlement happen instantly inside your account.</p>
      <h2>What we do</h2>
      <p>We provide secure in‑app wallets for both fiat and crypto, and an automated P2P marketplace. When you buy, funds are deducted from your fiat balance and the crypto appears immediately. When you sell, crypto is deducted and fiat is credited back on the spot. No chats, no uploads, no manual confirmations.</p>
      <h2>How it works</h2>
      <ol><li>Fund your fiat or crypto wallet inside Kynettic.</li><li>Create an order or pick a marketplace ad.</li><li>Autopay clears the trade instantly and updates both balances.</li></ol>
      <h2>Why it&apos;s different</h2>
      <ul><li>Instant settlement for buys and sells—no waiting.</li><li>Automated ads keep running, even when you&apos;re offline.</li><li>Secure custodial wallets with risk controls and clear audit trails.</li><li>Simple, transparent fees shown before you confirm.</li></ul>
      <h2>Where to start</h2>
      <p>Ready to trade? Go to the P2P market to <a href="/p2p?tab=buy">buy</a> or <a href="/p2p?tab=sell">sell</a>, or request <a href="/bulk-coins-purchase">bulk liquidity</a> for larger orders.</p>
    </article>
  );
}
