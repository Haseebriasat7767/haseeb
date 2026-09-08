import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three';

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

/**
 * Longest edge a decal sheet is allowed to occupy on the GPU.
 *
 * ## Why this exists
 *
 * Because not having it produced a black screen on a phone, and it took a bug
 * report to find out. These sheets are authored at 2048 px, which is right for
 * a desktop framing where a shopfront sign is read from ten metres. Uploaded
 * as-is they cost 21 MB each — three of them plus the foliage atlas came to
 * 64 MB of the scene's 94 MB of texture memory, and a mid-range mobile GPU
 * responds to that by losing the WebGL context. A lost context is not an
 * error anyone sees: the canvas simply goes black and stays black.
 *
 * On a 412 px-wide screen a tenant name on a fascia is a couple of dozen
 * pixels tall. There was never anything in that fourth mip level to see.
 */
let maxSheetSize = 2048;

/**
 * Sets the ceiling and drops anything already loaded above it.
 *
 * Mirrors `setSurfaceMapResolution`: the size is a property of the device
 * rather than of the call site, so it is set once by `Scene` from the quality
 * tier and every loader below reads it.
 */
export function getDecalMaxSize(): number {
  return maxSheetSize;
}

export function setDecalMaxSize(size: number): void {
  if (size === maxSheetSize) return;
  maxSheetSize = size;
  disposeDecalSheets();
}

/**
 * Redraws an image at or below the ceiling, keeping its aspect.
 *
 * A canvas rather than a smaller file on disk: the sheets are one asset each
 * and re-baking them per tier would mean three more files to keep in step
 * with the atlas rects. The download is unchanged — this is about what
 * reaches the GPU, which is what the context is lost over.
 */
function fit(image: HTMLImageElement, max: number): HTMLImageElement | HTMLCanvasElement {
  const longest = Math.max(image.width, image.height);
  if (longest <= max) return image;

  const scale = max / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const cached = new Map<string, Texture>();

/**
 * A decal sheet, loaded once and shared, at no more than the tier's ceiling.
 *
 * Mipmapped and anisotropic, because these are read at every angle from a
 * metre away to a hundred and thirty. Unmipped lettering at a grazing angle
 * across a facade is a field of sparkle, which is worse than no sign at all.
 *
 * Loaded by hand rather than through `TextureLoader` because the image has to
 * be resized between decode and upload, and the loader uploads what it is
 * given. The texture is returned empty and filled in on decode, which every
 * call site already tolerates — they hand it straight to a material.
 */
export function getDecalSheet(url: string): Texture {
  const key = `${url}@${maxSheetSize}`;
  const hit = cached.get(key);
  if (hit) return hit;

  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;

  const image = new Image();
  image.onload = () => {
    texture.image = fit(image, maxSheetSize);
    texture.needsUpdate = true;
  };
  image.src = url;

  cached.set(key, texture);
  return texture;
}

export function disposeDecalSheets(): void {
  for (const texture of cached.values()) texture.dispose();
  cached.clear();
}
