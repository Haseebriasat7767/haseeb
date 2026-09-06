export type NavItem = {
  label: string;
  href: string;
};

/**
 * Named for what a buyer is looking for, in the order they look for it:
 * what the property is, how to move through it, how it is planned, what it
 * looks like. "Architecture" was the label on the floor plan and read as an
 * essay rather than as a drawing.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Property', href: '/residence' },
  { label: 'Explore', href: '/experience' },
  { label: 'Floor plan', href: '/floor-plan' },
  { label: 'Gallery', href: '/gallery' },
] as const;
