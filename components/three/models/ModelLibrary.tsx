'use client';

import { useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useSyncExternalStore } from 'react';
import { MeshStandardMaterial, type Group, type Material, type Mesh, type Object3D } from 'three';

/**
 * The loader for the Blender-authored furniture in `public/assets/models`.
 *
 * ## Why a library rather than a component per piece
 *
 * Every one of these pieces appears several times — three cushioned chairs
 * in a lounge, a nightstand either side of a bed, a dozen vessels along a
 * shelf. Loading a `.glb` once and re-using its geometry is the difference
 * between one network request and twelve, and between one upload to the GPU
 * and twelve. `useGLTF` caches by URL, so the fetch is shared for free; what
 * this adds is a single place that knows the piece names, wires the Draco
 * decoder, and hands back something safe to mount many times.
 *
 * ## Draco, and the CDN that must not be used
 *
 * The exporter compresses every mesh with Draco, so the decoder has to be
 * available at runtime. It is vendored into `/assets/draco/` deliberately:
 * the site is not to acquire a third-party runtime dependency, and it has
 * to keep working offline and behind a strict content policy.
 *
 * Getting that right is one specific argument. `useGLTF`'s second parameter
 * looks like a boolean switch, and passing `true` silently points the
 * loader at Google's `gstatic.com` CDN — which works on any developer's
 * machine, fails closed on a locked-down network, and had every model in
 * this room hanging on a blocked tunnel with the loading screen stuck at
 * 77 per cent. Passing the decoder PATH instead is what keeps it local.
 */

export const DRACO_PATH = '/assets/draco/';
const MODEL_PATH = '/assets/models/';

/** Every piece the library knows: Blender-authored pieces plus CC0 Poly Haven imports (names ending in `-ph-*`). */
export type ModelName =
  // Phase 4 Blender-built pieces (taps, towels, olive, pergola,
  // door leaf, sheer curtain, board set, bath bottles). The
  // door leaf is the one exception to the centred-in-plan
  // contract: its origin is the hinge post, not the plan centre.
  | 'sofa-3seat'
  | 'sofa-ph-03'
  | 'sofa-ph-02'
  | 'sofa-sectional-white'
  | 'lounge-chair'
  | 'chair-ph-arm'
  | 'chair-ph-dining'
  | 'chair-ph-painted'
  | 'ottoman'
  | 'low-table'
  | 'table-ph-coffee'
  | 'side-drum'
  | 'table-ph-side'
  | 'bed'
  | 'bed-ph-gothic'
  | 'bed-platform-oak'
  | 'nightstand'
  | 'nightstand-ph-classic'
  | 'table-lamp'
  | 'floor-lamp'
  | 'vessel-tall'
  | 'vessel-round'
  | 'bowl'
  | 'organic-table-lg'
  | 'organic-table-sm'
  | 'stone-lounger'
  | 'wingback'
  | 'planter-cyl'
  | 'tray'
  | 'book-stack'
  | 'candle-cluster'
  | 'ceiling-soffit'
  | 'kitchen-island'
  | 'kitchen-run'
  | 'vanity'
  | 'bath'
  | 'wc'
  | 'shower-screen'
  | 'person-standing'
  | 'person-seated'
  | 'car-saloon'
  | 'car-suv'
  | 'boat-tender'
  | 'dining-table'
  | 'table-ph-dining'
  | 'dining-chair'
  | 'parasol'
  | 'outdoor-sofa'
  | 'cabana'
  | 'retail-counter'
  | 'retail-rack'
  | 'retail-shelf'
  | 'vitrine'
  | 'mannequin'
  | 'escalator'
  | 'lift-doors'
  | 'gym-bench'
  | 'gym-rack'
  | 'bar-stool'
  | 'cinema-row'
  | 'pendant'
  | 'wall-light'
  | 'planter-trough'
  | 'plant-ph-01'
  | 'tap-kitchen'
  | 'tap-bath'
  | 'towels-folded'
  | 'plant-olive'
  | 'pergola-lights'
  | 'door-balcony-open'
  | 'curtain-sheer'
  | 'kitchen-board-set'
  | 'bath-bottles'
  | 'treadmill'
  | 'treatment-table'
  | 'locker-bank';

export const MODEL_NAMES: readonly ModelName[] = [
  'sofa-3seat',
  'sofa-ph-03',
  'sofa-ph-02',
  'sofa-sectional-white',
  'lounge-chair',
  'chair-ph-arm',
  'chair-ph-dining',
  'chair-ph-painted',
  'ottoman',
  'low-table',
  'table-ph-coffee',
  'side-drum',
  'table-ph-side',
  'bed',
  'bed-ph-gothic',
  'bed-platform-oak',
  'nightstand',
  'nightstand-ph-classic',
  'table-lamp',
  'floor-lamp',
  'vessel-tall',
  'vessel-round',
  'bowl',
  'organic-table-lg',
  'organic-table-sm',
  'stone-lounger',
  'wingback',
  'planter-cyl',
  'tray',
  'book-stack',
  'candle-cluster',
  'ceiling-soffit',
  'kitchen-island',
  'kitchen-run',
  'vanity',
  'bath',
  'wc',
  'shower-screen',
  'person-standing',
  'person-seated',
  'car-saloon',
  'car-suv',
  'boat-tender',
  'dining-table',
  'table-ph-dining',
  'dining-chair',
  'parasol',
  'outdoor-sofa',
  'cabana',
  'retail-counter',
  'retail-rack',
  'retail-shelf',
  'vitrine',
  'mannequin',
  'escalator',
  'lift-doors',
  'gym-bench',
  'gym-rack',
  'bar-stool',
  'cinema-row',
  'pendant',
  'wall-light',
  'planter-trough',
  'plant-ph-01',
  'tap-kitchen',
  'tap-bath',
  'towels-folded',
  'plant-olive',
  'pergola-lights',
  'door-balcony-open',
  'curtain-sheer',
  'kitchen-board-set',
  'bath-bottles',
  'treadmill',
  'treatment-table',
  'locker-bank',
];

function url(name: ModelName): string {
  return `${MODEL_PATH}${name}.glb`;
}

/** The same path, for `InstancedModels`, which loads the pieces itself. */
export function modelUrl(name: ModelName): string {
  return url(name);
}

/**
 * The heavy dressing that does not block first paint.
 *
 * The Poly Haven pieces carry their textures embedded (chair-ph-arm is
 * 2.5 MB, table-ph-dining 2.3 MB — Draco already applied, the bytes are
 * JPEGs), and none of them is visible in an opening framing: the
 * residence hero is the exterior, the tower arrival is the site. So they
 * render nothing and load nothing until the scene reports ready, and then
 * they stream in inside their own Suspense boundary (see `Model`), which
 * is what stops a late load from re-suspending the scene and blanking the
 * canvas. Everything not listed here stays eager — the Phase 3 heroes
 * (bed-platform-oak, sofa-sectional-white), the show-unit sofa, and the
 * exterior/site models — so a future piece defaults to visible, never to
 * silently deferred.
 */
const DEFERRED_MODELS: ReadonlySet<ModelName> = new Set([
  'chair-ph-arm',
  'table-ph-dining',
  'table-ph-coffee',
  'plant-ph-01',
  'chair-ph-painted',
  'chair-ph-dining',
  'table-ph-side',
  'nightstand-ph-classic',
  'sofa-ph-03',
  'bed-ph-gothic',
]);

export function isDeferredModel(name: ModelName): boolean {
  return DEFERRED_MODELS.has(name);
}

/**
 * The deferred-model gate: closed until the first scene reports ready.
 *
 * A module-level store (not React state) because the gate is read by
 * `Model` and `InstancedModels` in different subtrees, and because the
 * opener — `ExperienceCanvas`'s ready handler — sits outside both.
 */
let deferredUnlocked = false;
const deferredListeners = new Set<() => void>();

function subscribeDeferred(listener: () => void): () => void {
  deferredListeners.add(listener);
  return () => {
    deferredListeners.delete(listener);
  };
}

function getDeferredSnapshot(): boolean {
  return deferredUnlocked;
}

/**
 * Opens the gate. Called once the first scene reports ready; idempotent,
 * so every viewport calling it is harmless.
 */
export function unlockDeferredModels(): void {
  if (deferredUnlocked) return;
  deferredUnlocked = true;
  for (const listener of deferredListeners) listener();
}

// Dead-man switch: if no scene ever reports ready (a viewport that never
// mounts, a ready signal that never fires), the dressing still arrives —
// 60 s after this module first loads, long after first paint on any real
// device, so it cannot defeat the deferral it guards.
if (typeof window !== 'undefined') {
  window.setTimeout(() => unlockDeferredModels(), 60_000);
}

export function useDeferredModelsUnlocked(): boolean {
  return useSyncExternalStore(subscribeDeferred, getDeferredSnapshot, getDeferredSnapshot);
}

/**
 * Concept-palette recolour for Poly Haven pieces whose authored fabric is
 * dark.
 *
 * Measured, not assumed (albedo means, 2026-11-24): sofa_02 is charcoal
 * (lum 21), the modern armchair's pillow is near-black (lum 18), the Gothic
 * bed is mid-brown (lum 75). The approved concept images want warm-white
 * upholstery with sage accents — a dark sofa would read as a different
 * product. The override clones the source material, drops its dark colour
 * map, keeps the normal/roughness maps (fabric relief survives), and tints
 * it warm white. Geometry stays the real Poly Haven piece; only the colour
 * is corrected to the V1VID reference. Fail-safe: a model or material name
 * with no rule returns the source unchanged.
 */
export const MODEL_MATERIAL_OVERRIDES: Partial<
  Record<ModelName, readonly { match?: string; color: number }[]>
> = {
  // Clean modern 2-seater; single dark material -> warm white.
  'sofa-ph-02': [{ color: 0xf2ede3 }],
  // Pillow (upholstered body) only; the wooden legs keep their own material.
  'chair-ph-arm': [{ match: 'modern_arm_chair_01_pillow', color: 0xf2ede3 }],
  // Single-material bed (frame + bedding in one texture) -> warm white.
  // The tall-post silhouette is still Gothic. The clean modern bed is
  // now 'bed-platform-oak' (Blender-built from the concept image);
  // this entry stays so the Gothic file remains loadable if ever used.
  'bed-ph-gothic': [{ color: 0xf2ede3 }],
};

const overrideCache = new Map<string, Material>();

export function overriddenMaterial(model: ModelName, source: Material): Material {
  const rules = MODEL_MATERIAL_OVERRIDES[model];
  if (!rules) return source;
  const name = (source as { name?: string }).name ?? '';
  const rule = rules.find((r) => r.match === undefined || r.match === name);
  if (!rule) return source;
  const key = `${model}:${name}`;
  const hit = overrideCache.get(key);
  if (hit) return hit;
  const clone = source.clone() as MeshStandardMaterial;
  clone.map = null;
  clone.color.set(rule.color);
  overrideCache.set(key, clone);
  return clone;
}

/**
 * Attaches the Draco decoder to the shared GLTF loader.
 *
 * `useGLTF` takes an extension callback and runs it against the loader it
 * builds, which is where this belongs — configuring at module scope would
 * run before any loader exists.
 */
/**
 * Preloads a piece, so it is in the cache before the camera arrives.
 *
 * Worth calling for anything in an opening framing: a model that streams in
 * after the frame has settled reads as a pop, which is worse than not
 * having it there at all.
 */
export function preloadModel(name: ModelName): void {
  useGLTF.preload(url(name), DRACO_PATH);
}

/**
 * The props one placed piece takes — shared by `Model` and
 * `ModelInner` below, so the gate and the loader cannot drift apart.
 */
type ModelProps = {
  name: ModelName;
  position: [number, number, number];
  /** Turn about the vertical, in radians. */
  rotationY?: number;
  /** Uniform, or per-axis — the dining table needs a Y squash (see ApartmentGeometry). */
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/**
 * One instance of a piece, positioned by its floor contact point.
 *
 * The models are authored with their origin on the floor and centred in
 * plan, so `position` is simply where the piece stands — no per-asset
 * offset to remember — and `rotationY` turns it about its own centre rather
 * than about some corner of a bounding box.
 *
 * Dressing pieces (see `DEFERRED_MODELS`) do not block first paint:
 * until the scene reports ready they render nothing and load nothing,
 * and after the gate opens they load inside their own Suspense
 * boundary, so a streaming model can never re-suspend the scene and
 * blank the canvas.
 */
export function Model(props: ModelProps) {
  const unlocked = useDeferredModelsUnlocked();
  if (isDeferredModel(props.name) && !unlocked) return null;
  if (isDeferredModel(props.name)) {
    return (
      <Suspense fallback={null}>
        <ModelInner {...props} />
      </Suspense>
    );
  }
  return <ModelInner {...props} />;
}

function ModelInner({
  name,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
  receiveShadow = true,
}: ModelProps) {
  const { scene } = useGLTF(url(name), DRACO_PATH);

  // A cloned graph per instance: three cannot draw one Object3D in two
  // places, and mutating the cached scene would move every other instance
  // with it. The clone shares geometry and materials — the expensive parts
  // — so this stays cheap.
  const instance = useMemo(() => {
    const copy = scene.clone(true) as Group;
    copy.traverse((child: Object3D) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      // Concept-palette recolour (see MODEL_MATERIAL_OVERRIDES): dark
      // authored fabric becomes warm white. A mesh may carry several
      // materials; only the matched ones are replaced.
      const mat = mesh.material as Material | Material[];
      mesh.material = Array.isArray(mat)
        ? mat.map((m) => overriddenMaterial(name, m))
        : overriddenMaterial(name, mat);
    });
    return copy;
  }, [scene, castShadow, receiveShadow, name]);

  return (
    <primitive object={instance} position={position} rotation={[0, rotationY, 0]} scale={scale} />
  );
}

export default Model;
