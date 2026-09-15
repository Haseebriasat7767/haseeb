export type NavItem = {
  label: string;
  href: string;
};

/**
 * One entry per building, matching the pattern the tower already set: a
 * single page holding every way of seeing it (a guided tour, on foot, from
 * the air, the unit list) as tabs in one component tree rather than as
 * separate routes. The residence used to be four separate nav entries —
 * Property, Explore, Floor plan, Gallery — for what is now one page
 * (`/residence`) with those same sections folded in as tabs, the same way
 * `/tower` was always one entry. `/experience`, `/floor-plan` and `/gallery`
 * still resolve (see `next.config.ts`'s `redirects`), so an old link or
 * bookmark keeps working; they are just no longer a second, third and
 * fourth page a visitor has to notice in the nav.
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
  { label: 'Residence', href: '/residence' },
  { label: 'Tower', href: '/tower' },
  { label: 'For Agencies', href: '/for-agencies' },
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
