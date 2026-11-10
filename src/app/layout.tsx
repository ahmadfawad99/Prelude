import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { TopLoader } from "@/components/top-loader";
import { AppSplash } from "@/components/app-splash";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prelude — from lead to plan",
  description: "Prelude: turn leads and sources into analysis, work breakdowns, and costed project plans.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="nb-dark">
      <body>
        <AppSplash />
        <TopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
