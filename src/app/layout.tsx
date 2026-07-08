import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LoadingBar } from "@/components/shared/loading-bar";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "New Athlete Badminton School",
  description: "โรงเรียนสอนแบดมินตัน New Athlete School — สอนแบดมินตันสำหรับเด็กและผู้ใหญ่ 7 สาขาทั่วกรุงเทพฯ",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body className={`${prompt.className} antialiased`}>
        <Suspense fallback={null}>
          <LoadingBar />
        </Suspense>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
