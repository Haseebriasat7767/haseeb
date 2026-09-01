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
  stats: [
    { label: 'Interior', value: '1,120 m²' },
    { label: 'Grounds', value: '4.2 ha' },
    { label: 'Bedrooms', value: 'Six' },
    { label: 'Elevation', value: '86 m' },
  ],
} as const;
