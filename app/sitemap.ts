import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/constants/site';

/** Every route the site actually serves. Static, because the site is. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/experience', '/floor-plan', '/gallery', '/residence', '/contact'];
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${SITE.url}${route}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
