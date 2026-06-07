"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";
import { ArrowLeft } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandler";

export default function EditContactDetailsPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const u = user as Record<string, any> || {};

  const [phone, setPhone] = useState(u.phone || u.phone_number || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setError("Please enter a phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await userService.updateProfile({ phone_number: phone });
      const updatedProfile = await userService.getProfile();
      updateUser(updatedProfile?.data || updatedProfile);
      setSuccess("Contact details updated successfully!");
      setTimeout(() => router.push("/personal-details"), 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-10">
      <button onClick={() => router.push("/personal-details")} className="flex items-center gap-2 text-[#555] mb-4 cursor-pointer">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-xl font-bold mb-6 text-[#1D3B53]">Edit Contact Details</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">{success}</div>}
        
        <div className="mb-6">
          <label className="text-sm font-semibold text-[#1D3B53] block mb-2">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
            placeholder="Enter phone number"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
