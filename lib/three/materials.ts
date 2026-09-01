import {
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/**
 * Procedural material factory. Materials are created once and shared
 * across meshes so Phase 2's generated geometry stays cheap to mount.
 */
function standard(params: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  return new MeshStandardMaterial(params);
}

// ─────────────────────────────────────────────────────────────────────────
// Procedural surface variation
//
// Every "natural" material (stone, concrete, wood, bark, foliage, grass,
// soil) gets a subtle deterministic tint/roughness variation driven by
// world position, injected via `onBeforeCompile`. This is real per-fragment
// GLSL noise — a handful of sin/fract operations, no texture fetch, no
// extra draw call, no render target — not a texture map and not
// `Math.random()`. Two coordinate hashes are blended so the pattern never
// repeats in an obviously tiled way, and the whole thing is cheap enough
// (a few ALU instructions) to run identically on every quality tier; the
// existing tier system keeps controlling the parameters that actually cost
// GPU time (DPR, shadow maps, antialiasing, geometry/cluster counts).
// ─────────────────────────────────────────────────────────────────────────

/** Shared GLSL: a smooth 3D value-noise built from a deterministic hash. */
const NOISE_GLSL = `
varying vec3 vAureliaWorldPos;
uniform float uVarScale;
uniform float uVarColor;
uniform float uVarRough;
uniform float uVarSeed;
uniform vec3 uVarAnisotropy;

float aureliaHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(uVarSeed * 0.017));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float aureliaNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = aureliaHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = aureliaHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = aureliaHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = aureliaHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = aureliaHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = aureliaHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = aureliaHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = aureliaHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
`;

type VariationOptions = {
  /** World-space period, in metres, of one noise cell. */
  scale: number;
  /** Max fractional colour delta (0–1); kept small so it reads as character, not static. */
  colorVariation: number;
  /** Max additive roughness delta. */
  roughnessVariation?: number;
  /** A distinct integer per material so identical geometry never samples identically. */
  seed: number;
  /**
   * Per-axis noise-space compression before sampling — e.g. `[1, 0.12, 1]`
   * stretches cells tall along Y, which is what reads as directional grain
   * on wood and bark rather than blotchy stone-like patches.
   */
  anisotropy?: [number, number, number];
};

/**
 * Patches a standard/physical material's shader with the noise above,
 * nudging albedo and roughness per fragment from true world position.
 * Deterministic: the same material + options always compiles to the same
 * shader and therefore always looks the same. No extra GPU resource is
 * allocated — the injected code lives inside the material's own compiled
 * program, so the existing `material.dispose()` calls already release it.
 */
function withVariation<T extends Material>(material: T, options: VariationOptions): T {
  const { scale, colorVariation, roughnessVariation = 0, seed, anisotropy = [1, 1, 1] } = options;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uVarScale = { value: scale };
    shader.uniforms.uVarColor = { value: colorVariation };
    shader.uniforms.uVarRough = { value: roughnessVariation };
    shader.uniforms.uVarSeed = { value: seed };
    shader.uniforms.uVarAnisotropy = { value: anisotropy };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAureliaWorldPos;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n  vAureliaWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  {
    vec3 np = vAureliaWorldPos * uVarAnisotropy * uVarScale;
    float n = aureliaNoise(np) - 0.5;
    float n2 = aureliaNoise(np * 3.7 + 11.0) - 0.5;
    float tone = n * 0.7 + n2 * 0.3;
    diffuseColor.rgb *= 1.0 + tone * uVarColor;
  }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
  roughnessFactor = clamp(
    roughnessFactor + (aureliaNoise(vAureliaWorldPos * uVarAnisotropy * uVarScale * 1.6 + 5.0) - 0.5) * uVarRough,
    0.04,
    1.0
  );`,
      );
  };

  // Every instance of this exact material shares one compiled program.
  material.customProgramCacheKey = () => `aurelia-var-${seed}-${scale}-${colorVariation}`;

  return material;
}

let cache: ReturnType<typeof createMaterials> | null = null;

function createMaterials() {
  return {
    /**
     * Refined architectural concrete — a fair-faced, newly-cast finish.
     * Fine-grained tonal noise reads as subtle formwork/aggregate character
     * at close range and disappears into a flat premium surface from the
     * hero camera distance.
     */
    concrete: withVariation(standard({ color: '#c6c0b3', roughness: 0.72, metalness: 0.02 }), {
      scale: 1.1,
      colorVariation: 0.028,
      roughnessVariation: 0.05,
      seed: 11,
    }),
    /**
     * Honed limestone / travertine — warm off-white, restrained natural
     * irregularity. Coarser noise cells than concrete so it reads as large
     * quarried slabs, not aggregate.
     */
    stone: withVariation(standard({ color: '#d3c9b8', roughness: 0.78, metalness: 0 }), {
      scale: 0.55,
      colorVariation: 0.045,
      roughnessVariation: 0.08,
      seed: 23,
    }),
    terrain: standard({ color: '#15151a', roughness: 1, metalness: 0 }),
    /** Legacy Phase 1 diagnostic massing only — kept simple deliberately. */
    glass: standard({
      color: '#0d1418',
      roughness: 0.08,
      metalness: 0.9,
      transparent: true,
      opacity: 0.72,
    }),
    /** Architectural bronze hardware accents. */
    bronze: withVariation(standard({ color: '#a9885a', roughness: 0.32, metalness: 0.82 }), {
      scale: 3,
      colorVariation: 0.02,
      roughnessVariation: 0.04,
      seed: 3,
    }),
    /**
     * Reveals, trim, soffits, slab shadow lines — satin dark anodized
     * aluminum. Lifted off pure black and pulled back from maximum
     * metalness so it still picks up the hemisphere fill in shadow instead
     * of reading as a flat cutout; the subtle roughness noise is what a
     * brushed anodized finish looks like without a texture.
     */
    darkMetal: withVariation(standard({ color: '#24242a', roughness: 0.38, metalness: 0.78 }), {
      scale: 1.4,
      colorVariation: 0.02,
      roughnessVariation: 0.06,
      seed: 61,
    }),
    /**
     * Window frames, mullions, railings, and columns. Deliberately far less
     * metallic than `darkMetal`: with no environment map to reflect, a high
     * metalness reads as flat black, and slim frames disappear against the
     * glass behind them.
     */
    frameMetal: withVariation(standard({ color: '#403a32', roughness: 0.36, metalness: 0.32 }), {
      scale: 2,
      colorVariation: 0.018,
      roughnessVariation: 0.04,
      seed: 17,
    }),
    /**
     * Dark luxury timber, used only for the entrance leaf. Anisotropic
     * noise compressed along the vertical axis so it reads as grain running
     * the height of the door rather than a blotchy stain.
     */
    wood: withVariation(standard({ color: '#3f3025', roughness: 0.52, metalness: 0.05 }), {
      scale: 5,
      colorVariation: 0.05,
      roughnessVariation: 0.06,
      seed: 7,
      anisotropy: [1, 0.1, 1],
    }),
    /**
     * Architectural glazing. Clearcoat rather than transmission: it reads as
     * deep reflective glass without the render-target cost transmission adds
     * on mobile GPUs. Double-sided so interiors are not hollow from behind.
     * Kept free of the procedural-noise pass — glass should read flawless
     * and machined, not organic.
     */
    glazing: new MeshPhysicalMaterial({
      color: '#141f28',
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      reflectivity: 0.68,
      transparent: true,
      opacity: 0.58,
      side: DoubleSide,
    }),
    /**
     * Glazing applied to the face of a solid volume. Opaque, because there is
     * no void behind it to see into — transparency would read as tinted film
     * over the wall rather than as a window.
     */
    glazingSurface: new MeshPhysicalMaterial({
      color: '#17242e',
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      reflectivity: 0.68,
    }),
    /**
     * Pool water. Clearcoat gives a wet specular response without the cost
     * of transmission/refraction — deliberately cheap, per the Phase 2C
     * constraint against reflection render targets or simulated water. A
     * very low-amplitude noise pass reads as gentle depth variation across
     * the surface rather than a perfectly flat plane of colour.
     */
    poolWater: withVariation(
      new MeshPhysicalMaterial({
        color: '#0a2b2a',
        roughness: 0.06,
        metalness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.9,
      }),
      { scale: 0.3, colorVariation: 0.05, seed: 71 },
    ),
    /** Dark plaster pool interior — basin, steps, and the infinity channel. */
    poolInterior: withVariation(standard({ color: '#0d1416', roughness: 0.85, metalness: 0 }), {
      scale: 1.6,
      colorVariation: 0.03,
      roughnessVariation: 0.05,
      seed: 29,
    }),
    /** Tree trunks and major branches — vertical grain, like the entrance wood. */
    bark: withVariation(standard({ color: '#453a2f', roughness: 0.9, metalness: 0 }), {
      scale: 2.4,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 41,
      anisotropy: [1, 0.18, 1],
    }),
    /** Sunlit foliage — canopy, shrubs, hedges. Muted sage, not garden green. */
    foliageMid: withVariation(standard({ color: '#5c6a4c', roughness: 0.86, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 53,
    }),
    /** Shadowed foliage, layered under `foliageMid` for depth without a texture. */
    foliageDark: withVariation(standard({ color: '#3a4433', roughness: 0.9, metalness: 0 }), {
      scale: 0.9,
      colorVariation: 0.06,
      roughnessVariation: 0.05,
      seed: 59,
    }),
    /** Ornamental grass — warmer and drier than the foliage greens. */
    grass: withVariation(standard({ color: '#7c8259', roughness: 0.82, metalness: 0 }), {
      scale: 1.3,
      colorVariation: 0.05,
      roughnessVariation: 0.04,
      seed: 67,
    }),
    /** Exposed soil in planting beds and planter tops. */
    soil: withVariation(standard({ color: '#2b2318', roughness: 0.98, metalness: 0 }), {
      scale: 1.8,
      colorVariation: 0.05,
      roughnessVariation: 0.03,
      seed: 79,
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
