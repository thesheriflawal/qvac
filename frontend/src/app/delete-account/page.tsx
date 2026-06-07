"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const API_BASE = "/api/v1";

type Step = "login" | "2fa" | "confirm" | "deleting" | "done" | "error";

export default function DeleteAccountPage() {
  const [step, setStep] = useState<Step>("login");

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 2FA
  const [totpCode, setTotpCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");

  // Derived state
  const [accessToken, setAccessToken] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [tfaLoading, setTfaLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tfaError, setTfaError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // ── Step 1: Login ────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, device_type: "web" }),
      });

      const json = await res.json();

      // 2FA required — exchange pre_auth_token + TOTP next
      if (res.status === 202) {
        const pat =
          json.data?.pre_auth_token ??
          json.data?.preAuthToken ??
          "";
        if (!pat) {
          setLoginError("2FA is required but no pre-auth token was returned.");
          setLoginLoading(false);
          return;
        }
        setPreAuthToken(pat);
        setStep("2fa");
        setLoginLoading(false);
        return;
      }

      if (!res.ok || !json.success) {
        setLoginError(
          json.message || json.error || "Login failed. Please check your credentials."
        );
        setLoginLoading(false);
        return;
      }

      // 200 — 2FA disabled, full tokens returned
      const token =
        json.data?.access_token ??
        json.data?.accessToken ??
        "";

      if (!token) {
        setLoginError("Login succeeded but no access token was returned.");
        setLoginLoading(false);
        return;
      }

      setAccessToken(token);
      setStep("confirm");
    } catch {
      setLoginError("Network error — could not reach the server. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Step 2: 2FA verify ───────────────────────────────────────────────────────
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTfaLoading(true);
    setTfaError("");

    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_auth_token: preAuthToken, code: totpCode }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setTfaError(
          json.message || json.error || "Invalid or expired code. Please try again."
        );
        setTfaLoading(false);
        return;
      }

      const token =
        json.data?.access_token ??
        json.data?.accessToken ??
        "";

      if (!token) {
        setTfaError("Verification succeeded but no access token was returned.");
        setTfaLoading(false);
        return;
      }

      setPreAuthToken("");
      setAccessToken(token);
      setStep("confirm");
    } catch {
      setTfaError("Network error — could not reach the server. Please try again.");
    } finally {
      setTfaLoading(false);
    }
  };

  // ── Step 3: Delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setStep("deleting");

    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      // Clear token regardless of outcome
      setAccessToken("");

      if (res.ok) {
        setStep("done");
      } else {
        const json = await res.json().catch(() => ({}));
        setDeleteError(
          json.message || json.error || `Deletion failed (HTTP ${res.status}).`
        );
        setStep("error");
      }
    } catch {
      setAccessToken("");
      setDeleteError("Network error — could not reach the server. Please try again.");
      setStep("error");
    }
  };

  const restart = () => {
    setStep("login");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setTotpCode("");
    setPreAuthToken("");
    setAccessToken("");
    setLoginError("");
    setTfaError("");
    setDeleteError("");
  };

  // ── Shared header ────────────────────────────────────────────────────────────
  const pageHeader = (
    <div className="bg-[#151E31] py-6 px-4">
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
          <Image src="/KynetticLogo.png" alt="Kynettic" width={32} height={32} className="w-8 h-8 object-contain" />
          <span>Kynettic</span>
        </Link>
      </div>
    </div>
  );

  // ── Spinner ──────────────────────────────────────────────────────────────────
  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );

  return (
    <main className="bg-white min-h-screen font-dmsans">
      {pageHeader}

      <article className="max-w-lg mx-auto px-4 md:px-8 py-12 md:py-16">

        {/* ── STEP: LOGIN ─────────────────────────────────────────────────────── */}
        {step === "login" && (
          <>
            <div className="mb-8">
              <Link href="/" className="text-[#4472B7] text-sm font-semibold hover:underline">
                &larr; Back to Home
              </Link>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Delete Your Account
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Sign in to verify your identity. We&apos;ll ask you to confirm before permanently deleting your account and all associated data.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loginLoading}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4472B7] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    disabled={loginLoading}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#4472B7] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading || !email || !password}
                className="w-full bg-[#151E31] hover:bg-[#1e2d47] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loginLoading ? <><Spinner /> Signing in…</> : "Continue"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-400">
              This action is permanent and cannot be undone. All your data, wallets, and trade history will be erased.
            </p>
          </>
        )}

        {/* ── STEP: 2FA ───────────────────────────────────────────────────────── */}
        {step === "2fa" && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mb-4">
                <svg className="w-7 h-7 text-[#4472B7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Two-Factor Authentication
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your account has 2FA enabled. Enter the 6-digit code from your authenticator app to continue.
              </p>
            </div>

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label htmlFor="totp" className="block text-sm font-semibold text-gray-700 mb-1">
                  Authenticator Code
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  disabled={tfaLoading}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#4472B7] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                />
              </div>

              {tfaError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>{tfaError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={tfaLoading || totpCode.length !== 6}
                className="w-full bg-[#151E31] hover:bg-[#1e2d47] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {tfaLoading ? <><Spinner /> Verifying…</> : "Verify & Continue"}
              </button>

              <button
                type="button"
                onClick={restart}
                disabled={tfaLoading}
                className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
              >
                ← Back to login
              </button>
            </form>
          </>
        )}

        {/* ── STEP: CONFIRM ───────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Are you absolutely sure?
              </h2>
              <p className="text-gray-500 text-sm">
                Signed in as <span className="font-semibold text-gray-700">{email}</span>
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 space-y-2">
              <p className="text-sm font-semibold text-red-800">This will permanently delete:</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc pl-4">
                <li>Your account and profile information</li>
                <li>Your KYC verification and identity documents</li>
                <li>Your wallet balances and linked bank accounts</li>
                <li>Your P2P trade history and advertisements</li>
                <li>Your referral relationships and reward points</li>
              </ul>
              <p className="text-xs text-red-600 pt-1 font-medium">
                Transaction records may be retained for up to 5 years to comply with Nigerian financial regulations.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDelete}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors"
              >
                Yes, permanently delete my account
              </button>
              <button
                onClick={restart}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg px-6 py-3 text-sm border border-gray-200 transition-colors"
              >
                Cancel — keep my account
              </button>
            </div>
          </>
        )}

        {/* ── STEP: DELETING ──────────────────────────────────────────────────── */}
        {step === "deleting" && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <svg className="animate-spin h-10 w-10 text-red-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-gray-600 font-medium">Deleting your account…</p>
            <p className="text-sm text-gray-400">Please do not close this page.</p>
          </div>
        )}

        {/* ── STEP: DONE ──────────────────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center text-center py-10 gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Deleted</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
                Your Kynettic account and personal data have been permanently removed. We&apos;re sorry to see you go.
              </p>
            </div>
            <Link
              href="/"
              className="mt-2 inline-block bg-[#151E31] hover:bg-[#1e2d47] text-white font-semibold rounded-lg px-8 py-3 text-sm transition-colors"
            >
              Back to Home
            </Link>
          </div>
        )}

        {/* ── STEP: ERROR ─────────────────────────────────────────────────────── */}
        {step === "error" && (
          <div className="flex flex-col items-center text-center py-10 gap-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Deletion Failed</h2>
              <p className="text-gray-500 text-sm leading-relaxed max-w-sm">{deleteError}</p>
            </div>
            <button
              onClick={restart}
              className="mt-2 bg-[#151E31] hover:bg-[#1e2d47] text-white font-semibold rounded-lg px-8 py-3 text-sm transition-colors"
            >
              Try Again
            </button>
            <Link href="/" className="text-sm text-[#4472B7] hover:underline">
              Back to Home
            </Link>
          </div>
        )}

      </article>
    </main>
  );
}
