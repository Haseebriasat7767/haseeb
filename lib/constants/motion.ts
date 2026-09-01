/** Shared easing + duration tokens so CSS, GSAP, and R3F stay in sync. */
export const EASE = {
  luxe: [0.22, 1, 0.36, 1],
  soft: [0.65, 0, 0.35, 1],
} as const;

export const DURATION = {
  fast: 0.3,
  base: 0.6,
  slow: 1.2,
  cinematic: 2.4,
} as const;
