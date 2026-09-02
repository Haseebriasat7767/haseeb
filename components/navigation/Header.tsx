'use client';

import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import { Wordmark } from './Wordmark';

/**
 * Transparent overlay header — it already sits on top of the page and will
 * sit on top of a full-bleed 3D canvas without further change.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'ease-luxe fixed inset-x-0 top-0 z-40 transition-colors duration-500',
          scrolled ? 'bg-obsidian/80 backdrop-blur-sm' : 'bg-transparent',
        )}
      >
        <div className="max-w-wide px-gutter mx-auto flex h-20 items-center justify-between">
          <Wordmark />

          <nav aria-label="Primary" className="hidden lg:block">
            <NavLinks />
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="text-alabaster hover:text-gold -mr-2 inline-flex h-11 w-11 items-center justify-center transition-colors lg:hidden"
          >
            <Menu size={22} strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
        <div
          className={cn(
            'rule transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
