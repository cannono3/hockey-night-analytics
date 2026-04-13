import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Hockey Night Analytics",
  description: "Live NHL data, visualizations, and AI-powered analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-geist)]">
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
