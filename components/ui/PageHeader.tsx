import { Container } from './Container';
import { SectionHeading } from './SectionHeading';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lede?: string;
};

/** Shared masthead for interior pages, sitting clear of the overlay header. */
export function PageHeader({ eyebrow, title, lede }: PageHeaderProps) {
  return (
    <Container className="pt-40 pb-16 sm:pt-48">
      <SectionHeading as="h1" eyebrow={eyebrow} title={title} lede={lede} />
    </Container>
  );
}
