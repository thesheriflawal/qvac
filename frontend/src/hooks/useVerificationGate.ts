"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycService } from "@/services/kyc.service";
import { useAuth } from "@/context/AuthContext";

const LS_KEY = "kyc_tier";
const CACHE_TTL_MS = 60_000;

// Module-level in-memory layer (avoids repeated localStorage reads within a session)
let _cachedTier: number | null = null;
let _cacheTimestamp: number = 0;

const readPersistedTier = (): number | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tier === "number") return parsed.tier;
  } catch { /* localStorage unavailable (SSR or private mode) */ }
  return null;
};

const getCachedTier = (): number | null => {
  if (_cachedTier !== null && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _cachedTier;
  return null;
};

export const setCachedTier = (tier: number) => {
  _cachedTier = tier;
  _cacheTimestamp = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify({ tier })); } catch { /* ignore */ }
};

export const invalidateKYCCache = () => {
  _cachedTier = null;
  _cacheTimestamp = 0;
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
};

export const useVerificationGate = () => {
  const router = useRouter();
  const [showGate, setShowGate] = useState(false);
  const [isVerified, setIsVerified] = useState(() => {
    // 1. In-memory cache (fastest — same session, no re-fetch needed yet)
    const cached = getCachedTier();
    if (cached !== null) return cached >= 1;
    // 2. localStorage (survives refresh — no flash for verified users)
    const persisted = readPersistedTier();
    if (persisted !== null) return persisted >= 1;
    return false;
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (getCachedTier() !== null) return false;
    // If localStorage has a value, show content immediately but still revalidate quietly
    if (readPersistedTier() !== null) return false;
    return true;
  });

  useEffect(() => {
    // In-memory cache is still fresh — nothing to do
    if (getCachedTier() !== null) { setIsLoading(false); return; }

    let cancelled = false;
    const checkKYC = async () => {
      try {
        const res = await kycService.getKYCStatus();
        const data = res?.data;
        if (!data || cancelled) return;
        const rawTier = data.tier;
        let tier = 0;
        if (typeof rawTier === "number") tier = rawTier;
        else if (typeof rawTier === "string") tier = parseInt(rawTier.replace("tier", ""), 10) || 0;
        setCachedTier(tier); // writes to both in-memory and localStorage
        if (!cancelled) setIsVerified(tier >= 1);
      } catch {
        // API failed — keep whatever localStorage/state already has
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    checkKYC();
    return () => { cancelled = true; };
  }, []);

  const requireVerification = useCallback((onPass?: () => void): boolean => {
    if (isLoading) return false;
    if (isVerified) { onPass?.(); return true; }
    setShowGate(true);
    return false;
  }, [isVerified, isLoading]);

  const handleVerifyNow = useCallback(() => {
    setShowGate(false);
    router.push("/verification-dashboard");
  }, [router]);

  return { isVerified, isLoading, showGate, setShowGate, requireVerification, handleVerifyNow };
};
