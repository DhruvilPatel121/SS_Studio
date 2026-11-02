import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Medo.dev — AI Photo Sharing", template: "%s | Medo.dev" },
  description:
    "AI-powered event photo sharing. Guests find their photos instantly with face recognition.",
  keywords: [
    "photo sharing",
    "event photos",
    "face recognition",
    "AI photos",
    "wedding photos",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "Medo.dev",
    title: "Medo.dev — AI Photo Sharing",
    description:
      "AI-powered event photo sharing. Guests find their photos instantly with face recognition.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Medo.dev — AI Photo Sharing",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
