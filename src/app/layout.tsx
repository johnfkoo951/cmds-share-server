import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://share.cmdspace.work'),
  title: 'CMDS Share',
  description: 'Instant note sharing for Obsidian, governed by CMDSPACE.',
  icons: { icon: 'https://cmdspace.work/assets/logos/cmds-logo-round.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
