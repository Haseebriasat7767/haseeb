import {
  CubeTextureLoader,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
  TextureLoader,
  type CubeTexture,
  type Texture,
} from 'three';

/**
 * Face order is not a style choice: `CubeTextureLoader` reads its six URLs
 * in exactly this sequence, and a cubemap assembled in any other order looks
 * plausible until you turn around.
 */
export const CUBE_FACE_ORDER = ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as const;

export type CubeFace = (typeof CUBE_FACE_ORDER)[number];

/**
 * Where a panorama's pixels come from. Six faces is the form the offline
 * renderer emits; a single equirectangular image is the fallback for
 * sources that only exist as one file.
 */
export type PanoramaSource =
  | {
      kind: 'cube';
      id: string;
      /** Directory the six faces sit in, e.g. `/assets/pano/living`. */
      basePath: string;
      /** Face file extension, without the dot. Defaults to `jpg`. */
      extension?: string;
    }
  | {
      kind: 'equirect';
      id: string;
      url: string;
    };

export type LoadedPanorama =
  | { id: string; kind: 'cube'; texture: CubeTexture }
  | { id: string; kind: 'equirect'; texture: Texture };

/**
 * The two network operations, behind an interface so the cache can be tested
 * without a DOM: three's image loaders need `Image`, the caching and
 * eviction logic does not.
 */
export type PanoramaLoaders = {
  loadCube(urls: readonly string[]): Promise<CubeTexture>;
  loadEquirect(url: string): Promise<Texture>;
};

export function cubeFaceUrls(source: Extract<PanoramaSource, { kind: 'cube' }>): string[] {
  const extension = source.extension ?? 'jpg';
  const base = source.basePath.replace(/\/+$/, '');
  return CUBE_FACE_ORDER.map((face) => `${base}/${face}.${extension}`);
}

export const defaultPanoramaLoaders: PanoramaLoaders = {
  loadCube(urls) {
    return new Promise((resolve, reject) => {
      new CubeTextureLoader().load(
        [...urls],
        (texture) => {
          texture.colorSpace = SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (error) => reject(toError(error)),
      );
    });
  },
  loadEquirect(url) {
    return new Promise((resolve, reject) => {
      new TextureLoader().load(
        url,
        (texture) => {
          texture.mapping = EquirectangularReflectionMapping;
          texture.colorSpace = SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        (error) => reject(toError(error)),
      );
    });
  },
};

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error('Panorama failed to load');
}

/** Resolved panoramas, most-recently-used last. */
const cache = new Map<string, LoadedPanorama>();

/**
 * Loads already in flight. A resolved-only cache does not actually prevent
 * duplicate requests: two hotspots clicked in the same frame both miss, and
 * both fetch. Keyed by the same id, so the second caller joins the first.
 */
const inFlight = new Map<string, Promise<LoadedPanorama>>();

let cacheLimit = 6;

/**
 * How many panoramas stay resident. A cube face set is a few megabytes of
 * GPU memory each, so this is a real ceiling rather than a tuning knob —
 * without it, a long visit accumulates every room ever entered.
 */
export function setPanoramaCacheLimit(limit: number): void {
  cacheLimit = Math.max(1, Math.floor(limit));
  evict();
}

function touch(id: string, entry: LoadedPanorama): void {
  // Re-inserting moves the key to the end of the Map's iteration order,
  // which is what makes the first key the least recently used.
  cache.delete(id);
  cache.set(id, entry);
}

function evict(): void {
  while (cache.size > cacheLimit) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    releasePanorama(oldest.value);
  }
}

export function loadPanorama(
  source: PanoramaSource,
  loaders: PanoramaLoaders = defaultPanoramaLoaders,
): Promise<LoadedPanorama> {
  const cached = cache.get(source.id);
  if (cached) {
    touch(source.id, cached);
    return Promise.resolve(cached);
  }

  const pending = inFlight.get(source.id);
  if (pending) return pending;

  const request = (
    source.kind === 'cube'
      ? loaders
          .loadCube(cubeFaceUrls(source))
          .then((texture): LoadedPanorama => ({ id: source.id, kind: 'cube', texture }))
      : loaders
          .loadEquirect(source.url)
          .then((texture): LoadedPanorama => ({ id: source.id, kind: 'equirect', texture }))
  )
    .then((loaded) => {
      inFlight.delete(source.id);
      touch(source.id, loaded);
      evict();
      return loaded;
    })
    .catch((error: unknown) => {
      // A failed load must not be remembered as in flight forever, or the
      // room can never be retried.
      inFlight.delete(source.id);
      throw toError(error);
    });

  inFlight.set(source.id, request);
  return request;
}

/** The cached panorama, without loading one. */
export function peekPanorama(id: string): LoadedPanorama | undefined {
  return cache.get(id);
}

export function panoramaCacheSize(): number {
  return cache.size;
}

/** Frees one panorama's GPU memory and forgets it. */
export function releasePanorama(id: string): void {
  const entry = cache.get(id);
  if (!entry) return;
  cache.delete(id);
  entry.texture.dispose();
}

export function clearPanoramaCache(): void {
  for (const id of [...cache.keys()]) releasePanorama(id);
  inFlight.clear();
}
