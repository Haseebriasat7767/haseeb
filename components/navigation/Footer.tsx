import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { LEGAL_ITEMS, NAV_ITEMS } from '@/lib/constants/navigation';
import { PROPERTY, SITE } from '@/lib/constants/site';

export function Footer() {
  return (
    <footer className="border-alabaster/10 border-t py-16">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <p className="font-display text-alabaster text-2xl tracking-[0.42em]">{SITE.name}</p>
            <p className="text-eyebrow text-stone mt-4 uppercase">Private luxury residence</p>
            <p className="text-stone mt-4 text-[0.6875rem] leading-relaxed tracking-[0.15em] uppercase">
              Conceptual — no existing property. Built to be adapted to a real listing.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-eyebrow text-mist hover:text-gold inline-flex min-h-11 items-center uppercase transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <address className="flex flex-col not-italic">
            <Link
              href="/contact"
              className="text-eyebrow text-mist hover:text-gold inline-flex min-h-11 items-center uppercase transition-colors"
            >
              Private enquiries
            </Link>
            {SITE.contact.email ? (
              <a
                href={`mailto:${SITE.contact.email}`}
                className="text-eyebrow text-mist hover:text-gold inline-flex min-h-11 items-center uppercase transition-colors"
              >
                {SITE.contact.email}
              </a>
            ) : null}
            {SITE.contact.phone ? (
              <a
                href={`tel:${SITE.contact.phone}`}
                className="text-eyebrow text-stone hover:text-mist inline-flex min-h-11 items-center uppercase transition-colors"
              >
                {SITE.contact.phoneDisplay ?? SITE.contact.phone}
              </a>
            ) : null}
            <span className="text-eyebrow text-stone inline-flex min-h-11 items-center uppercase">
              {SITE.contact.addressDisplay}
            </span>
          </address>
        </div>

        <div className="rule" />

        <div className="text-stone flex flex-col gap-4 text-[0.6875rem] tracking-[0.2em] uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {PROPERTY.year} {SITE.name}. All rights reserved. — Conceptual residence, not a
            real listing.
          </span>

          <nav aria-label="Legal" className="-my-3 flex flex-wrap gap-x-6">
            {LEGAL_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-gold inline-flex min-h-11 items-center transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
