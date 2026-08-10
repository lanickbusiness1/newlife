import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "GDIZ Smart Service Node — concept interne",
  description: "Concept interne AfrIAgenesis, sans pilote ni rattachement institutionnel revendiqué.",
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
