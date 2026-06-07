"use client";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { AdsProvider } from "@/context/AdsContext";
import { QvacProvider } from "@/context/QvacContext";
import { GoogleOAuthProvider } from "@react-oauth/google";

export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const inner = (
    <AuthProvider>
      <WalletProvider>
        <AdsProvider>
          <QvacProvider>{children}</QvacProvider>
        </AdsProvider>
      </WalletProvider>
    </AuthProvider>
  );

  if (!googleClientId) return inner;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {inner}
    </GoogleOAuthProvider>
  );
}
