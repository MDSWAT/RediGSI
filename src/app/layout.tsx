import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";

const hostGrotesk = Host_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-host-grotesk" });

export const metadata: Metadata = {
  title: "Roma Community Map",
  description: "Hartă GIS a comunităților, antreprenorilor și suprapunerii cu portofoliile partenerilor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={hostGrotesk.variable}>
      <body>{children}</body>
    </html>
  );
}
