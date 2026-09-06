'use client';

import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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

          <div className="hidden items-center gap-10 lg:flex">
            <nav aria-label="Primary">
              <NavLinks />
            </nav>

            {/*
              The standing call to action.
              
              A buyer who has just spent two minutes moving through a
              residence should never have to go looking for the way to ask
              about it — at that moment the intent is at its highest it will
              ever be, and a "Contact" item sitting fifth in a nav list is
              not an answer to it. It is bordered rather than filled: the
              one persistent affordance on the page, present without
              competing with the architecture behind it.
            */}
            <Link
              href="/contact"
              data-cursor="link"
              className="text-eyebrow ease-luxe border-alabaster/30 text-alabaster hover:border-gold hover:text-gold border px-5 py-2.5 uppercase transition-colors duration-300"
            >
              Request viewing
            </Link>
          </div>

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
