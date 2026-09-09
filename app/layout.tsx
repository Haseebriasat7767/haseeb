import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { Cursor } from '@/components/effects/Cursor';
import { GrainOverlay } from '@/components/effects/GrainOverlay';
import { Footer } from '@/components/navigation/Footer';
import { Header } from '@/components/navigation/Header';
import { StructuredData } from '@/components/seo/StructuredData';
import { SITE } from '@/lib/constants/site';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ['luxury real estate', 'architecture', 'residence', 'interactive experience'],
  authors: [{ name: SITE.name }],
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    // No `images` here on purpose: `app/opengraph-image.tsx` supplies the
    // card and Next wires it up, including the absolute URL and the
    // cache-busting hash. Listing one here would override it with the SVG
    // that no social crawler will render.
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
  robots: { index: true, follow: true },
  // Canonical on every page. Without it a link with a `?step=` on it is a
  // separate URL to a crawler, and this site hands those out deliberately —
  // the walkthrough's whole sharing story is a deep link to one framing.
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-svh antialiased">
        <StructuredData />
        <a
          href="#main"
          className="focus:bg-alabaster focus:text-obsidian sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:text-xs focus:tracking-[0.2em] focus:uppercase"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <GrainOverlay />
        <Cursor />
      </body>
    </html>
  );
}
