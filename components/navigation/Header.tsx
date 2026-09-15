'use client';

import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';
import { Wordmark } from './Wordmark';
import { ClientLogo } from '@/components/brand/ClientIdentity';

/**
 * Transparent overlay header — it already sits on top of the page and will
 * sit on top of a full-bleed 3D canvas without further change.
 *
 * ## The baseline scrim
 *
 * The scroll-triggered `bg-obsidian/80` only exists once the page has moved
 * — at the top of every page it renders fully transparent, which is correct
 * for the site's own dark heroes and wrong the moment a hero is not dark.
 * `/tower`'s arrival framing and `/experience`'s brighter hours both put
 * open sky directly behind the alabaster wordmark and nav labels, and gold
 * on pale blue does not clear 4.5:1 no matter how the hero itself is
 * graded. Rather than tuning every hero component that could ever sit under
 * this header, the header keeps a soft gradient of its own — present at
 * every scroll position, underneath the scroll-triggered background rather
 * than instead of it — so the nav has a floor of contrast regardless of
 * what is rendered beneath it.
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
        {/* The floor of contrast described above. Sized a little past the
            nav row so it feathers into whatever the hero renders next,
            rather than ending on a visible edge. */}
        <div
          aria-hidden="true"
          className="from-obsidian/60 pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent"
        />
        <div className="max-w-wide px-gutter relative mx-auto flex h-20 items-center justify-between">
          {/* The client's mark co-signs the wordmark rather than replacing
              it, and renders nothing at all when none is configured — so
              the unbranded masthead is unchanged. */}
          <div className="flex items-center gap-3">
            <Wordmark />
            <ClientLogo />
          </div>

          <div className="hidden items-center gap-8 lg:flex xl:gap-10">
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
              className="text-eyebrow ease-luxe border-alabaster/40 text-alabaster hover:border-gold hover:text-gold border px-5 py-3 font-medium tracking-wide whitespace-nowrap uppercase transition-colors duration-200 xl:px-6"
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
