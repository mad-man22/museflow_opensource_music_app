import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PersistentPlayer } from "../components/player/PersistentPlayer";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileNav } from "../components/layout/MobileNav";

export const metadata: Metadata = {
  title: "MuseFlow - Premium Music Streaming",
  description: "AI-powered, self-hosted next generation music streaming client powered by YouTube Music and Gemini AI.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased overflow-hidden flex h-screen bg-[#07070a]">
        
        {/* Animated ambient background element */}
        <div className="ambient-glow" />
        
        {/* Sidebar Navigation */}
        <Sidebar />
        <MobileNav />

        {/* Core Main View Deck */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* Main scrollable body */}
          <main className="flex-1 overflow-y-auto pb-48 md:pb-32">
            {children}
          </main>
          
          {/* Persistent global player */}
          <PersistentPlayer />
        </div>
      </body>
    </html>
  );
}

