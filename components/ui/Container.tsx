import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type ContainerProps = {
  children: ReactNode;
  as?: ElementType;
  width?: 'editorial' | 'wide';
  className?: string;
};

/** Horizontal rhythm for the whole site — the only place gutters live. */
export function Container({ children, as = 'div', width = 'wide', className }: ContainerProps) {
  const Tag = as as ElementType<{ className?: string; children?: ReactNode }>;

  return (
    <Tag
      className={cn(
        'px-gutter mx-auto w-full',
        width === 'wide' ? 'max-w-wide' : 'max-w-editorial',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
