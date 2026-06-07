"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandler";

export default function Tier1BasicPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [userName, setUserName] = useState("");

  const [dob, setDob] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fn = firstName.trim();
    const ln = lastName.trim();
    const un = userName.trim();
    const ph = phoneNumber.trim();
    const on = otherName.trim();

    if (!fn) { setError("First name is required"); return; }
    if (!ln) { setError("Last name is required"); return; }
    if (!un) { setError("Username is required"); return; }
    if (!dob) { setError("Date of birth is required"); return; }
    if (!ph) { setError("Phone number is required"); return; }

    // Store PII in sessionStorage to pass to BVN step
    sessionStorage.setItem("kyc_personal_data", JSON.stringify({
      first_name: fn,
      last_name: ln,
      ...(on ? { other_name: on } : {}),
      username: un,
      date_of_birth: dob,
      phone_number: ph,
      display_username_on_p2p: true,
    }));
    router.push("/tier1-bvn");
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/verification-dashboard")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <h1 className="text-lg font-bold text-[#1D3B53]">Personal Data</h1>
      </div>

      <p className="text-sm text-[#1D3B53] font-medium mb-5">Enter your details below</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          <div>
            <label className="block text-xs font-bold text-[#1D3B53] mb-1.5 uppercase">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value.trimStart())}
              placeholder="First name"
              className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#1D3B53] mb-1.5 uppercase">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value.trimStart())}
              placeholder="Last name"
              className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Other name (Optional) */}
        <div>
          <label className="block text-xs font-bold text-[#1D3B53] mb-1.5 uppercase">Other Name (Optional)</label>
          <input
            type="text"
            value={otherName}
            onChange={e => setOtherName(e.target.value.trimStart())}
            placeholder="Other name"
            className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs text-[#555] mb-1.5">User Name</label>
          <input
            type="text"
            value={userName}
            onChange={e => setUserName(e.target.value.trimStart())}
            placeholder="Enter username"
            className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-xs text-[#555] mb-1.5">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-xs text-[#555] mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9+\-\s]/g, ""))}
            placeholder="Enter phone number"
            className="w-full h-12 border border-[#E2E8F0] rounded-lg px-3 text-sm text-[#1D3B53] outline-none focus:border-primary"
          />
        </div>

        {/* NDPA 2023 consent */}
        <button
          type="button"
          onClick={() => setConsent(!consent)}
          className="w-full flex items-start gap-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-4 cursor-pointer text-left"
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consent ? "bg-primary border-primary" : "bg-white border-gray-300"}`}>
            {consent && <span className="text-white text-xs font-bold">✓</span>}
          </div>
          <p className="text-xs text-[#555] leading-relaxed">
            I agree that Kynettic may verify my identity using the details above. Your data is processed securely and never sold. View our{" "}
            <a href="/privacy-policy" target="_blank" className="text-primary underline font-medium" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
          </p>
        </button>

        <button
          type="submit"
          disabled={!consent}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-40 mt-2"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
