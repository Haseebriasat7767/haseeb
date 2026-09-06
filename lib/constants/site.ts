import { CLIENT } from './client';

/**
 * Single source of truth for brand copy and metadata.
 *
 * AURELIA is a conceptual residence — an architectural proposition
 * presented as an experience, built to be adapted to a real listing. The
 * residence, its setting and the studio credited below are part of that
 * proposition and describe no existing property or practice.
 *
 * Contact details are not held here. They live in `client.ts`, come from
 * the environment, and are `null` until a real address or number is set —
 * so there is no placeholder for a visitor to find. `SITE.contact` reads
 * through to that one source rather than keeping a second copy.
 */
export const SITE = {
  name: 'AURELIA',
  // The product is a property experience, not a rendering technique. A
  // buyer does not care that it is real-time, and a developer being pitched
  // cares even less — what they are buying is a residence a client can walk
  // through from anywhere. The technology stays out of the positioning.
  tagline: 'Luxury Property Experience',
  description:
    'Explore The Aurelia Residence through an immersive digital property experience — every room, every hour of the day, from anywhere.',
  // Canonical origin, used for `metadataBase`, the sitemap and the social
  // cards. Set `NEXT_PUBLIC_SITE_URL` on a custom domain; the deployment
  // below is the real one this build is served from, so a shared link
  // resolves rather than pointing at a reserved example domain.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://haseeb-orcin.vercel.app',
  locale: 'en_US',
  contact: {
    email: CLIENT.agent.email,
    phone: CLIENT.agent.phone,
    address: 'By private appointment',
  },
} as const;

export const PROPERTY = {
  name: 'Residence No. 01',
  location: 'Coastal Ridge',
  architect: 'Atelier Sorrel',
  year: '2026',
  /**
   * Headline figures for the property intro. They describe the conceptual
   * residence this experience presents, and are not claims about a listing
   * on the market.
   */
  stats: [
    { label: 'Interior', value: '1,120 m²' },
    { label: 'Grounds', value: '4.2 ha' },
    { label: 'Bedrooms', value: 'Four' },
    { label: 'Elevation', value: '86 m' },
  ],
  /**
   * The full specification. Every entry marked `derived` is counted from
   * the room schedule the 3D model is actually generated from
   * (`components/three/villa/interior/InteriorPlan.ts`) rather than being
   * written as marketing copy — change the plan and these are what change
   * with it. The rest describe the conceptual residence rather than a
   * surveyed building.
   */
  specification: [
    { label: 'Levels', value: '2', note: 'Ground and upper', derived: true },
    { label: 'Rooms', value: '21', note: 'Enclosed spaces', derived: true },
    { label: 'Bedrooms', value: '4', note: 'Including the master suite', derived: true },
    { label: 'Bathrooms', value: '3', note: 'All ensuite or adjacent', derived: true },
    { label: 'Interior', value: '1,120 m²', note: 'Across both levels', derived: false },
    { label: 'Grounds', value: '4.2 ha', note: 'Private ledge above the coast', derived: false },
    { label: 'Pool', value: 'Private', note: 'Infinity edge, 11 × 6.5 m', derived: false },
    { label: 'Elevation', value: '86 m', note: 'Above sea level', derived: false },
  ],
} as const;
