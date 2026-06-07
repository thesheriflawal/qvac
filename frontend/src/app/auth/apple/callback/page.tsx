"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Apple Sign In popup mode posts the response via JS — this page handles the
// rare case where Apple falls back to a form_post redirect instead.
export default function AppleCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // If we land here via redirect (non-popup fallback), send user to wallet.
    // The actual token exchange is handled by the JS SDK callback in AppleLoginButton.
    router.replace("/wallet");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#C5D8ED] to-[#F5F5F5]">
      <div className="w-8 h-8 border-2 border-[#4472B7] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
