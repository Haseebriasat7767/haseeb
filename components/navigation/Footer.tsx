import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { NAV_ITEMS } from '@/lib/constants/navigation';
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

          <address className="flex flex-col gap-3 not-italic">
            <a
              href={`mailto:${SITE.contact.email}`}
              className="text-eyebrow text-mist hover:text-gold uppercase transition-colors"
            >
              {SITE.contact.email}
            </a>
            <span className="text-eyebrow text-stone uppercase">{SITE.contact.phone}</span>
            <span className="text-eyebrow text-stone uppercase">{SITE.contact.address}</span>
          </address>
        </div>

        <div className="rule" />

        <div className="text-stone flex flex-col gap-2 text-[0.6875rem] tracking-[0.2em] uppercase sm:flex-row sm:justify-between">
          <span>
            &copy; {PROPERTY.year} {SITE.name}. All rights reserved.
          </span>
          <span>A fictional residence, generated entirely in code</span>
        </div>
      </Container>
    </footer>
  );
}
