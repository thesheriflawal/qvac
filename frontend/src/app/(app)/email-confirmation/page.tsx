"use client";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
export default function EmailConfirmationPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
        <Mail size={48} className="text-primary mx-auto mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-sm text-gray-500 mb-6">We&apos;ve sent a confirmation link to your email. Please verify to continue.</p>
        <button onClick={() => router.push("/wallet")} className="w-full bg-primary text-white py-3 rounded-xl font-semibold cursor-pointer">Done</button>
      </div>
    </div>
  );
}
