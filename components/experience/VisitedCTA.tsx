'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * The offer, shown only once the visitor has actually seen the work.
 *
 * ## Why it waits
 *
 * A pitch shown on arrival is an interruption — the visitor has no reason
 * yet to want what it offers. Shown after they have moved through the site,
 * the ground floor and the upper floor of their own accord, it lands on
 * somebody who has just spent two minutes proving to themselves that the
 * thing works. That is the moment the ask is cheap.
 *
 * ## Why it goes to the enquiry form
 *
 * Not to a mail client and not to a booking link. The form is the one
 * channel that actually reaches somebody, it records the enquiry, and it
 * degrades honestly when the mailbox is not configured. A `mailto:` to an
 * address nobody reads looks identical to one that works, right up until
 * the enquiry is lost.
 */
export function VisitedCTA({ shown }: { shown: boolean }) {
  return (
    <div
      className={cn(
        'ease-luxe transition-[opacity,transform] duration-1000',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
      // Hidden from assistive tech until it is really shown, so a screen
      // reader does not meet a pitch the visitor has not triggered.
      aria-hidden={!shown}
    >
      <div className="border-alabaster/15 bg-obsidian/70 flex flex-col gap-4 border p-6 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-1.5">
          <p className="text-eyebrow text-gold uppercase">You have seen the whole residence</p>
          <p className="text-alabaster max-w-[46ch] text-[0.95rem] leading-relaxed">
            Every room here was built from geometry, not photographed. The same can be done for a
            building that does not exist yet.
          </p>
        </div>
        <Link
          href="/contact"
          data-cursor="link"
          tabIndex={shown ? undefined : -1}
          className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold shrink-0 border px-5 py-3 text-center uppercase transition-colors"
        >
          Discuss your project
        </Link>
      </div>
    </div>
  );
}

export default VisitedCTA;
