"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { kycService } from "@/services/kyc.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
const TITLES: Record<string,string> = { "tier1-basic": "Basic Verification", "tier1-id": "ID Verification", "tier1-selfie": "Selfie Verification", "tier2-address": "Address Verification", "tier2-proof": "Proof of Address", "tier3-advanced": "Advanced Verification" };
export default function KYCPage() {
  const router = useRouter();
  const title = TITLES["tier1-selfie"] || "Verification";
  const [value, setValue] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await kycService.submitTier1({ first_name: "", last_name: "", username: "", phone_number: "", date_of_birth: "", identity_type: "bvn", bvn: value }); router.push("/verification-dashboard"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.push("/tier1-basic")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">{title}</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="Enter required information" className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Submitting...":"Submit"}</button>
      </div>
    </div>
  );
}
