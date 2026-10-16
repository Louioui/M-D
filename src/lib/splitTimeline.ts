/** Exploded view opens over 25–75% of the tour (power2.inOut). */
export const SPLIT_OPEN = [.25, .75] as const;
/** …then snaps back together over 90–100% (power3.in: slow lift-off, hard landing). */
export const SPLIT_CLOSE = [.9, 1] as const;

/** Same eased segments as the GSAP timeline in EngineShowcase, without 3D imports. */
export function splitAt(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - SPLIT_OPEN[0]) / (SPLIT_OPEN[1] - SPLIT_OPEN[0])));
  const open = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const c = Math.max(0, Math.min(1, (progress - SPLIT_CLOSE[0]) / (SPLIT_CLOSE[1] - SPLIT_CLOSE[0])));
  return open * (1 - c * c * c);
}
