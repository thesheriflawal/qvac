"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { securityService } from "@/services/security.service";
import { getErrorMessage } from "@/utils/errorHandler";
import { ArrowLeft } from "lucide-react";
export default function ChangePinNewPage() {
  const router = useRouter();
  const [pin, setPin] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const handle = async () => { if(pin!==confirm){setError("PINs don't match");return;} setLoading(true); setError(""); try { await securityService.changePin("", pin, confirm); router.push("/change-pin-success"); } catch(e) { setError(getErrorMessage(e)); } finally { setLoading(false); } };
  return (
    <div>
      <button onClick={() => router.push("/change-pin-verify")} className="flex items-center gap-2 text-gray-500 mb-4 cursor-pointer"><ArrowLeft size={18}/>Back</button>
      <h1 className="text-xl font-bold mb-6">Set New PIN</h1>
      <div className="bg-white rounded-2xl p-6 max-w-md">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
        <input type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="New PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-3"/>
        <input type="password" maxLength={4} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,""))} placeholder="Confirm PIN" className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-xl p-3 mb-4"/>
        <button onClick={handle} disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50">{loading?"Setting...":"Change PIN"}</button>
      </div>
    </div>
  );
}
