export type NavItem = {
  label: string;
  href: string;
};

/**
 * Named for what a buyer is looking for, in the order they look for it:
 * what the property is, how to move through it, how it is planned, what it
 * looks like. "Architecture" was the label on the floor plan and read as an
 * essay rather than as a drawing.
 *
 * The tower comes last because it is a different building rather than another
 * view of this one. It was also, for two whole phases, not here at all: the
 * page existed, the route built, the walkthrough worked, and nothing anywhere
 * on the site linked to it. A visitor could only reach a twenty-storey
 * building by typing its URL. Anything not in this list and not in the
 * sitemap does not exist as far as a visitor is concerned, however well it
 * renders.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Property', href: '/residence' },
  { label: 'Explore', href: '/experience' },
  { label: 'Floor plan', href: '/floor-plan' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Tower', href: '/tower' },
] as const;

/**
 * The standing documents, shown only in the footer.
 *
 * These are kept out of `NAV_ITEMS` on purpose — nobody arrives wanting to
 * read the terms — but they are listed here rather than hard-coded into the
 * footer so the sitemap can build from the same array. The comment on
 * `NAV_ITEMS` applies with equal force: a page reachable from neither this
 * list nor the sitemap does not exist.
 */
export const LEGAL_ITEMS: readonly NavItem[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Accessibility', href: '/accessibility' },
] as const;
