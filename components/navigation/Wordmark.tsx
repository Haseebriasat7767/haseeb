import Link from 'next/link';
import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE.name} — home`}
      className={cn(
        // `leading-none` makes the wordmark exactly as tall as its caps,
        // which is a 20px tap target on a phone. The flex box gives it 44
        // without moving the letters off the baseline they sit on now.
        'font-display text-alabaster inline-flex min-h-11 items-center text-xl leading-none tracking-[0.42em]',
        'ease-luxe hover:text-gold transition-colors duration-300 sm:text-2xl',
        className,
      )}
    >
      {SITE.name}
    </Link>
  );
}
