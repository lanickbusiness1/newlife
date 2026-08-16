import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AfrIA Recruit™ — Candidate OS™',
  description: 'Le parcours candidat AfrIAgenesis® pour transformer des faits vérifiables en candidatures mieux ciblées et gouvernées.',
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
