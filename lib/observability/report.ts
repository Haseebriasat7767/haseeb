/**
 * Sends a browser error to the server so it lands in the platform log.
 *
 * `keepalive` so a report survives the navigation that often follows the
 * error that caused it — without it, the failure that made someone leave the
 * page is exactly the one that never gets recorded.
 *
 * Every failure here is swallowed. A reporter that can throw turns one broken
 * page into a loop, and there is nothing useful to tell a visitor about the
 * failure of the thing that reports failures.
 */
export function reportClientError(error: {
  message: string;
  stack?: string | undefined;
  digest?: string | undefined;
  kind?: string;
}): void {
  if (typeof window === 'undefined') return;

  try {
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ ...error, page: window.location.pathname }),
    }).catch(() => {});
  } catch {
    // Nothing to do, and nothing to say about it.
  }
}
