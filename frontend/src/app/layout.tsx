import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeFier",
  description: "AI-Powered Blockchain Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-app text-app-foreground`}
      >
        <Providers>
          {/* Ambient radial backgrounds */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/* Light mode pastel glow */}
            <div className="radial-bg pastel" />
            {/* Dark mode blue-violet glow */}
            <div className="radial-bg violet" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
