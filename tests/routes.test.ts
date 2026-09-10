import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { LEGAL_ITEMS, NAV_ITEMS } from '@/lib/constants/navigation';

/**
 * A page nobody can reach does not exist.
 *
 * The tower page shipped, built and worked for two whole phases while
 * nothing on the site linked to it and the sitemap — a second, hand-kept
 * list — never mentioned it. A visitor could only reach a twenty-storey
 * building by typing its URL. These tests are that bug, pinned.
 */

const paths = () => sitemap().map((entry) => new URL(entry.url).pathname);

describe('the sitemap', () => {
  it('lists every page in the main navigation', () => {
    for (const item of NAV_ITEMS) expect(paths()).toContain(item.href);
  });

  it('lists every standing document', () => {
    for (const item of LEGAL_ITEMS) expect(paths()).toContain(item.href);
  });

  it('lists the home page and the contact page', () => {
    expect(paths()).toContain('/');
    expect(paths()).toContain('/contact');
  });

  it('lists each page exactly once', () => {
    const listed = paths();
    expect(listed).toHaveLength(new Set(listed).size);
  });

  it('ranks the home page above everything else', () => {
    const entries = sitemap();
    const home = entries.find((entry) => new URL(entry.url).pathname === '/');
    expect(home?.priority).toBe(1);
  });

  it('ranks the standing documents below the property pages', () => {
    const entries = sitemap();
    const legal = LEGAL_ITEMS.map(
      (item) => entries.find((entry) => new URL(entry.url).pathname === item.href)?.priority ?? 1,
    );
    const property = NAV_ITEMS.map(
      (item) => entries.find((entry) => new URL(entry.url).pathname === item.href)?.priority ?? 0,
    );
    expect(Math.max(...legal)).toBeLessThan(Math.min(...property));
  });

  it('gives every entry an absolute url', () => {
    for (const entry of sitemap()) expect(() => new URL(entry.url)).not.toThrow();
  });
});

describe('navigation', () => {
  it('has no duplicate destinations', () => {
    const hrefs = [...NAV_ITEMS, ...LEGAL_ITEMS].map((item) => item.href);
    expect(hrefs).toHaveLength(new Set(hrefs).size);
  });

  it('keeps the standing documents out of the main navigation', () => {
    // Nobody arrives at a property site wanting to read the terms.
    const main = NAV_ITEMS.map((item) => item.href);
    for (const item of LEGAL_ITEMS) expect(main).not.toContain(item.href);
  });

  it('gives every item a label and a root-relative href', () => {
    for (const item of [...NAV_ITEMS, ...LEGAL_ITEMS]) {
      expect(item.label.trim()).not.toBe('');
      expect(item.href.startsWith('/')).toBe(true);
    }
  });
});
