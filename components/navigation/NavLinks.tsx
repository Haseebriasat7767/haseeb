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
                'group ease-luxe relative inline-block font-sans transition-colors duration-300',
                orientation === 'horizontal'
                  ? 'text-eyebrow uppercase'
                  : 'font-display text-4xl tracking-tight sm:text-5xl',
                active ? 'text-alabaster' : 'text-mist hover:text-alabaster',
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
