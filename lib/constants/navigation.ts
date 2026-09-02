export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Explore', href: '/experience' },
  { label: 'Architecture', href: '/floor-plan' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Residence', href: '/residence' },
  { label: 'Contact', href: '/contact' },
] as const;
