"use client";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function ChangePinSuccessPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-16">
        <div className="w-24 h-24 rounded-2xl bg-[#EBF4FF] flex items-center justify-center mb-6">
          <Lock size={50} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-[#1D3B53] mb-2 text-center">Pin Changed Successfully</h1>
        <p className="text-sm text-[#8E8E93] text-center mb-10">Your pin has been successfully changed.</p>
        <button
          onClick={() => router.push("/profile")}
          className="w-full max-w-sm bg-primary text-white font-bold py-4 rounded-xl cursor-pointer"
        >
          Okay
        </button>
      </div>
    </div>
  );
}
