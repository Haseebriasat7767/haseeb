import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/constants/site';

/**
 * The social card, rendered as a PNG at request time.
 *
 * ## Why this replaces the SVG
 *
 * `public/opengraph-image.svg` was a perfectly good card that almost nothing
 * would display. Facebook, LinkedIn and X all decline to rasterise SVG for
 * `og:image` — the crawler fetches it, fails to decode it, and falls back to
 * whatever it can scrape off the page, which on a site whose content is a
 * WebGL canvas is nothing at all. Every share of this site has been a bare
 * link with no picture.
 *
 * `ImageResponse` renders on the edge and is cached, so this costs one render
 * per deploy rather than one per share.
 */
export const runtime = 'edge';
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'linear-gradient(160deg, #14161a 0%, #0a0a0b 55%, #1a1410 100%)',
        padding: '84px 100px',
        position: 'relative',
      }}
    >
      {/* The same measured vertical rhythm the site's own layout uses. */}
      {[200, 400, 600, 800, 1000].map((x) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            width: 1,
            height: 630,
            background: 'rgba(244,241,236,0.06)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 300,
          width: 96,
          height: 1,
          background: '#b08d57',
        }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: 104,
          letterSpacing: 38,
          color: '#f4f1ec',
          fontFamily: 'serif',
        }}
      >
        {SITE.name}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 26,
          fontSize: 27,
          letterSpacing: 7,
          textTransform: 'uppercase',
          color: '#9a9691',
        }}
      >
        {SITE.tagline}
      </div>
    </div>,
    size,
  );
}
