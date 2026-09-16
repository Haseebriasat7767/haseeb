import type { AnchorHTMLAttributes, Ref } from 'react';

/**
 * The library's stand-in for `next/link`.
 *
 * ## Why this exists
 *
 * `Button` renders a `next/link` when given an `href`, which is correct
 * inside the application and impossible outside it: the design tool that
 * consumes this package runs plain React with no Next router, so importing
 * `next/link` there throws before a single button paints.
 *
 * The build aliases `next/link` to this file, so the component source is
 * shipped exactly as the application runs it — no forked `Button`, no
 * second implementation to keep in step. What changes is the one import
 * that cannot cross the boundary, and it changes to the thing `next/link`
 * degrades to anyway: an anchor with an `href`.
 *
 * Client-side routing is the only thing lost, and a design surface has no
 * routes to push.
 */
export default function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ref,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  // Accepted and ignored: router-only props that `next/link` takes and a
  // plain anchor has no meaning for. Named rather than swallowed by `rest`
  // so they never reach the DOM and trip React's unknown-prop warning.
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  ref?: Ref<HTMLAnchorElement>;
}) {
  return <a href={href} ref={ref} {...rest} />;
}
