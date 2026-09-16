import type { PanoramaSource } from './panoLoader';

/**
 * Which spaces have a rendered panorama.
 *
 * Empty, and it must stay empty until real renders exist. A placeholder
 * cubemap here would put an invented interior in front of a buyer — the one
 * thing this project does not do. Every consumer treats "no entry" as "this
 * room cannot be entered yet" and shows nothing, rather than substituting
 * something that looks like a photograph of a room nobody has built.
 *
 * Adding a room is one line: the renderer writes six faces to
 * `public/assets/pano/<id>/{px,nx,py,ny,pz,nz}.jpg`, and the entry names it.
 */
const PANORAMAS: Readonly<Record<string, PanoramaSource>> = {};

export function panoramaFor(spaceId: string): PanoramaSource | null {
  return PANORAMAS[spaceId] ?? null;
}

export function hasPanorama(spaceId: string): boolean {
  return panoramaFor(spaceId) !== null;
}

/** Space ids with a rendered panorama, for coverage reporting. */
export function panoramaCoverage(): readonly string[] {
  return Object.keys(PANORAMAS);
}
