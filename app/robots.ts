import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/constants/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // `/render` is the panorama job's own surface — a square, chrome-free
    // page that exists for a headless browser to point a cube camera at. It
    // is not linked and not in the sitemap, but neither of those stops a
    // crawler that has been given the URL.
    rules: { userAgent: '*', allow: '/', disallow: '/render/' },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
