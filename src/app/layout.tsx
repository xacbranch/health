import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "./nav";
import { StoreHydrator } from "@/components/StoreHydrator";

export const metadata: Metadata = {
  title: "NERV // MAGI HEALTH OS",
  description: "Personal Health Operating System — MAGI Interface",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-black text-text scanlines noise-overlay vignette">
        <div className="flex min-h-screen hex-grid">
          <StoreHydrator />
          <Nav />
          <main className="flex-1 ml-0 md:ml-52 min-h-screen relative overflow-hidden min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
