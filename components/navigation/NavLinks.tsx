'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import { cn } from '@/lib/utils/cn';

type NavLinksProps = {
  orientation?: 'horizontal' | 'vertical';
  onNavigate?: () => void;
  className?: string;
};

export function NavLinks({ orientation = 'horizontal', onNavigate, className }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <ul
      className={cn(
        'flex',
        orientation === 'horizontal' ? 'items-center gap-8 lg:gap-12' : 'flex-col gap-2',
        className,
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group ease-luxe relative inline-block transition-colors duration-300',
                // The font is chosen per orientation rather than set here and
                // overridden below: both classes on one element leaves the
                // winner to stylesheet order, and `font-sans` was taking it —
                // which is why the full-screen mobile menu rendered in the
                // body face while every other piece of large type on the site
                // is set in the display serif.
                orientation === 'horizontal'
                  ? 'text-eyebrow font-sans uppercase'
                  : 'font-display text-[2.75rem] leading-[1.12] font-light tracking-tight sm:text-5xl',
                orientation === 'horizontal'
                  ? active
                    ? 'text-alabaster'
                    : 'text-mist hover:text-alabaster'
                  : // A full-screen menu is the page, not a rail over one, so
                    // its items carry the page's own contrast.
                    active
                    ? 'text-alabaster'
                    : 'text-alabaster/75 hover:text-alabaster',
              )}
            >
              {item.label}
              {orientation === 'horizontal' ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'bg-gold ease-luxe absolute -bottom-1.5 left-0 h-px transition-all duration-500',
                    active ? 'w-full' : 'w-0 group-hover:w-full',
                  )}
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
