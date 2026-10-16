/** Same power2.inOut 25–75% segment as the GSAP timeline, without 3D imports. */
export function splitAt(progress: number) {
  const t = Math.max(0, Math.min(1, (progress - .25) * 2));
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
