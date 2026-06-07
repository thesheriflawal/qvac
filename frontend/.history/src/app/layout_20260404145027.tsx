import type { Metadata } from "next";
import { Roboto, Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://kynettic.com"),
  title: "Kynettic — The Future of Safe P2P Crypto Trading",
  description: "No chats. No screenshots. No scams. Just automated, compliant, and instant P2P crypto settlements.",
  openGraph: {
    title: "Kynettic — The Future of Safe P2P Crypto Trading",
    description: "No chats. No screenshots. No scams. Just automated, compliant, and instant P2P crypto settlements.",
    images: [{ url: "/KynetticLogo.png", width: 512, height: 512, alt: "Kynettic Logo" }],
    url: "https://kynettic.com/",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${outfit.variable} ${dmSans.variable} antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
