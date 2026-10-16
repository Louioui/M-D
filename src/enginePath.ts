import { CatmullRomCurve3, Vector3 } from 'three';

export type Vec3Tuple = readonly [number, number, number];

// Guided inspection: high cover, front intake, right timing case, low flywheel.
// Keep the useful mechanical faces in view instead of circling the empty rear.
const positions: Vec3Tuple[] = [
  [2.6, 2.5, 4.5], [.8, 2, 4.3], [-1.4, 1.3, 4.1],
  [-2.7, 1, 3.6], [.6, 1.6, 4.1], [3.4, 1.2, 2.5],
  [4.1, .1, 1.8], [3.4, -.1, 2.7], [3.1, .3, 3.7],
];
const targets: Vec3Tuple[] = [
  [0, .3, 0], [-.12, .25, .1], [-.15, .1, .3], [-.1, .08, .2],
  [.25, .2, 0], [.25, .1, -.1], [.3, -.15, 0], [.25, -.25, .1], [.15, -.15, .1],
];
const orbit = new CatmullRomCurve3(positions.map(p => new Vector3(...p)), false, 'centripetal');
const aim = new CatmullRomCurve3(targets.map(p => new Vector3(...p)), false, 'centripetal');

/**
 * Inspection anchors in engine object space, measured against the supplied mesh:
 * cover top, +Z intake runners, upper +X timing/VVT housing, lower +X flexplate.
 */
export const ENGINE_FOCUS: readonly Vec3Tuple[] = [
  [0, .78, .12], [-.25, .08, .68], [.48, .35, -.28], [.53, -.67, .08],
];
/** Scale applied to the engine object in the scene; anchors and framing follow it. */
export const ENGINE_SCALE = 1.22;

export const chapterAt = (progress: number) => Math.min(3, Math.max(0, Math.floor(progress * 4)));

/** Reuses the caller's vectors: no per-frame object allocation. */
export function sampleEnginePath(progress: number, position: Vector3, target: Vector3, mobile = false) {
  const p = Math.max(0, Math.min(1, progress));
  orbit.getPoint(p, position);
  aim.getPoint(p, target);
  position.multiplyScalar(mobile ? .86 : .88);
  if (mobile) position.x *= .72;
  target.y -= .15;
}
