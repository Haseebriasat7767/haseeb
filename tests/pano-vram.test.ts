import { describe, expect, it } from 'vitest';
import { FACE_SIZES, peakMiB, resolveFaceSize, vramPerRoomMiB } from '@/scripts/lib/vram.mjs';

describe('panorama VRAM', () => {
  it('computes the per-room cost of each allowed face size', () => {
    expect(vramPerRoomMiB(1024)).toBe(24);
    expect(vramPerRoomMiB(1536)).toBe(54);
    expect(vramPerRoomMiB(2048)).toBe(96);
  });

  it('peaks at limit + 1, because the crossfade holds the outgoing shell', () => {
    expect(peakMiB(1024, 6, { mips: false })).toBe(24 * 7);
    expect(peakMiB(1024, 1, { mips: false })).toBe(48);
  });

  it('defaults to counting mipmaps, because three builds them by default', () => {
    // CubeTexture extends Texture, whose default minFilter is
    // LinearMipmapLinearFilter. A default of false would understate by a third.
    expect(peakMiB(1024, 6)).toBeCloseTo(24 * 7 * (4 / 3), 6);
    expect(peakMiB(1024, 6)).toBeGreaterThan(peakMiB(1024, 6, { mips: false }));
  });

  it('adds an in-flight term only when asked, since there is no prefetch', () => {
    expect(peakMiB(1024, 6, { mips: false, inFlight: 0 })).toBe(168);
    expect(peakMiB(1024, 6, { mips: false, inFlight: 2 })).toBe(216);
  });

  it('refuses a face size that is not on the list', () => {
    expect(() => resolveFaceSize(undefined)).toThrow(/must be one of/);
    expect(() => resolveFaceSize('900')).toThrow(/must be one of/);
    expect(() => resolveFaceSize('4096')).toThrow(/must be one of/);
    for (const size of FACE_SIZES) expect(resolveFaceSize(String(size))).toBe(size);
  });
});
