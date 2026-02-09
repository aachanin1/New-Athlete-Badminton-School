import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LoadingBar } from "@/components/shared/loading-bar";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "New Athlete Badminton School",
  description: "โรงเรียนสอนแบดมินตัน New Athlete School — สอนแบดมินตันสำหรับเด็กและผู้ใหญ่ 7 สาขาทั่วกรุงเทพฯ",
  icons: {
    icon: "/logo new-athlete-school.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
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
