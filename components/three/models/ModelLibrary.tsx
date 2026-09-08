'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type { Group, Mesh, Object3D } from 'three';

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

/** Every piece `tools/blender/models.py` exports. */
export type ModelName =
  | 'sofa-3seat'
  | 'lounge-chair'
  | 'ottoman'
  | 'low-table'
  | 'side-drum'
  | 'bed'
  | 'nightstand'
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
  | 'treadmill'
  | 'treatment-table'
  | 'locker-bank';

export const MODEL_NAMES: readonly ModelName[] = [
  'sofa-3seat',
  'lounge-chair',
  'ottoman',
  'low-table',
  'side-drum',
  'bed',
  'nightstand',
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
 * One instance of a piece, positioned by its floor contact point.
 *
 * The models are authored with their origin on the floor and centred in
 * plan, so `position` is simply where the piece stands — no per-asset
 * offset to remember — and `rotationY` turns it about its own centre rather
 * than about some corner of a bounding box.
 */
export function Model({
  name,
  position,
  rotationY = 0,
  scale = 1,
  castShadow = true,
  receiveShadow = true,
}: {
  name: ModelName;
  position: [number, number, number];
  /** Turn about the vertical, in radians. */
  rotationY?: number;
  scale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
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
    });
    return copy;
  }, [scene, castShadow, receiveShadow]);

  return (
    <primitive object={instance} position={position} rotation={[0, rotationY, 0]} scale={scale} />
  );
}

export default Model;
