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
};

export default nextConfig;
