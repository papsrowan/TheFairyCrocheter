// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT RACINE — Entry point de l'application
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Gestion Commerciale",
    template: "%s | Gestion Commerciale",
  },
  description: "Application de gestion commerciale ERP/POS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gestion Commerciale",
  },
  robots: {
    index: false,    // App privée — ne pas indexer
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/TFC0.png" type="image/png" />
        <link rel="apple-touch-icon" href="/TFC0.png" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
