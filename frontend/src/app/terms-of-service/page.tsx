import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms of Use - Kynettic",
  description: "Kynettic Terms of Use — Effective April 3, 2026",
};

export default function TermsOfServicePage() {
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
          Terms of Use
        </h1>
        <p className="text-gray-500 font-medium mb-1">
          Effective Date: April 3, 2026 &nbsp;•&nbsp; Version 1.0
        </p>

        <div className="mt-6 mb-8 space-y-4 text-gray-700 leading-relaxed">
          <p>
            Please read these Terms of Use (&ldquo;Terms&rdquo;) carefully before using the Kynettic platform. By registering an account or using the Platform in any way, you confirm that you have read, understood, and agree to be legally bound by these Terms in their entirety.
          </p>
          <div className="border-l-4 border-red-500 bg-red-50 px-5 py-4 rounded-r-lg">
            <p className="font-bold text-red-700 uppercase tracking-wide">
              IF YOU DO NOT AGREE TO THESE TERMS IN FULL, YOU MUST IMMEDIATELY CEASE ALL USE OF THE PLATFORM.
            </p>
          </div>
          <p>
            Your continued use of the Platform following any update to these Terms constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div className="mt-6 mb-8">
          <Link href="/" className="text-[#4472B7] font-semibold hover:underline">
            &larr; Back to Home
          </Link>
        </div>

        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">

          {/* I. Definitions */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">I. Definitions</h2>
          <p>As used in these Terms, the following terms have the meanings set out below:</p>
          <ul className="space-y-3 pl-0 list-none">
            <li><span className="font-semibold">&ldquo;Platform&rdquo;</span> means the Kynettic automated peer-to-peer trading platform, including all associated web interfaces, mobile applications, and services operated by Kynettic.</li>
            <li><span className="font-semibold">&ldquo;Autopay&rdquo;</span> means the Platform&apos;s automated internal settlement engine that executes, clears, and finalises all trades instantaneously between Internal Wallets, without manual intervention or external payment instruction.</li>
            <li><span className="font-semibold">&ldquo;Order&rdquo;</span> means any buy or sell instruction submitted by a User through the Platform that, upon execution, results in an irreversible transfer of funds between Internal Wallets.</li>
            <li><span className="font-semibold">&ldquo;Settlement&rdquo;</span> means the final, automated, and irrevocable transfer of funds from one Internal Wallet to another upon Order execution.</li>
            <li><span className="font-semibold">&ldquo;Internal Wallet&rdquo;</span> means the custodial balance held by Kynettic on a User&apos;s behalf for a specific currency, from which all Platform transactions are funded and settled.</li>
            <li><span className="font-semibold">&ldquo;KYC&rdquo;</span> means Know Your Customer identity verification, encompassing BVN verification (Tier 1), NIN verification (Tier 2), and facial liveness and address verification (Tier 3).</li>
            <li><span className="font-semibold">&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;</span> means any individual who accesses or uses the Platform.</li>
            <li><span className="font-semibold">&ldquo;Kynettic,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;</span> means the operator of the Platform.</li>
          </ul>

          {/* II. Nature of the Platform */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">II. Nature of the Platform</h2>
          <p>
            Kynettic is a technology company, not a bank, financial institution, broker, investment adviser, or money services business. The Platform provides an automated matching and settlement engine that facilitates the exchange of digital assets and fiat currency entirely within its Internal Wallet infrastructure.
          </p>
          <p>
            Kynettic does not hold fiat currency in a traditional bank account on your behalf. All balances reflected in your Internal Wallet represent a digital record of your claim against Platform-held funds, subject to these Terms.
          </p>
          <p>
            Kynettic does not provide investment advice. Nothing on the Platform constitutes a recommendation to buy, sell, or hold any digital asset or fiat currency position.
          </p>

          {/* III. KYC */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">III. KYC Verification and Account Eligibility</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.1 Mandatory Verification</h3>
          <p>
            All Users must complete KYC verification to the applicable tier before accessing trading, withdrawal, and transfer features. Kynettic reserves the right to restrict access to any feature pending satisfactory identity verification.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.2 Accuracy of Information</h3>
          <p>
            All information submitted during registration and KYC must be true, accurate, current, and complete. You represent and warrant that the identity documents, biometric data, and government identification numbers you submit are your own and lawfully obtained. Submission of false, fraudulent, or third-party identity information is a material breach of these Terms and may constitute a criminal offence under applicable law.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.3 Ongoing Compliance</h3>
          <p>
            Kynettic reserves the right to request additional verification at any time, including for regulatory compliance, fraud prevention, or risk management purposes. Failure to provide requested documentation within a reasonable period may result in account restriction or termination.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.4 Single Account Obligation</h3>
          <p>
            Each User may maintain only one account. Creating multiple accounts to circumvent restrictions, verification requirements, or these Terms is expressly prohibited and will result in immediate suspension of all associated accounts.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.5 Age Requirement</h3>
          <p>
            You must be at least 18 years of age to use the Platform. Kynettic does not knowingly provide services to persons under 18.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">3.6 Jurisdictional Eligibility</h3>
          <p>
            You are solely responsible for ensuring that your use of the Platform is lawful in your jurisdiction. Kynettic makes no representation that the Platform is available or appropriate for use in all locations.
          </p>

          {/* IV. Autopay */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">IV. The Autopay Settlement System</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.1 Fully Automated Settlement</h3>
          <p>
            All trades on the Platform are executed and settled instantaneously and automatically through the Autopay system. There are no manual steps, no payment confirmations, no screenshot submissions, and no human intervention in the settlement process.
          </p>
          <div className="border-l-4 border-[#4472B7] bg-blue-50 px-5 py-4 rounded-r-lg my-4">
            <p className="font-bold text-[#4472B7] uppercase tracking-wide">
              FROM THE MOMENT AN ORDER IS MATCHED AND EXECUTED, THE TRANSFER OF FUNDS IS FINAL, IMMEDIATE, AND IRREVOCABLE.
            </p>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.2 No External Transfers</h3>
          <p>Kynettic does not support, require, facilitate, or accept any form of:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>External bank transfers between Users</li>
            <li>Third-party payment instructions or receipts</li>
            <li>Transfers from accounts not registered under your verified identity</li>
            <li>Payment via mobile money, payment applications, or any off-platform mechanism</li>
            <li>Manual release of cryptocurrency or fiat balances</li>
          </ul>
          <p>
            Any attempt to coordinate external payments in connection with Platform trades is a violation of these Terms and will be treated as potential fraud.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.3 Irreversibility of Executed Orders</h3>
          <div className="border-l-4 border-red-500 bg-red-50 px-5 py-4 rounded-r-lg my-4">
            <p className="font-bold text-red-700 uppercase tracking-wide">
              ONCE AN ORDER IS EXECUTED ON THE PLATFORM, IT CANNOT BE REVERSED, CANCELLED, RECALLED, DISPUTED, OR REFUNDED UNDER ANY CIRCUMSTANCES.
            </p>
          </div>
          <p>This finality is absolute and applies regardless of:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>User error — including wrong currency, wrong amount, or wrong counterparty</li>
            <li>Change of mind or intent after execution</li>
            <li>Market price movements occurring after the Order is placed</li>
            <li>Technical misunderstanding of the Platform&apos;s mechanics</li>
          </ul>
          <p>
            You are solely responsible for verifying all Order details — including currency, amount, and price — prior to submission. Kynettic accepts no liability for losses arising from erroneously placed Orders.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.4 Price Lock</h3>
          <p>
            The price of any Order is fixed and locked at the exact moment the Order is submitted and matched. Market price movements occurring after Order submission have no effect on the locked price. You acknowledge and accept this mechanism as a fundamental feature of the Platform.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">4.5 Escrow and Locked Balances</h3>
          <p>
            Upon placement of an Order, the relevant funds are immediately locked in escrow within your Internal Wallet and are unavailable for any other purpose until the Order is executed or cancelled (where cancellation remains available). Upon execution, locked funds are transferred to the counterparty irreversibly.
          </p>

          {/* V. User Obligations */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">V. User Obligations and Conduct</h2>
          <p>As a condition of using the Platform, you agree to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintain a sufficient verified balance in your Internal Wallet before placing any Order</li>
            <li>Refrain from manipulating prices, exploiting system latency, engaging in wash trading, generating artificial volume, or taking advantage of pricing errors or technical vulnerabilities</li>
            <li>Refrain from using automated bots, scripts, or non-human interfaces to interact with the Platform unless expressly authorised by Kynettic in writing</li>
            <li>Refrain from impersonating another User, using another person&apos;s identity documents, or misrepresenting your identity in any way</li>
            <li>Refrain from conducting or facilitating any activity that constitutes money laundering, terrorist financing, sanctions evasion, fraud, or any other unlawful activity</li>
            <li>Conduct all trading activity exclusively within the Platform; off-platform arrangements settled outside Kynettic&apos;s Internal Wallet system are strictly prohibited</li>
            <li>Ensure that all fiat withdrawals are made to bank accounts held in your verified name, and that all cryptocurrency withdrawals are made to wallets you own and control</li>
          </ul>

          {/* VI. Prohibited Conduct */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">VI. Prohibited Conduct</h2>
          <p>
            The following conduct is expressly prohibited and will result in immediate account suspension, permanent ban, and may be reported to relevant authorities:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fraudulent or suspicious trading patterns, including circular trading or coordinated manipulation</li>
            <li>Repeated Order cancellations indicative of system abuse or bad-faith trading</li>
            <li>Submission of false or fraudulent KYC documents or identity information</li>
            <li>Using another person&apos;s government identification or biometric data</li>
            <li>Operating multiple accounts, whether individually or in coordination with others</li>
            <li>Exploiting price discrepancies, system errors, or latency for financial gain outside normal trading activity</li>
            <li>Directing or soliciting external fiat payments from counterparties</li>
            <li>Threatening, harassing, or coercing counterparties</li>
            <li>Any conduct designed to circumvent the Autopay settlement mechanism</li>
          </ul>

          {/* VII. Fees */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">VII. Fees</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">7.1 Fee Disclosure</h3>
          <p>
            Transaction fees are calculated and displayed to you before an Order is executed or an advertisement is created. By proceeding, you consent to the applicable fee.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">7.2 Automatic Deduction</h3>
          <p>
            Fees are automatically and irrevocably deducted from your Internal Wallet at the time of Settlement. Fee deductions form part of the final, irreversible Settlement and are not subject to refund.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">7.3 Fee Changes</h3>
          <p>
            Kynettic reserves the right to adjust fee rates at any time. Updated fee schedules will be communicated through the Platform and will apply to Orders placed after the effective date of the change. Orders executed prior to a fee change are governed by the fee rate in effect at the time of execution.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">7.4 Fiat Withdrawal Fees</h3>
          <p>
            Fiat withdrawals are subject to applicable processing fees and Nigerian stamp duty, which are disclosed prior to withdrawal confirmation and deducted automatically upon execution.
          </p>

          {/* VIII. Dispute Resolution */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">VIII. Dispute Resolution</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">8.1 Scope of Disputes</h3>
          <p>
            Because all trades are settled instantly and automatically through Autopay, disputes relating to payment non-receipt, payment delays, or external transfer failures are not recognised by the Platform and will not be investigated. No external payment occurs on the Platform; accordingly, no payment dispute can arise from Platform trades.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">8.2 Recognised Dispute Categories</h3>
          <p>Kynettic will only investigate the following categories of dispute:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Unauthorised access to your account by a third party</li>
            <li>Demonstrable technical errors in wallet balance calculation or transaction recording</li>
            <li>Platform system failures that materially prevented Order execution</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">8.3 Evidence Requirements</h3>
          <p>
            Users raising a dispute must provide all reasonably requested evidence. Kynettic reserves the right to require documentary, technical, or other supporting evidence as a condition of investigation.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">8.4 Platform Determination is Final</h3>
          <div className="border-l-4 border-[#4472B7] bg-blue-50 px-5 py-4 rounded-r-lg my-4">
            <p className="font-bold text-[#4472B7] uppercase tracking-wide">
              THE PLATFORM&apos;S DETERMINATION ON ANY INVESTIGATED DISPUTE IS FINAL AND BINDING. Kynettic&apos;s decision constitutes the last internal avenue of recourse.
            </p>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">8.5 No Liability for Correctly Executed Transactions</h3>
          <p>
            Kynettic bears no liability, and no dispute shall be entertained, in respect of losses arising from correctly executed Orders, regardless of the User&apos;s intent, error, or misunderstanding of the Platform&apos;s mechanics.
          </p>

          {/* IX. Account Suspension */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">IX. Account Suspension and Termination</h2>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">9.1 Grounds for Suspension or Termination</h3>
          <p>
            Kynettic may, at its sole discretion and without prior notice, freeze, restrict, suspend, or permanently terminate your account — and withhold or delay access to your Internal Wallet balance — in circumstances including but not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Actual or suspected breach of these Terms</li>
            <li>Actual or suspected fraudulent, manipulative, or unlawful activity</li>
            <li>Receipt of a direction from a regulatory authority, law enforcement agency, or court</li>
            <li>Reasonable belief that your account has been compromised or is being operated by an unauthorised party</li>
            <li>An AML or counter-terrorism financing screening match or suspicious activity flag</li>
            <li>Failure to complete requested KYC verification within the required timeframe</li>
          </ul>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">9.2 Funds During Suspension</h3>
          <p>
            Where funds are held during a suspension, Kynettic will retain those funds pending resolution of the circumstances giving rise to the suspension. Kynettic is not liable for losses incurred as a result of a suspension carried out in good faith.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6">9.3 Survival of Obligations</h3>
          <p>
            Permanent termination of an account does not extinguish any obligations you owe to Kynettic arising prior to termination, including any liability for losses caused by your breach of these Terms.
          </p>

          {/* X. Risk Disclosure */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">X. Risk Disclosure</h2>
          <p>
            Digital asset prices are highly volatile. The value of any cryptocurrency held in your Internal Wallet may increase or decrease substantially over a short period of time. You acknowledge and accept that you trade entirely at your own risk.
          </p>
          <p>
            Kynettic does not guarantee the value, price stability, liquidity, or future performance of any digital asset or fiat currency available on the Platform.
          </p>
          <p>
            Regulatory changes in your jurisdiction may affect your ability to hold, trade, or withdraw digital assets. You are solely responsible for compliance with all applicable tax and regulatory obligations in your jurisdiction.
          </p>
          <p>
            System downtime, network congestion, or third-party infrastructure failures may temporarily affect Platform availability. Kynettic is not liable for losses arising from events beyond its reasonable control.
          </p>

          {/* XI. Limitation of Liability */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">XI. Limitation of Liability</h2>
          <div className="border-l-4 border-gray-400 bg-gray-50 px-5 py-4 rounded-r-lg my-4 space-y-3">
            <p className="font-bold text-gray-700 uppercase tracking-wide text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KYNETTIC&apos;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIM ARISING FROM OR RELATED TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE AMOUNT OF FEES PAID BY YOU TO KYNETTIC IN THE THIRTY (30) DAYS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
            <p className="font-bold text-gray-700 uppercase tracking-wide text-sm">
              KYNETTIC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, OR LOSS OF OPPORTUNITY, WHETHER ARISING IN CONTRACT, TORT, OR OTHERWISE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
          </div>
          <p>
            Nothing in these Terms excludes liability that cannot be excluded under applicable law, including liability for fraud or wilful misconduct.
          </p>

          {/* XII. Amendments */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">XII. Amendments</h2>
          <p>
            Kynettic may amend these Terms at any time. Amendments will be published on the Platform with an updated effective date. You are responsible for reviewing the Terms periodically. Your continued use of the Platform following publication of amended Terms constitutes your acceptance of those amendments. If you do not agree to any amendment, you must cease use of the Platform immediately.
          </p>

          {/* XIII. Governing Law */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">XIII. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts of Nigeria, unless otherwise required by applicable law.
          </p>

          {/* XIV. Entire Agreement */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">XIV. Entire Agreement</h2>
          <p>
            These Terms, together with the Privacy Policy and any other policies published by Kynettic on the Platform, constitute the entire agreement between you and Kynettic with respect to your use of the Platform and supersede all prior or contemporaneous agreements, representations, or understandings.
          </p>

          {/* XV. Acceptance */}
          <h2 className="text-2xl font-bold text-gray-900 mt-10">XV. Acceptance</h2>
          <p>By accessing or using the Platform, you irrevocably confirm that:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>You have read and fully understood these Terms</li>
            <li>You agree to be legally bound by these Terms</li>
            <li>All transactions executed through Autopay are instantaneous, automated, and irrevocable</li>
            <li>You accept sole responsibility for all Orders you place and their consequences</li>
            <li>You use the Platform entirely at your own risk</li>
          </ol>

          <div className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-400">
            Kynettic &mdash; Terms of Use &mdash; Effective April 3, 2026
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            href="/"
            className="text-[#4472B7] font-semibold hover:underline"
          >
            &larr; Back to Home
          </Link>
        </div>
      </article>
    </main>
  );
}
