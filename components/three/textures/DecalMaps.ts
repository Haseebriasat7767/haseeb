import {
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';

/**
 * The Tier 4 decal sheets — signage, wayfinding and the project identity.
 *
 * Three atlases, each a flat warm white over transparency. They carry
 * silhouette and nothing else: no colour decision, no shading, no lighting.
 * That is deliberate. A sign in this building has to read as painted metal at
 * noon and as an illuminated letter at midnight, and a texture that has
 * already decided which cannot do both — the material does, by carrying the
 * same sheet as an emissive map.
 *
 * Authored by `tools/blender/decals.py`. Every tenant name is invented; see
 * that file for why that is not a stylistic choice.
 */

const ROOT = '/assets/decals';

/** `[u, v, width, height]` of one cell, in texture coordinates. */
export type AtlasRect = readonly [number, number, number, number];

/**
 * A cell's rect, from its index in a row-major grid.
 *
 * Image row 0 is the top of the sheet and V = 1 is the top of the texture, so
 * the row index counts down from V = 1 rather than up from V = 0. Getting
 * this backwards does not fail, it silently swaps every sign in the building
 * top-to-bottom — which is the sort of bug that survives a review.
 */
function cell(index: number, cols: number, rows: number): AtlasRect {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [col / cols, 1 - (row + 1) / rows, 1 / cols, 1 / rows];
}

// ── DEC-01 · tenant signage ───────────────────────────────────────────────

export const SIGNAGE_SHEET = `${ROOT}/signage.png`;

/**
 * The sixteen names on the sheet, in its own order.
 *
 * Every one is invented. Reproducing a real retailer's wordmark on a building
 * that is not theirs is a trademark problem that no amount of "it is only a
 * render" survives, so there is nothing here to get wrong later.
 */
export const TENANTS = [
  'MARENNE',
  'CASA VELA',
  'ATELIER SUD',
  'OSSIA',
  'BLEU HORIZON',
  'PALMA',
  'THE CONSERVATORY',
  'MERIDIAN BOOKS',
  'LUMEN',
  'SALT + STONE',
  'VERDANT',
  'NORD & CO',
  'HOUSE OF FEN',
  'KIN AND KIND',
  'SOLARIS',
  'AURELIA GALLERY',
] as const;

export type Tenant = (typeof TENANTS)[number];

/** Aspect of a signage cell — 4:1, the shape a shopfront fascia actually is. */
export const SIGNAGE_ASPECT = 4;

export function tenantCell(index: number): AtlasRect {
  return cell(((index % TENANTS.length) + TENANTS.length) % TENANTS.length, 2, 8);
}

// ── DEC-02 · wayfinding ───────────────────────────────────────────────────

export const WAYFINDING_SHEET = `${ROOT}/wayfinding.png`;

/** Cells in sheet order. Level numerals, then arrows, then the rest. */
export const WAYFINDING = [
  '01',
  '02',
  '03',
  '04',
  '05',
  'right',
  'left',
  'up',
  'down',
  'lift',
  'stair',
  'wc',
  'exit',
  'residences',
  'beach',
  'atrium',
  'foodHall',
  'cinema',
  'carPark',
  'concierge',
] as const;

export type WayfindingKey = (typeof WAYFINDING)[number];

/** Aspect of a wayfinding cell — 2:1. */
export const WAYFINDING_ASPECT = 2;

export function wayfindingCell(key: WayfindingKey): AtlasRect {
  return cell(WAYFINDING.indexOf(key), 4, 5);
}

// ── DEC-04 · project identity ─────────────────────────────────────────────

export const IDENTITY_SHEET = `${ROOT}/identity.png`;

/** The wordmark alone, for the crown. */
export const IDENTITY_WORDMARK = cell(0, 1, 2);
/** The wordmark over a rule with its descriptor, for the lobby wall. */
export const IDENTITY_LOCKUP = cell(1, 1, 2);
/** Aspect of an identity cell — 8:1. */
export const IDENTITY_ASPECT = 8;

// ── loading ───────────────────────────────────────────────────────────────

const cached = new Map<string, Texture>();
let loader: TextureLoader | null = null;

/**
 * A decal sheet, loaded once and shared.
 *
 * Mipmapped and anisotropic, because these are read at every angle from a
 * metre away to a hundred and thirty. Unmipped lettering at a grazing angle
 * across a facade is a field of sparkle, which is worse than no sign at all.
 */
export function getDecalSheet(url: string): Texture {
  const hit = cached.get(url);
  if (hit) return hit;

  loader ??= new TextureLoader();
  const texture = loader.load(url);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  cached.set(url, texture);
  return texture;
}

export function disposeDecalSheets(): void {
  for (const texture of cached.values()) texture.dispose();
  cached.clear();
}
