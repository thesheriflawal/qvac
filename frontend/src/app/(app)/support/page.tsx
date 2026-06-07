"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, ChevronRight, ChevronDown } from "lucide-react";
import { p2pService } from "@/services/p2p.service";

const faqs = [
  {
    question: "How fast is P2P trading on Kynettic?",
    answer: "Trades are instant — funds are deducted and credited immediately. No waiting for confirmations.",
  },
  {
    question: "Can I trade without a verified account?",
    answer: "You can start trading with just your BVN as that is our least verification.",
  },
  {
    question: "Do I need to wait for buyer/seller confirmation?",
    answer: "No. Autopay handles everything automatically, so there's no manual approval or waiting.",
  },
  {
    question: "Can I withdraw after every trade?",
    answer: "Yes, withdrawals are available at any time.",
  },
  {
    question: "Are disputes possible on the p2p market?",
    answer: "Almost never. Kynettic P2P trades are final and automated, so no buyer/seller conflicts arise.",
  },
  {
    question: "Can I cancel a trade after placing an order?",
    answer: "No. Once a trade is placed, Autopay executes it instantly, so all trades are final.",
  },
  {
    question: "What happens if my wallet balance is insufficient?",
    answer: "Orders cannot be placed. Ensure your Fiat Wallet or Crypto Wallet has sufficient funds before creating a Buy or Sell order.",
  },
  {
    question: "Can I trade multiple tokens at the same time?",
    answer: "Yes. Each token in your wallet can be used to create separate Buy or Sell ads simultaneously.",
  },
  {
    question: "How are P2P fees calculated?",
    answer: "Fees are transparent and automatic, deducted instantly from the transaction. No hidden charges or manual payments.",
  },
  {
    question: "Does Kynettic P2P work 24/7?",
    answer: "Yes. Since it's fully automated, you can trade anytime, day or night, without waiting for counterparties.",
  },
  {
    question: "Can I use both fiat and crypto for trading at the same time?",
    answer: "Absolutely. Your Fiat Wallet is used for Buy orders and your Crypto Wallet for Sell orders, all seamlessly via Autopay.",
  },
  {
    question: "How do I check my trade history?",
    answer: "Go to Wallet → P2P Transactions to see all your completed trades, fees, and balances.",
  },
  {
    question: "Is my crypto safe in the wallet?",
    answer: "Yes. All Kynettic wallets are internal, secured, and fully integrated, so funds are never exposed to external risks during trading.",
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);

  useEffect(() => {
    p2pService.getCommunityLinks()
      .then(res => {
        const links: any[] = res?.data || [];
        const wa = links.find((l: any) => (l.platform || "").toLowerCase() === "whatsapp");
        setWhatsappLink(wa?.url || process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || null);
      })
      .catch(() => {
        setWhatsappLink(process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || null);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/profile")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Help & Support</h1>
      </div>

      {/* Contact options */}
      <div className="space-y-3 mb-8">
        <a
          href="mailto:support@kynettic.com"
          className="flex items-center gap-4 bg-white rounded-2xl px-4 py-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 rounded-full bg-[#F5F9FF] flex items-center justify-center shrink-0">
            <Mail size={22} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1D3B53]">Email Support</p>
            <p className="text-xs text-[#8E8E93] mt-0.5">Get help via email</p>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </a>

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-white rounded-2xl px-4 py-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-full bg-[#F5F9FF] flex items-center justify-center shrink-0">
              <MessageCircle size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#1D3B53]">Live Chat</p>
              <p className="text-xs text-[#8E8E93] mt-0.5">Chat with our support team</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </a>
        )}
      </div>

      {/* FAQ section */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#E0E0E0]" />
          <span className="text-[#8E8E93] font-bold text-sm">Frequently Asked Questions</span>
          <div className="flex-1 h-px bg-[#E0E0E0]" />
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`rounded-xl overflow-hidden border transition-colors ${activeIndex === index ? "border-primary bg-[#EBF4FF]" : "border-gray-100 bg-white"}`}
            >
              <button
                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                className="w-full px-4 py-4 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-sm font-semibold text-[#1D3B53] pr-3">{faq.question}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-primary transition-transform duration-200 ${activeIndex === index ? "rotate-180" : ""}`}
                />
              </button>
              {activeIndex === index && (
                <div className="px-4 pb-4 text-sm text-[#555] leading-relaxed border-t border-primary/10 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
