/** Single source of truth for brand copy and metadata placeholders. */
export const SITE = {
  name: 'AURELIA',
  tagline: 'Architectural Experience',
  description:
    'AURELIA is a private architectural residence rendered as a cinematic, real-time experience. Explore the form, the light, and the landscape.',
  url: 'https://aurelia.example.com',
  locale: 'en_US',
  contact: {
    email: 'enquiries@aurelia.example.com',
    phone: '+1 (000) 000-0000',
    address: 'Placeholder Estate, Coastal Ridge',
  },
} as const;

export const PROPERTY = {
  name: 'Residence No. 01',
  location: 'Coastal Ridge',
  architect: 'Studio Placeholder',
  year: '2026',
  /**
   * Headline figures for the property intro. These are demonstration values
   * for a fictional residence, not claims about a real listing.
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
   * with it. The rest are demonstration figures for a fictional property.
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
