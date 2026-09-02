'use client';

import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useMagnetic } from '@/hooks/useMagnetic';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-2.5 font-sans uppercase tracking-[0.18em] ' +
  'rounded-xs transition-[color,background-color,border-color,transform] duration-300 ease-luxe ' +
  'disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap will-change-transform';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-alabaster text-obsidian hover:bg-gold hover:text-obsidian',
  outline:
    'border border-alabaster/25 text-alabaster hover:border-gold hover:text-gold backdrop-blur-[2px]',
  ghost: 'text-mist hover:text-alabaster',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[0.6875rem]',
  md: 'h-12 px-7 text-xs',
};

type SharedProps = {
  variant?: Variant;
  size?: Size;
  /** Adds a small pull toward the pointer. Fine pointers only. */
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = SharedProps & ComponentPropsWithoutRef<'button'> & { href?: undefined };
type AnchorProps = SharedProps & { href: string } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    'href' | 'className' | 'children'
  >;

export function Button(props: ButtonProps | AnchorProps) {
  const { variant = 'primary', size = 'md', magnetic = false, className, children } = props;
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  const ref = useMagnetic<HTMLElement>(magnetic);

  if (props.href !== undefined) {
    const {
      href,
      variant: _v,
      size: _s,
      magnetic: _m,
      className: _c,
      children: _ch,
      ...rest
    } = props;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={classes}
        data-cursor="link"
        {...rest}
      >
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, magnetic: _m, className: _c, children: _ch, ...rest } = props;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      data-cursor="link"
      {...rest}
    >
      {children}
    </button>
  );
}
