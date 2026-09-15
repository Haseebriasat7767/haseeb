'use client';

import { Button } from '@/components/ui/Button';
import { CLIENT } from '@/lib/constants/client';
import { rememberLeadContext } from '@/lib/contact/lead-context';
import { cn } from '@/lib/utils/cn';

/**
 * The commercial proposition, stated once.
 *
 * ## Why it is a component and not copy on a page
 *
 * It appears at the end of the guided tour, at the foot of the property
 * pages, and on the agencies page. Written three times it would drift
 * three ways, and the one sentence that has to land identically every
 * time is what the product actually does.
 *
 * ## Why it does not look like a pricing page
 *
 * Because the thing it is selling is the page it is sitting on. A visitor
 * arrives here having just walked through a building; a stack of gradient
 * cards and a countdown would tell them the preceding five minutes were
 * the marketing and this is the real site. So it borrows the same hairline
 * rules, the same eyebrow, the same restraint as the architecture above
 * it, and asks once.
 */
export function BuildForYourProperty({
  /** Where this instance sits, recorded with the lead. */
  source,
  className,
  /** Compact form for the end of the tour, where space is tight. */
  compact = false,
}: {
  source: string;
  className?: string;
  compact?: boolean;
}) {
  const remember = () => rememberLeadContext({ source, path: window.location.pathname });

  return (
    <div className={cn('flex flex-col gap-6', compact ? 'text-center' : null, className)}>
      <div className="flex flex-col gap-3">
        <p className="text-eyebrow text-stone uppercase">Build this for your property</p>
        <p
          className={cn(
            'font-display text-alabaster leading-tight font-semibold',
            compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl',
          )}
        >
          Now imagine your property presented this way.
        </p>
        <p className={cn('text-mist text-sm leading-relaxed', compact ? null : 'max-w-xl')}>
          AURELIA turns plans, renders, materials and specifications into an interactive digital
          property experience.
        </p>
      </div>

      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:items-center',
          compact ? 'sm:justify-center' : null,
        )}
      >
        <Button href="/for-agencies#create" onClick={remember} magnetic>
          Create my property experience
        </Button>
        <Button href="/contact" variant="outline" onClick={remember}>
          {CLIENT.links.ctaLabel ?? 'Request a private viewing'}
        </Button>
      </div>
    </div>
  );
}

export default BuildForYourProperty;
