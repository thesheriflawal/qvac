"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { userService } from "@/services/user.service";
import { getErrorMessage } from "@/utils/errorHandler";
import StatusModal from "@/components/modals/StatusModal";

const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{12,}$/;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ visible: boolean; type: "success" | "error"; title: string; message: string }>({
    visible: false, type: "error", title: "", message: "",
  });

  const handleChange = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setStatus({ visible: true, type: "error", title: "Error", message: "Please fill in all fields" }); return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ visible: true, type: "error", title: "Error", message: "New passwords do not match" }); return;
    }
    if (newPassword.length < 12) {
      setStatus({ visible: true, type: "error", title: "Error", message: "Password must be at least 12 characters long" }); return;
    }
    if (!PW_REGEX.test(newPassword)) {
      setStatus({ visible: true, type: "error", title: "Weak Password", message: "Password must include uppercase, lowercase, a number, and a special character (!@#$%^&*)" }); return;
    }
    setLoading(true);
    try {
      await userService.changePassword(oldPassword, newPassword);
      setStatus({ visible: true, type: "success", title: "Success", message: "Password changed successfully" });
    } catch (e) {
      setStatus({ visible: true, type: "error", title: "Error", message: getErrorMessage(e) });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100 mb-6">
        <button onClick={() => router.push("/security-settings")} className="p-1 cursor-pointer">
          <ArrowLeft size={22} className="text-[#1D3B53]" />
        </button>
        <span className="font-bold text-lg text-[#1D3B53]">Change Password</span>
        <div className="w-8" />
      </div>

      <div className="space-y-5 px-1">
        {[
          { label: "Old Password", value: oldPassword, set: setOldPassword, show: showOld, toggle: () => setShowOld(v => !v) },
          { label: "New Password", value: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v) },
          { label: "Confirm New Password", value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
        ].map(field => (
          <div key={field.label}>
            <label className="block text-sm text-gray-500 mb-2">{field.label}</label>
            <div className="flex items-center border border-[#E1E1E1] rounded-lg px-4 bg-white">
              <input
                type={field.show ? "text" : "password"}
                value={field.value}
                onChange={e => field.set(e.target.value)}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="flex-1 py-4 text-base text-[#1D3B53] outline-none bg-transparent placeholder-[rgba(142,142,147,0.4)]"
              />
              <button type="button" onClick={field.toggle} className="p-1 text-[#888] cursor-pointer">
                {field.show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleChange}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl cursor-pointer disabled:bg-[#A0B8D0] mt-2"
        >
          {loading ? "Changing..." : "Change Password"}
        </button>
      </div>

      <StatusModal
        visible={status.visible}
        onClose={() => {
          setStatus(s => ({ ...s, visible: false }));
          if (status.type === "success") router.push("/security-settings");
        }}
        type={status.type}
        title={status.title}
        message={status.message}
      />
    </div>
  );
}
