"use client";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function PasswordChangedPage() {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-center py-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-primary">Password changed</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Image src="/iconletter.png" alt="Kynettic" width={200} height={200} className="mb-10 object-contain" />
        <h2 className="text-xl font-bold text-primary text-center mb-3">Password changed successfully.</h2>
        <p className="text-sm text-gray-400 text-center mb-10 leading-relaxed max-w-xs">
          Your password has been updated. You can continue with your session or sign in again if required.
        </p>
        <Link
          href="/login"
          className="w-full max-w-sm bg-primary text-white font-bold py-4 rounded-lg text-base text-center block"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
