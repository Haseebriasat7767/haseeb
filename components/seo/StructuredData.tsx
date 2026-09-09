import { SITE } from '@/lib/constants/site';

/**
 * JSON-LD for the site.
 *
 * ## What is deliberately not here
 *
 * No `RealEstateListing`, no `offers`, no `price`, no `PostalAddress`, no
 * `aggregateRating`. AURELIA is a conceptual residence — `lib/constants/site`
 * says so in as many words, and the contact details are null until a real
 * number is set. Structured data is a machine-readable restatement of what
 * the page already says, so inventing an address or a price here would be
 * inventing it everywhere, with the added problem that Google treats a
 * listing schema as a claim about a property on the market.
 *
 * What is here is what is true: this is a website, it has a name and a
 * description, and each page sits somewhere in it.
 */

type Breadcrumb = { name: string; path: string };

export function StructuredData({ breadcrumbs }: { breadcrumbs?: Breadcrumb[] }) {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: SITE.locale.replace('_', '-'),
      publisher: { '@id': `${SITE.url}/#brand` },
    },
    {
      '@type': 'Brand',
      '@id': `${SITE.url}/#brand`,
      name: SITE.name,
      slogan: SITE.tagline,
      url: SITE.url,
    },
  ];

  if (breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Home', path: '/' }, ...breadcrumbs].map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${SITE.url}${crumb.path}`,
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      // The payload is built from constants in this repository, never from
      // user input, so there is nothing here to escape against.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}

export default StructuredData;
