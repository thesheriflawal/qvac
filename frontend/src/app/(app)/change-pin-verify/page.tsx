"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function ChangePinVerifyPage() {
  const router = useRouter();
  const [pin, setPin] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { setLoading(true); setError(""); try { await securityService.changePin(pin, "", ""); router.push("/change-pin-new"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.push("/change-pin")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Verify Current PIN</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="Current PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button onClick={handle} disabled={loading||pin.length<4} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Verifying...":"Continue"}</button>
      </div>
    </div>
  );
}
