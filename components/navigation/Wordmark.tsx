import Link from 'next/link';
import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE.name} — home`}
      className={cn(
        'font-display text-alabaster text-xl leading-none tracking-[0.42em]',
        'ease-luxe hover:text-gold transition-colors duration-300 sm:text-2xl',
        className,
      )}
    >
      {SITE.name}
    </Link>
  );
}
