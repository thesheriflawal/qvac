import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Privacy Policy - Kynettic",
  description: "Kynettic Privacy Policy — Effective April 3, 2026",
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-gray-500 font-medium mb-6">
          Effective Date: April 3, 2026 &nbsp;•&nbsp; Version 1.0
        </p>

        <div className="space-y-4 text-gray-700 leading-relaxed mb-8">
          <p>
            Kynettic respects your privacy and is committed to protecting the personal data you share with us. This Privacy Policy explains how we collect, use, store, share, and protect your personal data (&ldquo;Personal Data&rdquo;) when you use the Kynettic platform — including account registration, KYC identity verification, peer-to-peer trading, fiat and cryptocurrency deposits and withdrawals, internal transfers, and the referral programme.
          </p>
          <p>
            By creating an account or using the Platform, you consent to this Policy. We may update this Policy periodically and will notify you of material changes through the Platform or via email.
          </p>
        </div>

        <div className="mb-8">
          <Link href="/" className="text-[#4472B7] font-semibold hover:underline">
            &larr; Back to Home
          </Link>
        </div>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">

          {/* 1. Data We Collect */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">1. Data We Collect</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.1 Account Registration</h3>
          <p>When you register on Kynettic, we collect the following information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><span className="font-semibold">Email address</span> — used for account creation, verification, and platform communications</li>
            <li><span className="font-semibold">Password</span> — stored securely and never held or transmitted in plaintext</li>
            <li><span className="font-semibold">Referral code (optional)</span> — links your account to a referring user for the purposes of the referral programme</li>
          </ul>
          <p>
            Your identity is confirmed via a one-time verification code sent to your email address before your account is activated.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.2 User Profile</h3>
          <p>Following registration, you may complete your profile with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Full name (first, middle, last)</li>
            <li><span className="font-semibold">Username</span> — displayed on P2P trade listings only if you opt in</li>
            <li><span className="font-semibold">Profile photo</span> — uploaded to and hosted on Cloudinary</li>
            <li>Country, date of birth, and phone number</li>
          </ul>
          <p>
            Your full name is never disclosed to counterparties on P2P trades. You retain full control over whether your username appears publicly on trade listings.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.3 Identity Verification (KYC)</h3>
          <p>
            To unlock the full suite of Platform features — including higher trading limits, fiat withdrawals, and cryptocurrency withdrawals — you must complete identity verification across up to three progressive tiers.
          </p>

          <p className="font-semibold mt-4">Tier 1 — BVN Verification</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Bank Verification Number (BVN)</li>
            <li>First name, last name, and date of birth (used to match BVN records)</li>
          </ul>
          <p className="text-sm text-gray-500 italic">Your BVN is transmitted directly to Dojah, our identity verification partner, solely for verification purposes. Kynettic does not store your BVN.</p>

          <p className="font-semibold mt-4">Tier 2 — NIN Verification</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>National Identification Number (NIN)</li>
          </ul>
          <p className="text-sm text-gray-500 italic">Your NIN is transmitted directly to Dojah for verification purposes. Kynettic does not store your NIN.</p>

          <p className="font-semibold mt-4">Tier 3 — Facial and Address Verification</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Selfie photograph — captured for liveness detection and identity matching</li>
            <li>Proof of address (utility bill) — uploaded as an image file</li>
            <li>Residential address — street, city, state, and country</li>
          </ul>
          <p className="text-sm text-gray-500 italic">Your selfie and utility bill are transmitted to Dojah, our identity verification partner, for facial liveness analysis and address confirmation.</p>
          <p>You must be 18 years of age or older to complete KYC verification.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.4 Security Settings</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><span className="font-semibold">Transaction PIN (6 digits)</span> — required to authorise withdrawals, transfers, and trades. Stored securely and never held in plaintext</li>
            <li><span className="font-semibold">Two-factor authentication (2FA)</span> — a time-based one-time password (TOTP) compatible with Google Authenticator and equivalent apps, used to verify your identity during login and sensitive operations</li>
          </ul>
          <p>Cryptocurrency withdrawals, fiat withdrawals, and internal transfers all require your PIN and, where enabled, your 2FA code.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.5 Wallet and Transaction Data</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Wallet balances — per supported currency, updated in real time</li>
            <li>Locked balances — funds held in escrow during active P2P trades</li>
            <li>Transaction history — type, amount, pre- and post-balance, timestamp, reference ID, and description</li>
            <li>On-chain deposit addresses — generated via Quidax and associated with your account by network and currency</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.6 Fiat Deposits and Withdrawals (NGN)</h3>
          <p>For Nigerian Naira (NGN) operations via our banking partner Nom Bank:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Virtual bank account — a unique NGN virtual account assigned to your profile</li>
            <li>Saved bank accounts — account number, account name, and bank name (for recurring withdrawals)</li>
            <li>Withdrawal records — recipient account number, bank name, amount, processing fees, applicable stamp duty, status, and reference</li>
          </ul>
          <p>When you initiate a fiat withdrawal, your name, destination account number, bank code, and transfer amount are transmitted to Nom Bank to execute the transfer.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.7 Cryptocurrency Deposits and Withdrawals</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Deposit addresses — generated per user per network and currency combination via Quidax</li>
            <li>Withdrawal records — destination wallet address, currency, network, amount, fee, transaction hash, and status</li>
            <li>Blockchain transaction hashes — recorded for all confirmed on-chain deposits and completed withdrawals</li>
          </ul>
          <p>For cryptocurrency account management, your email address and name are shared with Quidax, our cryptocurrency infrastructure partner, to create a sub-account linked to your Kynettic identity.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.8 P2P Trading</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Advertisements — currency, pricing type (fixed or relative market-based), min/max order limits, quantity, trade direction (buy/sell), and optionally your username</li>
            <li>Orders — buyer and seller identifiers, order number, currency, amount, price, total value, applicable fees, and order status</li>
            <li>Fees — trade fees per order by role (maker/taker), including fee amount, percentage, and trade volume</li>
          </ul>
          <p>Your counterparty on a trade sees only your username (if enabled) and the relevant order details. Full name and other personal data are never disclosed to counterparties.</p>
          <p>Real-time cryptocurrency prices are fetched from CoinGecko using your selected currency pair. No personal data is transmitted to CoinGecko.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.9 Internal Transfers</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Sender and recipient identifiers, currency, amount, and timestamp are recorded for all transfers</li>
            <li>Recipients can be identified by their Platform UID or registered email address</li>
            <li>Both PIN and 2FA (if enabled) are required to authorise any transfer</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.10 Referral Programme</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Referral code — a unique 6-character code assigned at registration</li>
            <li>Referral relationships — referrer identity, referral status, and reward timestamps</li>
            <li>Point transactions — points earned per completed P2P trade, including trade volume (USD equivalent) and the triggering order</li>
            <li>Quarterly claims — fiat (NGN) rewards claimed per quarter, including points redeemed and amount received</li>
          </ul>
          <p>Referral leaderboard entries display masked email addresses only (e.g., j***@example.com).</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.11 Device, Network, and Session Data</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>IP address — logged for rate limiting and abuse detection</li>
            <li>Device type — used to scope sessions (e.g., mobile vs. desktop)</li>
            <li>Session tokens — issued at login to maintain your authenticated session; sessions expire automatically after a period of inactivity</li>
            <li>Request identifiers — unique references attached to API requests for internal diagnostics</li>
          </ul>
          <p>Failed login attempts are monitored per account and per IP address. Repeated consecutive failures will result in a temporary access suspension as a security measure.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.12 Communications</h3>
          <p>Transactional emails are delivered via Resend and include:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>OTP codes for registration, login, password reset, and email address changes</li>
            <li>Security alerts</li>
            <li>Trade and transaction notifications (where email notifications are enabled)</li>
          </ul>
          <p>Your email address and message content are transmitted to Resend solely for delivery. In-app notifications are stored in our database and include a title, body, read status, and timestamp.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.13 Platform Reviews</h3>
          <p>If you submit a platform review, we collect your name, email address, and review content.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">1.14 OAuth Login (Google and Apple)</h3>
          <p>
            If you sign in via Google or Apple, we receive an identity token from the respective provider. This token is verified by our servers to confirm your identity. We store only the verified email address returned and do not transmit your data back to Google or Apple beyond the verification request.
          </p>

          {/* 2. Why We Collect */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">2. Why We Collect Your Data</h2>
          <p>We collect and process Personal Data to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Create and manage your account</li>
            <li>Verify your identity and comply with KYC and AML regulatory requirements</li>
            <li>Process P2P trades, cryptocurrency and fiat deposits and withdrawals, and internal transfers</li>
            <li>Detect and prevent fraud, unauthorised access, and platform abuse</li>
            <li>Enforce Platform rules, including duplicate identity detection via blind indexing</li>
            <li>Resolve disputes between trading counterparties</li>
            <li>Deliver transactional emails, in-app notifications, and security alerts</li>
            <li>Calculate and distribute referral rewards</li>
            <li>Retrieve real-time market prices for P2P trade pricing</li>
            <li>Maintain comprehensive audit trails for regulatory reporting</li>
            <li>Improve Platform features, performance, and the overall user experience</li>
            <li>Fulfil any legal obligations or respond to lawful government requests</li>
          </ul>

          {/* 3. Data Storage and Protection */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">3. Data Storage and Protection</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.1 Encryption at Rest</h3>
          <p>The table below summarises how different categories of data are stored and protected:</p>

          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Data Category</th>
                  <th className="text-left px-4 py-3 font-semibold">How It Is Protected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">Bank Verification Number (BVN)</td>
                  <td className="px-4 py-3 text-gray-600">Not stored by Kynettic; transmitted to Dojah for verification only</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">National Identification Number (NIN)</td>
                  <td className="px-4 py-3 text-gray-600">Not stored by Kynettic; transmitted to Dojah for verification only</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">Password</td>
                  <td className="px-4 py-3 text-gray-600">Stored as a secure one-way hash; never held in plaintext</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">Transaction PIN</td>
                  <td className="px-4 py-3 text-gray-600">Stored as a secure hash; never held in plaintext</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">KYC documents (selfie, utility bill)</td>
                  <td className="px-4 py-3 text-gray-600">Stored securely in cloud storage</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium">All other personal data</td>
                  <td className="px-4 py-3 text-gray-600">Stored in an encrypted database</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.2 Encryption in Transit</h3>
          <p>
            All communications between your device and the Platform are encrypted using TLS/SSL. The Platform enforces HTTP Strict Transport Security (HSTS), preventing browsers from establishing unencrypted connections. All database connections are also established over encrypted channels.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.3 Access Controls</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>BVN and NIN are transmitted directly to Dojah for verification and are never stored by Kynettic or returned in any API response</li>
            <li>Access to Personal Data within our systems is restricted on a need-to-know basis</li>
            <li>Session tokens expire automatically upon inactivity</li>
            <li>All withdrawal and transfer operations require PIN authentication and, where applicable, 2FA</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.4 Data Retention</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Transaction and KYC data is retained for a minimum of five (5) years in compliance with Nigerian financial regulations and AML requirements</li>
            <li>Session data expires automatically after a period of inactivity</li>
            <li>Account data is retained for the duration your account is active or as required by applicable law</li>
            <li>Upon account deletion, personal data is soft-deleted and may be anonymised or fully purged subject to applicable retention obligations</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.5 Your Responsibilities</h3>
          <p>
            You are responsible for maintaining the confidentiality of your password, PIN, 2FA codes, and wallet addresses. Kynettic will never request your password or PIN outside of the Platform. Please report any suspected unauthorised access to your account immediately through the Platform&apos;s support channels.
          </p>

          {/* 4. Disclosure */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">4. Disclosure of Personal Data</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.1 Third-Party Service Providers</h3>
          <p>We share your Personal Data with the following third-party service providers, strictly as necessary for Platform operations:</p>

          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-[#151E31] text-white">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Service Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Data Shared</th>
                  <th className="text-left px-4 py-3 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium align-top">Dojah (Identity Verification)</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Full name, date of birth, BVN, NIN, selfie photograph, utility bill, residential address</td>
                  <td className="px-4 py-3 text-gray-600 align-top">KYC identity verification, liveness detection, facial matching, and address confirmation. BVN and NIN are transmitted directly to Dojah and are not stored by Kynettic.</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium align-top">Quidax (Cryptocurrency Infrastructure)</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Email address, first name, last name, phone number (optional); withdrawal: destination address, amount, currency, reference ID</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Cryptocurrency sub-account creation, on-chain deposit address generation, and cryptocurrency withdrawal processing</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium align-top">Nom Bank (Banking Partner)</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Full name, account reference; withdrawal: account number, account name, bank code, amount</td>
                  <td className="px-4 py-3 text-gray-600 align-top">NGN virtual account creation and fiat bank transfer execution</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium align-top">Document Storage Provider</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Selfie image, utility bill image</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Secure KYC document storage and hosting</td>
                </tr>
                <tr className="bg-gray-50 hover:bg-gray-100">
                  <td className="px-4 py-3 font-medium align-top">Market Data Provider</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Currency pair (no personal data)</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Real-time cryptocurrency price feeds</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium align-top">Email Delivery Provider</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Email address, message content</td>
                  <td className="px-4 py-3 text-gray-600 align-top">Transactional email delivery</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>All third-party providers are engaged under data processing agreements that require them to handle your data in accordance with applicable privacy laws.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.2 Legal and Regulatory Disclosure</h3>
          <p>We may disclose Personal Data to regulatory authorities, law enforcement agencies, or courts where required by Nigerian law or applicable international regulations, including for:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Anti-money laundering (AML) and counter-terrorism financing (CTF) compliance</li>
            <li>Responses to lawful subpoenas, court orders, or government demands</li>
            <li>Investigation of fraud, identity theft, or criminal activity</li>
            <li>National security or public safety requirements</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.3 Dispute Resolution</h3>
          <p>
            Where a P2P trade dispute arises, Platform administrators may access order records, wallet transaction histories, and, where relevant, identity information to investigate and resolve the dispute fairly.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.4 Cross-Border Data Transfers</h3>
          <p>
            Your data may be processed by our third-party providers in jurisdictions outside Nigeria. We ensure that appropriate safeguards are in place for all cross-border transfers in compliance with applicable data protection law.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.5 Anonymised and Aggregated Data</h3>
          <p>
            We may share aggregated, anonymised data — such as platform-wide trading volume statistics — with research or analytics partners. Such data cannot be used to identify you personally.
          </p>

          {/* 5. Cookies */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">5. Cookies and Tracking Technologies</h2>
          <p>
            Kynettic does not use browser cookies for session management. Authentication is handled via secure tokens stored client-side. We may use standard web analytics tools to monitor Platform performance and usage patterns. These tools do not collect your password, PIN, wallet addresses, or financial data.
          </p>

          {/* 6. Your Rights */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">6. Your Rights</h2>
          <p>Subject to applicable Nigerian and international data protection laws, you have the following rights with respect to your Personal Data:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><span className="font-semibold">Right of Access</span> — request a copy of the Personal Data we hold about you</li>
            <li><span className="font-semibold">Right to Rectification</span> — update or correct inaccurate profile information via the Platform</li>
            <li><span className="font-semibold">Right to Erasure</span> — request account deletion; certain data may be retained for legal compliance purposes</li>
            <li><span className="font-semibold">Right to Restriction</span> — request that we limit the processing of your data in specific circumstances</li>
            <li><span className="font-semibold">Right to Object</span> — opt out of marketing communications via your notification settings</li>
            <li><span className="font-semibold">Right to Data Portability</span> — request a structured export of your data in a machine-readable format</li>
            <li><span className="font-semibold">Right to Complain</span> — lodge a complaint with Kynettic or with the relevant data protection authority</li>
          </ul>
          <p>To exercise any of these rights, please contact us through the Platform. We may require identity verification before fulfilling your request.</p>

          {/* 7. Minors */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">7. Minors</h2>
          <p>
            Users must be 18 years of age or older to use Kynettic. We do not knowingly collect data from individuals under the age of 16. If we identify that an account belongs to a minor, we will immediately restrict or permanently delete that account. If you believe a minor has registered on the Platform, please contact us without delay.
          </p>

          {/* 8. Lawful Processing */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">8. Lawful Processing Without Consent</h2>
          <p>We may collect and process Personal Data without your explicit consent where required or permitted by law, including in circumstances involving:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>National security, defence, or law enforcement obligations</li>
            <li>Public health or substantial public interest</li>
            <li>Criminal investigation or legal proceedings</li>
            <li>Protection of life or property</li>
            <li>Platform fraud prevention, abuse detection, or regulatory compliance</li>
          </ul>

          {/* 9. Contact */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">9. Contact Us</h2>
          <p>
            For questions, access requests, complaints, or concerns relating to your Personal Data, please contact us through the Platform&apos;s support channels.
          </p>
          <p>We are committed to responding to all enquiries in a timely and transparent manner.</p>

          <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-400">
            Kynettic &mdash; Privacy Policy &mdash; Effective April 3, 2026
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
