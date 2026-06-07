"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Laptop, QrCode, CheckCircle2 } from "lucide-react";

const DURATION_OPTIONS = ["15 mins", "30 mins", "45 mins", "1 hour"];
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL!;

export default function BulkCoinsPurchasePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("");
  const [duration, setDuration] = useState("30 mins");
  const [durationOpen, setDurationOpen] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const isValid = email.trim() && fullName.trim() && quantity.trim();

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-5">
        <button onClick={() => router.push("/p2p")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-base text-[#1D3B53]">Bulk Coins Purchase</span>
        <div className="w-8" />
      </div>

      <p className="text-sm font-bold text-primary mb-4">Buy Bulk Coins Directly From Us</p>

      {/* Banner Card */}
      <div className="bg-[#EBF4FF] rounded-xl p-5 flex gap-4 mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs font-bold text-primary">KYNETTIC</span>
          </div>
          <p className="font-bold text-sm text-[#1D3B53] mb-2 leading-snug">Buy Bulk Crypto{"\n"}Directly From US</p>
          <div className="space-y-1">
            {["Priority Payment", "Choose Your Rate", "Fast Response"].map(t => (
              <p key={t} className="text-xs text-gray-600">• {t}</p>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 relative">
          <Laptop size={52} className="text-[#1D3B53]" />
          <QrCode size={24} className="text-[#1D3B53] absolute bottom-0 right-0" />
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-3">
        You can now purchase large cryptocurrency amounts straight from us at reliable pricing and quick fulfillment. This feature gives you direct access to verified liquidity, secure processing, and a smoother buying experience without dealing with unstable third party rates.
      </p>
      <p className="text-xs text-gray-600 leading-relaxed mb-5">
        Whether you are topping up for trading, business operations, or long term holding, we make high volume purchases simple and transparent.
      </p>

      <p className="text-base font-bold text-primary mb-1">How To Buy Bulk Coins</p>
      <p className="text-xs text-gray-600 mb-5">Fill the form below to schedule a meeting with our representative and move your order forward.</p>

      {/* Form */}
      <div className="space-y-4">
        {[
          { label: "Email Address", value: email, set: setEmail, type: "email", placeholder: "type something" },
          { label: "Full Name", value: fullName, set: setFullName, type: "text", placeholder: "type something" },
          { label: "Company Name (Optional)", value: companyName, set: setCompanyName, type: "text", placeholder: "type something" },
          { label: "Phone Number (Optional)", value: phone, set: setPhone, type: "tel", placeholder: "type something" },
          { label: "Quantity You Want Supplied", value: quantity, set: setQuantity, type: "text", placeholder: "Minimum of $100k" },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-sm text-gray-500 mb-2">{f.label}</label>
            <input
              type={f.type}
              value={f.value}
              onChange={e => f.set(e.target.value)}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#1D3B53] outline-none focus:border-primary bg-white"
            />
          </div>
        ))}

        {/* Duration Dropdown */}
        <div className="relative">
          <label className="block text-sm text-gray-500 mb-2">Duration</label>
          <button
            onClick={() => setDurationOpen(!durationOpen)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-[#1D3B53] flex justify-between items-center bg-white cursor-pointer"
          >
            {duration}
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {durationOpen && (
            <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => { setDuration(opt); setDurationOpen(false); }}
                  className="w-full px-4 py-3.5 text-sm text-[#1D3B53] border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer text-left"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => isValid && setSuccessModal(true)}
          disabled={!isValid}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:bg-[#A0B8D0] mt-2"
        >
          Submit Form
        </button>
      </div>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="w-20 h-20 rounded-full bg-[#EBF4FF] flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={40} className="text-primary" />
            </div>
            <h3 className="font-bold text-lg text-[#1D3B53] mb-2">Request Submitted!</h3>
            <p className="text-sm text-[#8E8E93] leading-relaxed mb-6">
              Your bulk purchase request has been received. Book an appointment to speak with our representative.
            </p>
            <button
              onClick={() => { setSuccessModal(false); window.open(BOOKING_URL, "_blank"); }}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer mb-3"
            >
              Book Appointment
            </button>
            <button
              onClick={() => setSuccessModal(false)}
              className="w-full text-sm text-[#8E8E93] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
