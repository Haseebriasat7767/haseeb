import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * The shared shell for the legal pages.
 *
 * One component because these three documents are read the same way — long,
 * plain, and only when someone is looking for a specific answer. The measure
 * is held to roughly 68 characters and the headings are real `h2`s, so the
 * page is navigable by heading in a screen reader rather than being one wall
 * of text with bold bits in it.
 */
export function LegalPage({
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** Shown so a reader can tell whether they have read this version. */
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      <Container className="pb-section">
        <div className="max-w-[68ch]">
          <p className="text-eyebrow text-stone mb-12 uppercase">Last updated {updated}</p>
          <div className="text-mist [&_a]:text-gold [&_h2]:text-alabaster [&_h2]:font-display [&_strong]:text-alabaster flex flex-col gap-8 text-[0.95rem] leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-light [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </div>
      </Container>
    </>
  );
}

export default LegalPage;
