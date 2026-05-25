import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Watch Dashboard",
  description: "Telegram 摘要 + 台股 K 線觀測",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
