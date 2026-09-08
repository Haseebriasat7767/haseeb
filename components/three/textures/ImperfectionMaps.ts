import { LinearMipmapLinearFilter, RepeatWrapping, TextureLoader, type Texture } from 'three';

/**
 * DEC-05 — the surface imperfection masks.
 *
 * The only Tier 4 item that is not a decal. These do not sit on the building;
 * they are layered into the roughness of surfaces that already exist, and
 * what they buy is the thing every generated material is missing: a history.
 *
 * A procedural limestone is uniform because the function that made it is
 * uniform. A real one has a side the rain runs down, a plinth that has been
 * walked on for ten years, and a patch under a coping that never dries. None
 * of that is visible in a material's parameters and all of it is visible in
 * a photograph, which is most of why a render reads as a render.
 *
 * Greyscale and tiling. White is untouched, black is fully affected — so a
 * missing file resolving to nothing is the safe direction, and a mask that
 * fails to load leaves the surface exactly as it was.
 *
 * Baked by `tools/blender/decals.py` on the same 4D torus the surface library
 * uses, so they tile against the maps they are layered over.
 */

export type ImperfectionMask = 'streaks' | 'staining' | 'edgewear';

const ROOT = '/assets/decals/imperfection';

const cached = new Map<ImperfectionMask, Texture>();
let loader: TextureLoader | null = null;

/**
 * A mask, loaded once and shared across every material that layers it.
 *
 * Repeat wrapping and no colour space: this is a number per texel, not a
 * colour, and reading it through the sRGB transform would bend every value
 * it carries — the same reason the bake writes it as Non-Color.
 */
export function getImperfectionMask(name: ImperfectionMask): Texture {
  const hit = cached.get(name);
  if (hit) return hit;

  loader ??= new TextureLoader();
  const texture = loader.load(`${ROOT}/${name}.png`);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  cached.set(name, texture);
  return texture;
}

export function disposeImperfectionMasks(): void {
  for (const texture of cached.values()) texture.dispose();
  cached.clear();
}
