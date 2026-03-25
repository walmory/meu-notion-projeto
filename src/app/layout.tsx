import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { UserProvider } from "@/contexts/UserContext";

export const metadata: Metadata = {
  title: "OPTA Workspace",
  description: "Your modern workspace",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      style={{ backgroundColor: "#191919", colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col bg-[#191919] text-white" suppressHydrationWarning>
        <UserProvider>
          {children}
          <CommandPalette />
          <Toaster theme="dark" position="bottom-right" />
        </UserProvider>
      </body>
    </html>
  );
}
