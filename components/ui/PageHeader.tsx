import { Container } from './Container';
import { SectionHeading } from './SectionHeading';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Tightens the masthead where the page's subject sits directly below it. */
  dense?: boolean;
};

/** Shared masthead for interior pages, sitting clear of the overlay header. */
export function PageHeader({ eyebrow, title, lede, dense = false }: PageHeaderProps) {
  return (
    <Container className={dense ? 'pt-32 pb-10 sm:pt-36' : 'pt-40 pb-16 sm:pt-48'}>
      <SectionHeading as="h1" eyebrow={eyebrow} title={title} lede={lede} />
    </Container>
  );
}
