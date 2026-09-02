import type { Vector3Tuple } from 'three';
import type { BoxSpec } from '../VillaTypes';

/**
 * One of the very few real dynamic lights the exterior carries. Every entry
 * here costs another iteration in the shader of every lit fragment in the
 * scene, so the list is ranked: the resolved quality tier and the time of
 * day between them decide how far down it the renderer gets.
 */
export type FixtureLight = {
  key: string;
  kind: 'point' | 'spot';
  position: Vector3Tuple;
  /** Spot only — where the beam is aimed. */
  target?: Vector3Tuple;
  /** Relative weight; the lighting state supplies the absolute candela. */
  intensity: number;
  /** Falloff radius in metres, so one fixture never washes the whole site. */
  distance: number;
  color: string;
  /** Spot only — cone half-angle in radians. */
  angle?: number;
  /** Spot only — edge softness, 0–1. */
  penumbra?: number;
};

/**
 * The exterior lighting scheme, resolved from the villa's plan and the
 * site's own bounds. Fixtures are geometry — recessed slots, in-ground
 * grazers, pool niches — and are merged per material like everything else;
 * the dynamic lights are separate and deliberately few.
 */
export type ArchitecturalLightingLayout = {
  /** Emissive lit faces — what the eye actually reads as a fixture. */
  glow: BoxSpec[];
  /** Dark housings and reveals that make each fixture read as recessed. */
  housings: BoxSpec[];
  lights: FixtureLight[];
};

export type ArchitecturalLightingConfig = {
  /** Depth a ceiling slot is recessed above its housing face. */
  slotRecess: number;
  /** Height of a linear in-ground grazer above the paving it sits in. */
  grazerHeight: number;
  /** Width of every linear fixture, glow face included. */
  slotWidth: number;
  /** How far a pool niche sits below the coping line. */
  poolNicheDrop: number;
  /** Half-size of a round-ish in-ground marker puck. */
  markerRadius: number;
  /** Clear distance kept between a linear fixture and the wall it washes. */
  wallOffset: number;
};
