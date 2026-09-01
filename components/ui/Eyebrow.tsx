import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Small uppercase label that sits above editorial headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'text-eyebrow text-stone inline-flex items-center gap-3 font-sans font-medium uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className="bg-gold-dim h-px w-8" />
      {children}
    </span>
  );
}
