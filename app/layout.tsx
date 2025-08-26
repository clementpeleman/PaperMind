import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactNode } from "react";
import { Toaster } from '@/components/ui/sonner'
import { SupabaseAuthProvider } from '@/contexts/SupabaseAuthContext'
import { QueryProvider } from '@/providers/query-client-provider'
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
  title: "PaperMind",
  description: "AI-powered research paper analysis and management",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <SupabaseAuthProvider>
            <main>{children}</main>
            <Toaster />
          </SupabaseAuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
