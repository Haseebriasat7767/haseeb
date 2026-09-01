'use client';

import { useSyncExternalStore } from 'react';

const PARAM = 'debug';
const VALUE = 'performance';

function getSnapshot(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return new URLSearchParams(window.location.search).get(PARAM) === VALUE;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

/**
 * Gates the performance overlay on `?debug=performance`. Production builds
 * return `false` unconditionally regardless of the query string, so the
 * overlay can never be switched on outside development.
 */
export function useDevOverlayEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
