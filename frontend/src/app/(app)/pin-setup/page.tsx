"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Delete } from "lucide-react";
import { securityService } from "@/services/security.service";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";
import StatusModal from "@/components/modals/StatusModal";

type Field = "create" | "confirm";

function PinDots({ value, isActive }: { value: string; isActive: boolean }) {
  return (
    <div className="flex gap-2.5 justify-center">
      {Array(6).fill(null).map((_, i) => (
        <div
          key={i}
          className={`w-11 h-12 border rounded-lg flex items-center justify-center bg-white ${isActive ? "border-primary" : "border-primary/40"}`}
        >
          <span className="text-xl font-bold text-[#1D3B53]">{value[i] ? "●" : ""}</span>
        </div>
      ))}
    </div>
  );
}

function NumKeypad({ onKey, onDelete }: { onKey: (k: string) => void; onDelete: () => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
  return (
    <div className="grid grid-cols-3 bg-gray-200">
      {keys.map((k, i) => {
        if (k === "") return <div key={i} className="py-5" />;
        if (k === "del") return (
          <button key={i} onClick={onDelete} className="py-5 flex items-center justify-center cursor-pointer active:bg-gray-300">
            <Delete size={22} className="text-[#1D3B53]" />
          </button>
        );
        return (
          <button key={i} onClick={() => onKey(k)} className="py-5 text-xl font-semibold text-[#1D3B53] cursor-pointer active:bg-gray-300 border-r border-t border-gray-300">
            {k}
          </button>
        );
      })}
    </div>
  );
}

function PinSetupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/change-pin-success";
  const { updateUser } = useAuth();
  const [createPin, setCreatePin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [active, setActive] = useState<Field>("create");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ visible: boolean; type: "success" | "error"; title: string; message: string }>({
    visible: false, type: "error", title: "", message: "",
  });

  const handleKey = (val: string) => {
    if (active === "create") {
      if (createPin.length < 6) {
        const updated = createPin + val;
        setCreatePin(updated);
        if (updated.length === 6) setActive("confirm");
      }
    } else {
      if (confirmPin.length < 6) setConfirmPin(prev => prev + val);
    }
  };

  const handleDelete = () => {
    if (active === "create") {
      setCreatePin(p => p.slice(0, -1));
    } else {
      if (confirmPin.length === 0) setActive("create");
      else setConfirmPin(p => p.slice(0, -1));
    }
  };

  const handleContinue = async () => {
    if (createPin.length < 6) {
      setStatus({ visible: true, type: "error", title: "Error", message: "Please create a 6-digit PIN" }); return;
    }
    if (confirmPin.length < 6) {
      setStatus({ visible: true, type: "error", title: "Error", message: "Please confirm your PIN" }); return;
    }
    if (createPin !== confirmPin) {
      setStatus({ visible: true, type: "error", title: "Error", message: "PINs do not match" });
      setConfirmPin(""); setActive("confirm"); return;
    }
    setLoading(true);
    try {
      await securityService.setupPin(createPin, confirmPin);
      await updateUser({ is_pin_enabled: true }); // keep cached user in sync
      router.push(returnTo);
    } catch (e) {
      const msg = getErrorMessage(e) || "Failed to setup PIN. Please try again.";
      setStatus({ visible: true, type: "error", title: "Error", message: msg });
      setCreatePin(""); setConfirmPin(""); setActive("create");
    } finally { setLoading(false); }
  };

  const sections: { field: Field; label: string; subtitle: string; value: string }[] = [
    { field: "create", label: "Create Pin", subtitle: "Create a 6-digit PIN to secure your transactions", value: createPin },
    { field: "confirm", label: "Confirm Pin", subtitle: "Re-enter your PIN to confirm", value: confirmPin },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <button onClick={() => router.push("/security-settings")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Setup Pin</span>
        <div className="w-8" />
      </div>

      {/* PIN Sections */}
      <div className="flex-1 px-5 pt-6 pb-4 space-y-8">
        {sections.map(s => (
          <button key={s.field} onClick={() => setActive(s.field)} className="w-full text-center cursor-pointer">
            <p className="font-bold text-base text-[#1D3B53] mb-1">{s.label}</p>
            <p className="text-xs text-[#8E8E93] mb-4">{s.subtitle}</p>
            <PinDots value={s.value} isActive={active === s.field} />
          </button>
        ))}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:opacity-60"
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </div>

      {/* Keypad */}
      <NumKeypad onKey={handleKey} onDelete={handleDelete} />

      <StatusModal
        visible={status.visible}
        onClose={() => setStatus(s => ({ ...s, visible: false }))}
        type={status.type}
        title={status.title}
        message={status.message}
      />
    </div>
  );
}

export default function PinSetupPage() {
  return <Suspense><PinSetupContent /></Suspense>;
}
