'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/report';

/**
 * The last boundary.
 *
 * `app/error.tsx` catches a failure inside a page, but it renders inside the
 * root layout — so if the layout itself throws, there is nothing left to
 * catch it and the visitor gets a blank white page. This replaces the whole
 * document instead, which is why it has to bring its own `<html>` and
 * `<body>`, and why its styling is inline: the stylesheet is part of what may
 * have failed.
 *
 * Deliberately plain. Everything decorative here is another thing that could
 * throw on the way to telling someone the site is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      kind: 'global-error',
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0b',
          color: '#e9e7e2',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '34rem', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.6875rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#82828a',
              margin: 0,
            }}
          >
            AURELIA
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 300, margin: '1.25rem 0 0' }}>
            The site failed to load
          </h1>
          <p style={{ color: '#bcbab5', lineHeight: 1.6, margin: '1rem 0 2rem' }}>
            Something broke before the page could be built. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: 'inherit',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '0.85rem 1.75rem',
              color: '#0a0a0b',
              background: '#e9e7e2',
              border: 0,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ color: '#82828a', fontSize: '0.75rem', marginTop: '2rem' }}>
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
