import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "@/redux/store_provider";
import { Toaster } from "sonner";
import { NetworkActivityIndicator } from "@/components/NetworkActivityIndicator";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteTheme } from "@/components/SiteTheme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ricoz | Technology that moves businesses forward",
  description:
    "Ricoz builds digital products and business technology solutions that help companies operate better, grow faster, and scale with confidence.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          <NetworkActivityIndicator />
          <SiteTheme />
          {children}

          <Toaster
            position="top-center"
            theme="system"
            richColors
            toastOptions={{
              style: {
                width: "fit-content",
              },
            }}
          />
          <Analytics />
          <SpeedInsights />
        </StoreProvider>
      </body>
    </html>
  );
}
