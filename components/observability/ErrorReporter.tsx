'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/report';

/**
 * Forwards uncaught browser errors to the server log.
 *
 * Mounted once in the root layout. React's error boundaries catch what
 * happens during render; these two listeners catch everything else — an
 * event handler that throws, a chunk that fails to load, a promise nobody
 * awaited — which is most of what actually breaks in the wild.
 *
 * Renders nothing and never interferes: every failure inside the reporter is
 * swallowed, because an error reporter that can itself throw turns one broken
 * page into a loop.
 */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        kind: 'error',
        message: event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        kind: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

export default ErrorReporter;
