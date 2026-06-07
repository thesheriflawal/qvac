"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef, Suspense } from "react";
import { getErrorMessage } from "@/utils/errorHandler";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window { google?: any; }
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

interface GoogleLoginButtonProps {
  mode: "login" | "signup";
}

function GoogleLoginButtonInner({ mode }: GoogleLoginButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const referralCode = params.get("ref") || undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = () => {
      if (!window.google?.accounts?.id || !overlayRef.current || !containerRef.current) return;

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setError("Google sign-in failed. Please try again.");
            return;
          }
          setLoading(true);
          try {
            await loginWithGoogle(response.credential, referralCode);
            router.push("/wallet");
          } catch (err: any) {
            setError(getErrorMessage(err));
            setLoading(false);
          }
        },
        ux_mode: "popup",
        cancel_on_tap_outside: false,
      });

      // renderButton is click-triggered and not subject to One Tap suppression/cool-down.
      // We render it into an invisible overlay so our custom button design stays visible.
      window.google.accounts.id.renderButton(overlayRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: containerRef.current.offsetWidth,
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      // SDK may still be loading — poll until ready
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          init();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle, referralCode, router]);

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div ref={containerRef} className="relative w-full">
        {/* Visible custom button — pointer-events disabled so clicks reach the overlay */}
        <button
          type="button"
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer pointer-events-none"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span>{loading ? "Signing in..." : mode === "login" ? "Continue with Google" : "Sign up with Google"}</span>
        </button>
        {/* Invisible Google-rendered button overlay — handles the actual click and popup */}
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-hidden opacity-0"
          aria-hidden="true"
        />
      </div>
      {error && (
        <div className="text-red-500 text-xs text-center bg-red-50 border border-red-100 rounded-lg px-3 py-2 w-full">
          {error}
        </div>
      )}
    </div>
  );
}

export default function GoogleLoginButton({ mode }: GoogleLoginButtonProps) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  return <Suspense><GoogleLoginButtonInner mode={mode} /></Suspense>;
}
