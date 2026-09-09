import type { MetadataRoute } from 'next';
import { LEGAL_ITEMS, NAV_ITEMS } from '@/lib/constants/navigation';
import { SITE } from '@/lib/constants/site';

/** Every route the site actually serves. Static, because the site is. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Built from the navigation constants rather than a second hand-kept list,
  // so a page added to the site cannot go missing from the sitemap — which is
  // exactly how the tower page stayed invisible for two phases.
  const routes = [
    '',
    ...NAV_ITEMS.map((item) => item.href),
    '/contact',
    ...LEGAL_ITEMS.map((item) => item.href),
  ];
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${SITE.url}${route}`,
    lastModified,
    changeFrequency: 'monthly',
    // The standing documents are real pages but they are not what the site is
    // for, so they are ranked below the property pages rather than alongside.
    priority: route === '' ? 1 : LEGAL_ITEMS.some((item) => item.href === route) ? 0.2 : 0.7,
  }));
}
