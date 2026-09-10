import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/constants/site';

/**
 * Lets a phone add this to the home screen with a real icon and theme
 * colour, rather than a generic globe. `icon.svg` alone covers the
 * browser tab; iOS ignores SVG for a home-screen icon and Android wants
 * this file to know it can be installed at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
