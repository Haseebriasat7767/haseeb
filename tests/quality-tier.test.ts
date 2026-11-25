import { describe, expect, it } from 'vitest';
import { decideTier } from '@/hooks/useQualityTier';

/**
 * The one-shot frame-time probe's decision table. The probe itself needs a
 * renderer and rAF; the decision it makes from a measured average does not,
 * so it is tested here.
 */
describe('decideTier', () => {
  it('promotes medium to high when frames are comfortably fast', () => {
    expect(decideTier('medium', 10)).toBe('high');
  });

  it('keeps medium in the middle band', () => {
    expect(decideTier('medium', 20)).toBe('medium');
  });

  it('demotes medium to low when frames are slow', () => {
    expect(decideTier('medium', 45)).toBe('low');
  });

  it('demotes high to medium when frames are slow', () => {
    expect(decideTier('high', 30)).toBe('medium');
  });

  it('keeps high when frames are fast', () => {
    expect(decideTier('high', 10)).toBe('high');
  });

  it('never promotes low — save-data and small-device protections stay', () => {
    expect(decideTier('low', 5)).toBe('low');
    expect(decideTier('low', 500)).toBe('low');
  });
});
