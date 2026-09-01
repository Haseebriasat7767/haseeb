'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { SITE } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';
import { NavLinks } from './NavLinks';

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Full-bleed overlay menu. Designed for touch first: large type, generous
 * targets, and a dedicated close affordance rather than a shrunken header.
 */
export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      hidden={!open}
      className={cn(
        'bg-obsidian ease-luxe fixed inset-0 z-40 flex flex-col transition-opacity duration-500 md:hidden',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="px-gutter flex h-20 items-center justify-between">
        <span className="font-display text-alabaster text-xl tracking-[0.42em]">{SITE.name}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="text-mist hover:text-alabaster -mr-2 inline-flex h-11 w-11 items-center justify-center transition-colors"
        >
          <X size={22} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Mobile" className="px-gutter flex flex-1 flex-col justify-center pb-24">
        <NavLinks orientation="vertical" onNavigate={onClose} />
        <div className="rule mt-12" />
        <a
          href={`mailto:${SITE.contact.email}`}
          className="text-eyebrow text-stone hover:text-gold mt-8 uppercase transition-colors"
        >
          {SITE.contact.email}
        </a>
      </nav>
    </div>
  );
}
