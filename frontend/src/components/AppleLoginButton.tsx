"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errorHandler";

declare global {
  interface Window { AppleID?: any; }
}

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

interface AppleLoginButtonProps {
  mode: "login" | "signup";
}

function AppleLoginButtonInner({ mode }: AppleLoginButtonProps) {
  const { loginWithApple } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const referralCode = params.get("ref") || undefined;

  useEffect(() => {
    // Load Apple JS SDK
    if (document.getElementById("apple-auth-sdk")) return;
    const script = document.createElement("script");
    script.id = "apple-auth-sdk";
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => {
      window.AppleID?.auth.init({
        clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!,
        scope: "name email",
        redirectURI: `${window.location.origin}/auth/apple/callback`,
        usePopup: true,
      });
    };
    document.head.appendChild(script);
  }, []);

  const handleAppleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      if (!window.AppleID) throw new Error("Apple Sign In is not available. Please try again.");
      console.log("[Apple] Initiating sign in...");
      const response = await window.AppleID.auth.signIn();
      console.log("[Apple] Sign in response:", JSON.stringify(response));
      const idToken = response?.authorization?.id_token;
      if (!idToken) throw new Error("Apple sign-in failed. No token received.");
      console.log("[Apple] Got id_token, calling backend...");
      await loginWithApple(idToken);
      router.push("/wallet");
    } catch (err: any) {
      console.error("[Apple] Error:", err);
      console.error("[Apple] Error detail:", JSON.stringify(err));
      // User cancelled the popup — don't show an error
      if (err?.error === "popup_closed_by_user" || err?.error === "user_cancelled_authorize") {
        setLoading(false);
        return;
      }
      setError(err?.error || getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleAppleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-black text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-900 active:bg-gray-800 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <AppleIcon />
        )}
        <span>{loading ? "Signing in..." : mode === "login" ? "Continue with Apple" : "Sign up with Apple"}</span>
      </button>
      {error && (
        <div className="text-red-500 text-xs text-center bg-red-50 border border-red-100 rounded-lg px-3 py-2 w-full">
          {error}
        </div>
      )}
    </div>
  );
}

export default function AppleLoginButton({ mode }: AppleLoginButtonProps) {
  if (!process.env.NEXT_PUBLIC_APPLE_CLIENT_ID) return null;
  return <Suspense><AppleLoginButtonInner mode={mode} /></Suspense>;
}
