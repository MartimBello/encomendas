import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Encomendas", template: "%s · Encomendas" },
  description: "Registo e confirmação de encomendas para lojas e cozinha.",
  applicationName: "Encomendas",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Encomendas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4a7366",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-PT" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </body>
    </html>
  );
}
