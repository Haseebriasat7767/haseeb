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
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-eyebrow text-mist hover:text-gold uppercase transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Only channels that actually reach someone. With no address or
              number configured this is the enquiry route and the standing
              terms — never a row of dashes where contact details should be. */}
          <address className="flex flex-col gap-3 not-italic">
            <Link
              href="/contact"
              className="text-eyebrow text-mist hover:text-gold uppercase transition-colors"
            >
              Private enquiries
            </Link>
            {SITE.contact.email ? (
              <a
                href={`mailto:${SITE.contact.email}`}
                className="text-eyebrow text-mist hover:text-gold uppercase transition-colors"
              >
                {SITE.contact.email}
              </a>
            ) : null}
            {SITE.contact.phone ? (
              <span className="text-eyebrow text-stone uppercase">{SITE.contact.phone}</span>
            ) : null}
            <span className="text-eyebrow text-stone uppercase">{SITE.contact.address}</span>
          </address>
        </div>

        <div className="rule" />

        <div className="text-stone flex flex-col gap-4 text-[0.6875rem] tracking-[0.2em] uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {PROPERTY.year} {SITE.name}. All rights reserved.
          </span>

          {/* The three standing documents. They belong in the footer rather
              than the main navigation: nobody browses to them, but a visitor
              looking for one expects to find it here, and an accessibility
              statement is only useful if it is reachable from every page. */}
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-gold transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
