import type { Metadata } from "next";
import { Host_Grotesk, EB_Garamond } from "next/font/google";
import "./globals.css";

const hostGrotesk = Host_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-host-grotesk" });
const ebGaramond = EB_Garamond({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-eb-garamond" });

export const metadata: Metadata = {
  title: "Roma Community Map",
  description: "Hartă GIS a comunităților, antreprenorilor și suprapunerii cu portofoliile partenerilor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${hostGrotesk.variable} ${ebGaramond.variable}`}>
      <body>{children}</body>
    </html>
  );
}
