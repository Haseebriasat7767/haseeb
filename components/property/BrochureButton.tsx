'use client';

import { Button } from '@/components/ui/Button';
import { CLIENT } from '@/lib/constants/client';
import { trackBrochureDownload } from '@/lib/analytics/events';

/**
 * The brochure, offered and counted.
 *
 * ## Why it exists
 *
 * There are five places that offer the brochure and only two of them were
 * recording that it had been taken, so the one number that says whether the
 * document is worth generating was undercounting by three surfaces. The
 * offer and the event belong in the same component, or they drift apart
 * again the next time somebody adds a fourth place to ask.
 *
 * Renders nothing when no brochure is configured, like every other
 * consumer of `CLIENT`.
 */
export function BrochureButton({
  variant = 'outline',
  magnetic = false,
  children = 'Download brochure',
  className,
}: {
  variant?: 'primary' | 'outline' | 'ghost';
  magnetic?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!CLIENT.brochurePath) return null;

  return (
    <Button
      href={CLIENT.brochurePath}
      download
      variant={variant}
      magnetic={magnetic}
      className={className}
      onClick={() => trackBrochureDownload()}
    >
      {children}
    </Button>
  );
}

export default BrochureButton;
