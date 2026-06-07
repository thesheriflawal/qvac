"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupSuccessPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen w-full bg-white flex flex-col px-6 pt-6 pb-10">
      <h1 className="text-lg font-bold text-center text-black mb-6">Account Created</h1>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-8">
          <Image src="/cuate.png" alt="Account Created" width={250} height={250} className="object-contain" />
        </div>
        <h2 className="text-xl font-bold text-primary text-center mb-3">Account Created successfully</h2>
        <p className="text-sm text-gray-500 text-center leading-relaxed max-w-xs px-2">
          Your account is set up and ready. You can now begin the verification process to unlock full access and start using all core features.
        </p>
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={() => router.push("/verification-dashboard")}
          className="w-full bg-primary text-white font-bold text-base py-4 rounded-lg cursor-pointer"
        >
          Begin Verification
        </button>
        <button
          onClick={() => router.push("/login")}
          className="w-full bg-[#E8EEF7] text-primary font-bold text-base py-4 rounded-lg cursor-pointer"
        >
          Skip to Login
        </button>
      </div>
    </div>
  );
}
