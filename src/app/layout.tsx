import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roma Community Map",
  description: "Hartă GIS a comunităților, antreprenorilor și suprapunerii cu portofoliile partenerilor",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
