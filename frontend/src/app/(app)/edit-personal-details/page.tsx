"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";
import { ArrowLeft } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandler";

export default function EditPersonalDetailsPage() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const u = user as Record<string, any> || {};

  const [firstName, setFirstName] = useState(u.first_name || "");
  const [lastName, setLastName] = useState(u.last_name || "");
  const [otherName, setOtherName] = useState(u.other_name || "");
  const [middleName, setMiddleName] = useState(u.middle_name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      setError("Please fill in all details");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await userService.updateProfile({
        first_name: firstName,
        last_name: lastName,
        ...(otherName ? { other_name: otherName } : {}),
        middle_name: middleName,
      });
      const updatedProfile = await userService.getProfile();
      updateUser(updatedProfile?.data || updatedProfile);
      setSuccess("Profile updated successfully!");
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
      <h1 className="text-xl font-bold mb-6 text-[#1D3B53]">Edit Personal Details</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">{success}</div>}
        
        <div className="mb-4">
          <label className="text-sm font-semibold text-[#1D3B53] block mb-2">First Name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
            placeholder="Enter first name"
          />
        </div>
        <div className="mb-4">
          <label className="text-sm font-semibold text-[#1D3B53] block mb-2">Middle Name (Optional)</label>
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
            placeholder="Enter middle name"
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-semibold text-[#1D3B53] block mb-2">Other Name (Optional)</label>
          <input
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
            placeholder="Enter other name"
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-semibold text-[#1D3B53] block mb-2">Last Name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-primary"
            placeholder="Enter last name"
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
