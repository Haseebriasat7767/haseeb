import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CUBE_FACE_ORDER,
  clearPanoramaCache,
  cubeFaceUrls,
  loadPanorama,
  panoramaCacheSize,
  peekPanorama,
  releasePanorama,
  setPanoramaCacheLimit,
  type PanoramaLoaders,
  type PanoramaSource,
} from '@/lib/pano/panoLoader';
import type { CubeTexture, Texture } from 'three';

/**
 * The cache is the point of this module, and it is the part that can be
 * tested without a GPU: three's loaders need `Image`, deciding whether to
 * call them does not.
 */

type Fake = { dispose: ReturnType<typeof vi.fn> };

function fakeTexture(): Fake {
  return { dispose: vi.fn() };
}

function countingLoaders(resolveNow = true) {
  const cubeCalls: string[][] = [];
  const equirectCalls: string[] = [];
  const pending: Array<() => void> = [];

  const loaders: PanoramaLoaders = {
    loadCube(urls) {
      cubeCalls.push([...urls]);
      const texture = fakeTexture() as unknown as CubeTexture;
      if (resolveNow) return Promise.resolve(texture);
      return new Promise((resolve) => pending.push(() => resolve(texture)));
    },
    loadEquirect(url) {
      equirectCalls.push(url);
      return Promise.resolve(fakeTexture() as unknown as Texture);
    },
  };

  return { loaders, cubeCalls, equirectCalls, flush: () => pending.forEach((run) => run()) };
}

const living: PanoramaSource = { kind: 'cube', id: 'living', basePath: '/assets/pano/living' };

afterEach(() => {
  clearPanoramaCache();
  setPanoramaCacheLimit(6);
});

describe('cube face URLs', () => {
  it('emits the six faces in the order CubeTextureLoader reads them', () => {
    expect(cubeFaceUrls(living)).toEqual(
      CUBE_FACE_ORDER.map((face) => `/assets/pano/living/${face}.jpg`),
    );
    expect(CUBE_FACE_ORDER).toEqual(['px', 'nx', 'py', 'ny', 'pz', 'nz']);
  });

  it('honours a custom extension and tolerates a trailing slash', () => {
    expect(
      cubeFaceUrls({ kind: 'cube', id: 'x', basePath: '/pano/x/', extension: 'webp' })[0],
    ).toBe('/pano/x/px.webp');
  });
});

describe('panorama cache', () => {
  it('fetches a panorama once, however many times it is asked for', async () => {
    const { loaders, cubeCalls } = countingLoaders();

    await loadPanorama(living, loaders);
    await loadPanorama(living, loaders);
    await loadPanorama(living, loaders);

    expect(cubeCalls).toHaveLength(1);
    expect(panoramaCacheSize()).toBe(1);
  });

  it('joins callers that arrive while the first request is still open', async () => {
    // The case a resolved-only cache misses: two hotspots clicked in the
    // same frame both miss the cache, and both fetch.
    const { loaders, cubeCalls, flush } = countingLoaders(false);

    const first = loadPanorama(living, loaders);
    const second = loadPanorama(living, loaders);
    expect(cubeCalls).toHaveLength(1);

    flush();
    expect(await first).toBe(await second);
  });

  it('does not remember a failed load, so the room can be retried', async () => {
    let attempts = 0;
    const loaders: PanoramaLoaders = {
      loadCube() {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(fakeTexture() as unknown as CubeTexture);
      },
      loadEquirect: () => Promise.reject(new Error('unused')),
    };

    await expect(loadPanorama(living, loaders)).rejects.toThrow('offline');
    await expect(loadPanorama(living, loaders)).resolves.toMatchObject({ id: 'living' });
    expect(attempts).toBe(2);
  });

  it('evicts the least recently used panorama and frees its texture', async () => {
    const { loaders } = countingLoaders();
    setPanoramaCacheLimit(2);

    const a = await loadPanorama({ ...living, id: 'a' }, loaders);
    await loadPanorama({ ...living, id: 'b' }, loaders);
    // Touching 'a' makes 'b' the oldest.
    await loadPanorama({ ...living, id: 'a' }, loaders);
    await loadPanorama({ ...living, id: 'c' }, loaders);

    expect(panoramaCacheSize()).toBe(2);
    expect(peekPanorama('b')).toBeUndefined();
    expect(peekPanorama('a')).toBe(a);
    expect(peekPanorama('c')).toBeDefined();
  });

  it('disposes the GPU texture when a panorama is released', async () => {
    const { loaders } = countingLoaders();
    const loaded = await loadPanorama(living, loaders);
    const dispose = loaded.texture.dispose as unknown as ReturnType<typeof vi.fn>;

    releasePanorama('living');

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(panoramaCacheSize()).toBe(0);
  });

  it('supports an equirectangular source as the single-image fallback', async () => {
    const { loaders, equirectCalls } = countingLoaders();
    const loaded = await loadPanorama(
      { kind: 'equirect', id: 'sky', url: '/assets/pano/sky.jpg' },
      loaders,
    );

    expect(loaded.kind).toBe('equirect');
    expect(equirectCalls).toEqual(['/assets/pano/sky.jpg']);
  });
});
