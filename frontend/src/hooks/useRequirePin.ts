"use client";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";

/**
 * Returns a guard function. Call it instead of opening the PIN modal directly.
 * - If user clearly has a PIN (is_pin_enabled === true in cached data) → opens modal immediately.
 * - If unsure (stale/missing flag) → fetches fresh profile to confirm before deciding.
 * - If confirmed no PIN → redirects to /pin-setup?returnTo=<current path>.
 */
export function useRequirePin() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return async function requirePin(openModal: () => void) {
    // Fast path: cached data already shows PIN enabled
    if ((user as any)?.is_pin_enabled) {
      openModal();
      return;
    }

    // Slow path: cached data is stale or missing — fetch fresh profile
    try {
      const r = await userService.getProfile();
      const profile = r?.data || r;
      if (profile?.is_pin_enabled) {
        await updateUser(profile); // keep cache in sync
        openModal();
        return;
      }
    } catch {
      // Network error — fall through to redirect
    }

    // Confirmed: no PIN set
    router.push(`/pin-setup?returnTo=${encodeURIComponent(pathname)}`);
  };
}
