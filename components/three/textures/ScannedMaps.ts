import {
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three';
import type { SurfaceFamily, SurfaceMaps } from './SurfaceMaps';

/**
 * The loading layer for real scanned PBR sets.
 *
 * ## Why this exists as its own file
 *
 * Every material in Aurelia is procedurally generated, and that is the
 * single largest remaining reason the surfaces read as rendered rather than
 * as photographed. It is not a shading problem — the roughness response,
 * the joint geometry and the tiling are all right — it is that a generated
 * limestone has the statistics its author thought limestone had, and a
 * scanned one has the statistics limestone actually has.
 *
 * The two sources of CC0 architectural scans this project would use,
 * ambientCG and Poly Haven, are blocked by this environment's egress
 * policy. That is a network fact, not a design decision, and there is no
 * point rediscovering it: nothing here retries them.
 *
 * What this file does instead is make the swap a one-location change. Drop
 * the files named below into `public/assets/surfaces/<family>/` and every
 * material picks them up on the next load, with no change to `materials.ts`,
 * to the ashlar pass, or to any call site. Until then `getSurfaceMaps`
 * keeps returning the procedural bake and the project keeps being honest
 * about which it is.
 *
 * ## The files
 *
 * Three per family, all tiling, all at the family's own `metres` scale:
 *
 *   public/assets/surfaces/<family>/albedo.jpg      (sRGB)
 *   public/assets/surfaces/<family>/roughness.jpg   (linear, grayscale)
 *   public/assets/surfaces/<family>/normal.jpg      (linear, tangent space, OpenGL +Y)
 *
 * Families, with the scan each wants and the real-world tile it must be
 * authored at — see `SurfaceMaps` for why the scale matters more than the
 * resolution:
 *
 *   plaster   fine lime render                    1.6 m
 *   stone     honed limestone / travertine        1.2 m
 *   oak       European oak boards, 180 mm wide    1.44 m
 *   marble    statuario, low-contrast veining     2.0 m
 *   linen     plain-weave upholstery linen        0.10 m
 *   wool      cut-pile wool rug                   0.32 m
 *   leather   fine-grain aniline leather          0.35 m
 *   paving    sawn stone paving                   1.2 m
 */

/** Where a family's scans live, if they have been supplied. */
const ROOT = '/assets/surfaces';

/**
 * Families for which real scans are present.
 *
 * Deliberately a manifest rather than a probe: a missing texture resolves
 * as a failed image request, which three reports asynchronously and long
 * after the material has already been built and handed out. Listing what
 * exists keeps the decision synchronous and keeps a missing file from
 * silently producing a black surface.
 *
 * Empty until scans are actually added to the repository. It is the only
 * line that changes when they are.
 */
export const SCANNED_FAMILIES: readonly SurfaceFamily[] = [];

export function hasScannedMaps(family: SurfaceFamily): boolean {
  return SCANNED_FAMILIES.includes(family);
}

const loader = new TextureLoader();

function load(url: string, srgb: boolean, metres: number): Texture {
  const texture = loader.load(url);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // Identical to the procedural path: UVs are in metres, so the repeat is
  // simply how many tiles fit in one.
  texture.repeat.set(1 / metres, 1 / metres);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Loads one family's scans. Only call this when `hasScannedMaps` is true —
 * it does no existence checking of its own.
 */
export function loadScannedMaps(
  family: SurfaceFamily,
  metres: number,
  normalScale: number,
): SurfaceMaps {
  return {
    map: load(`${ROOT}/${family}/albedo.jpg`, true, metres),
    roughnessMap: load(`${ROOT}/${family}/roughness.jpg`, false, metres),
    normalMap: load(`${ROOT}/${family}/normal.jpg`, false, metres),
    metres,
    normalScale,
  };
}
