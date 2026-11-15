import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SEMBOYAN, URL_SITUS } from "@/lib/situs";
import "./globals.css";

// font di-host sendiri lewat next/font: tanpa request ke Google saat runtime, tanpa lompatan tata letak
const fontUi = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-jetbrains" });

const DESKRIPSI =
  `${SEMBOYAN} Graf investigasi tender pertahanan dan keamanan Indonesia: 44 ribu paket, 11 ribu vendor, ` +
  "satker Kemhan, TNI, Polri, Bakamla, BSSN, dan BIN. Klik vendor, lihat siapa pembelinya, berapa nilainya, dan pola statistik apa yang muncul.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITUS),
  title: "Garuda Ledger — graf tender pertahanan Indonesia",
  description: DESKRIPSI,
  keywords: ["Indonesia", "pengadaan", "tender", "LPSE", "pertahanan", "Kemhan", "TNI", "Polri", "graf", "link analysis", "open contracting", "OCDS"],
  authors: [{ name: "Avalon2222", url: "https://github.com/Avalon2222" }],
  openGraph: {
    title: "Garuda Ledger",
    description: SEMBOYAN,
    url: URL_SITUS,
    siteName: "Garuda Ledger",
    type: "website",
    locale: "id_ID",
  },
  twitter: { card: "summary_large_image", title: "Garuda Ledger", description: SEMBOYAN },
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full ${fontUi.variable} ${fontMono.variable}`}>
      <body className="h-full">
        {children}
        {/* Vercel Web Analytics: tanpa cookie. Cuma dipasang di build Vercel; di lokal/CI jalur itu tidak ada. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
