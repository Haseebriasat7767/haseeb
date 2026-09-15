import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // three.js ships ESM-only sources; transpiling keeps the R3F stack
  // tree-shakeable and avoids duplicated three instances in the bundle.
  transpilePackages: ['three'],
  // The residence used to be four separate pages; it is now one
  // (`/residence`) with those sections folded in as tabs, matching the
  // tower's own single-page pattern. Permanent redirects rather than
  // deleting the routes outright, so a bookmark or an indexed search
  // result still resolves — Next passes the incoming query string through
  // automatically, so `/experience?space=foyer` still opens on that space.
  async redirects() {
    return [
      { source: '/experience', destination: '/residence?tab=explore', permanent: true },
      { source: '/floor-plan', destination: '/residence?tab=plan', permanent: true },
      { source: '/gallery', destination: '/residence?tab=gallery', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // HSTS only on HTTPS — Vercel serves HTTPS by default, local dev ignores it
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      // Cache static assets aggressively, but never the HTML or API
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
