import { CatmullRomCurve3, Vector3 } from 'three';

// The camera travels almost one full revolution, with each quarter aligned to a
// chapter. Centripetal interpolation avoids the corner changes of linear pans.
const positions = [
  [2.5, 1.65, 4.4], [-.2, 1.6, 4.1], [-3.7, 1.3, 2.8],
  [-4, 1.4, -1.5], [-.6, 1.9, -4], [3.4, 1.4, -2.6],
  [3.3, .85, 2.5], [1.4, 1, 4.5], [2.9, 1.3, 4.7],
];
const targets = [
  [0, .1, 0], [-.12, .2, .1], [-.15, .1, .15], [.05, .12, 0],
  [.1, .3, -.1], [.1, .1, -.1], [.15, -.2, 0], [0, -.15, .15], [0, .1, 0],
];
const orbit = new CatmullRomCurve3(positions.map(p => new Vector3(...p)), false, 'centripetal');
const aim = new CatmullRomCurve3(targets.map(p => new Vector3(...p)), false, 'centripetal');
export const ENGINE_FOCUS = [
  [0, .78, .12], [-.25, .08, .68], [.48, .35, -.28], [.53, -.67, .08],
];
export const chapterAt = progress => Math.min(3, Math.max(0, Math.floor(progress * 4)));
/** Reuses the caller's vectors: no per-frame object allocation. */
export function sampleEnginePath(progress, position, target, mobile = false) {
  const p = Math.max(0, Math.min(1, progress));
  orbit.getPoint(p, position);
  aim.getPoint(p, target);
  position.multiplyScalar(mobile ? .86 : .88);
  target.y -= .15;
}
