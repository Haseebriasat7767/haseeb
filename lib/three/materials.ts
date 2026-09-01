import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';

/**
 * Procedural material factory. Materials are created once and shared
 * across meshes so Phase 2's generated geometry stays cheap to mount.
 */
function standard(params: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  return new MeshStandardMaterial(params);
}

let cache: ReturnType<typeof createMaterials> | null = null;

function createMaterials() {
  return {
    concrete: standard({ color: '#c9c3b8', roughness: 0.82, metalness: 0.02 }),
    stone: standard({ color: '#8d887e', roughness: 0.95, metalness: 0 }),
    terrain: standard({ color: '#15151a', roughness: 1, metalness: 0 }),
    glass: standard({
      color: '#0d1418',
      roughness: 0.08,
      metalness: 0.9,
      transparent: true,
      opacity: 0.72,
    }),
    bronze: standard({ color: '#b99a63', roughness: 0.35, metalness: 0.85 }),
    /** Reveals, trim, columns — the dark metal in the palette. */
    darkMetal: standard({ color: '#1d1e21', roughness: 0.42, metalness: 0.88 }),
    /**
     * Architectural glazing. Clearcoat rather than transmission: it reads as
     * deep reflective glass without the render-target cost transmission adds
     * on mobile GPUs. Double-sided so interiors are not hollow from behind.
     */
    glazing: new MeshPhysicalMaterial({
      color: '#1b2830',
      roughness: 0.12,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      reflectivity: 0.6,
      transparent: true,
      opacity: 0.6,
      side: DoubleSide,
    }),
    /**
     * Glazing applied to the face of a solid volume. Opaque, because there is
     * no void behind it to see into — transparency would read as tinted film
     * over the wall rather than as a window.
     */
    glazingSurface: new MeshPhysicalMaterial({
      color: '#1d2a33',
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      reflectivity: 0.6,
    }),
  };
}

/** Lazily-built shared material library. */
export function getMaterials() {
  cache ??= createMaterials();
  return cache;
}

/** Frees GPU resources — call when the whole experience unmounts. */
export function disposeMaterials() {
  if (!cache) return;
  for (const material of Object.values(cache)) material.dispose();
  cache = null;
}
