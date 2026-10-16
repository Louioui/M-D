// Pure camera/badge motion math. Runs inside scrollWorker.ts, and on the main
// thread only as a fallback when module workers are unavailable.
import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { sampleEnginePath } from '../enginePath.ts';
import { cameraProfile } from './deviceTier.ts';

/** Float32 message layouts shared by the worker and its client. */
export const ENGINE_IN = { channel: 0, dt: 1, progress: 2, aspect: 3, viewportAspect: 4, leanX: 5, leanY: 6, mobile: 7, reduced: 8, split: 9, length: 10 } as const;
export const ENGINE_OUT = { channel: 0, px: 1, py: 2, pz: 3, qx: 4, qy: 5, qz: 6, qw: 7, fov: 8, progress: 9, settled: 10, tx: 11, ty: 12, tz: 13, length: 14 } as const;
export const BADGE_IN = { channel: 0, dt: 1, velocity: 2, pointerX: 3, pointerY: 4, reduced: 5, length: 6 } as const;
export const BADGE_OUT = { channel: 0, gear: 1, tiltX: 2, tiltY: 3, settled: 4, length: 5 } as const;
export const CHANNEL = { engine: 1, badge: 2, framing: 3 } as const;

export const IDLE_GEAR_SPEED = Math.PI / 30; // One revolution per minute.

export interface EngineSolverState {
  progress: number;
  leanX: number;
  leanY: number;
  initialized: boolean;
  quaternion: Quaternion;
  framing: Vector3[];
}

export function createEngineState(): EngineSolverState {
  return { progress: 0, leanX: 0, leanY: 0, initialized: false, quaternion: new Quaternion(), framing: [] };
}

export function setFraming(state: EngineSolverState, points: ArrayLike<number>) {
  state.framing = [];
  for (let i = 0; i + 2 < points.length; i += 3) state.framing.push(new Vector3(points[i], points[i + 1], points[i + 2]));
}

const position = new Vector3(), target = new Vector3(), direction = new Vector3();
const right = new Vector3(), up = new Vector3(), corner = new Vector3(), worldUp = new Vector3(0, 1, 0);
const look = new Matrix4(), goal = new Quaternion();

/** Smooth playhead → camera spline → bounds fit → quaternion slerp. Writes into `out`. */
export function solveEngine(state: EngineSolverState, input: Float32Array, out: Float32Array) {
  const dt = Math.min(Math.max(input[ENGINE_IN.dt], 0), .1);
  const reduced = input[ENGINE_IN.reduced] > .5, mobile = input[ENGINE_IN.mobile] > .5;
  const goalProgress = input[ENGINE_IN.progress];
  state.progress = reduced || !state.initialized ? goalProgress : MathUtils.damp(state.progress, goalProgress, 11, dt);
  state.leanX = reduced ? 0 : MathUtils.damp(state.leanX, input[ENGINE_IN.leanX], 7, dt);
  state.leanY = reduced ? 0 : MathUtils.damp(state.leanY, input[ENGINE_IN.leanY], 7, dt);

  const profile = cameraProfile(input[ENGINE_IN.viewportAspect]);
  sampleEnginePath(state.progress, position, target, mobile);
  // Follow the raised cover in split view and look down into the assembly.
  // Otherwise the low flywheel stop wastes half the phone canvas below it.
  const split = reduced ? 0 : MathUtils.clamp(input[ENGINE_IN.split] || 0,0,1) * (mobile ? .55 : 1);
  target.y += split * .62;
  position.y += split * 1.12;
  position.sub(target).multiplyScalar(profile.distanceScale).add(target);
  position.x += state.leanX;
  position.y += state.leanY;

  direction.copy(position).sub(target).normalize();
  right.crossVectors(worldUp, direction).normalize();
  up.crossVectors(direction, right);
  const tanY = Math.tan(profile.fov * Math.PI / 360);
  // Lift the engine in frame by aiming slightly below it.
  let distance = position.distanceTo(target);
  target.addScaledVector(up, -profile.yOffset * tanY * distance);
  position.copy(target).addScaledVector(direction, distance);
  look.lookAt(position, target, worldUp);
  goal.setFromRotationMatrix(look);
  if (!state.initialized || reduced) state.quaternion.copy(goal);
  else state.quaternion.slerp(goal, 1 - Math.exp(-dt * 14));
  // Fit against the orientation actually rendered, including in-between frames.
  // Moving the camera to a new orbit while retaining its old damped rotation
  // briefly pushed the raised cover offscreen during fast split-view scrubs.
  direction.set(0,0,1).applyQuaternion(state.quaternion);
  right.set(1,0,0).applyQuaternion(state.quaternion);
  up.set(0,1,0).applyQuaternion(state.quaternion);
  // Fit the measured support points so no viewport shape can clip the engine.
  const aspect = Math.max(.2, input[ENGINE_IN.aspect]);
  const fitY = tanY * profile.frameHeight, fitX = tanY * aspect * profile.frameWidth;
  for (const point of state.framing) {
    corner.copy(point).sub(target);
    distance = Math.max(distance, corner.dot(direction) +
      Math.max(Math.abs(corner.dot(right)) / fitX, Math.abs(corner.dot(up)) / fitY));
  }
  position.copy(target).addScaledVector(direction, distance);

  state.initialized = true;

  out[ENGINE_OUT.channel] = CHANNEL.engine;
  out[ENGINE_OUT.px] = position.x; out[ENGINE_OUT.py] = position.y; out[ENGINE_OUT.pz] = position.z;
  out[ENGINE_OUT.qx] = state.quaternion.x; out[ENGINE_OUT.qy] = state.quaternion.y;
  out[ENGINE_OUT.qz] = state.quaternion.z; out[ENGINE_OUT.qw] = state.quaternion.w;
  out[ENGINE_OUT.fov] = profile.fov;
  out[ENGINE_OUT.progress] = state.progress;
  out[ENGINE_OUT.tx] = target.x; out[ENGINE_OUT.ty] = target.y; out[ENGINE_OUT.tz] = target.z;
  const unsettled = Math.abs(state.progress - goalProgress) > .00003 ||
    Math.abs(state.leanX - input[ENGINE_IN.leanX]) + Math.abs(state.leanY - input[ENGINE_IN.leanY]) > .0001 ||
    1 - Math.abs(state.quaternion.dot(goal)) > 1e-7;
  out[ENGINE_OUT.settled] = unsettled ? 0 : 1;
  return out;
}

export interface BadgeSolverState { speed: number; gear: number; tiltX: number; tiltY: number }
export const createBadgeState = (): BadgeSolverState => ({ speed: IDLE_GEAR_SPEED, gear: 0, tiltX: 0, tiltY: 0 });

/** Timing-chain gear: idles at 1 rpm, follows scroll velocity (either direction), eases back. */
export function solveBadge(state: BadgeSolverState, input: Float32Array, out: Float32Array) {
  const dt = Math.min(Math.max(input[BADGE_IN.dt], 0), .1);
  out[BADGE_OUT.channel] = CHANNEL.badge;
  if (input[BADGE_IN.reduced] > .5) {
    state.speed = IDLE_GEAR_SPEED; state.gear = 0; state.tiltX = 0; state.tiltY = 0;
  } else {
    const velocity = input[BADGE_IN.velocity];
    const target = Math.abs(velocity) > 35 ? MathUtils.clamp(velocity * .0025, -3, 3) : IDLE_GEAR_SPEED;
    state.speed = MathUtils.damp(state.speed, target, 5, dt);
    state.gear = (state.gear + state.speed * dt) % (Math.PI * 2);
    state.tiltX = MathUtils.damp(state.tiltX, input[BADGE_IN.pointerY] * .15, 7, dt);
    state.tiltY = MathUtils.damp(state.tiltY, input[BADGE_IN.pointerX] * .22, 7, dt);
  }
  out[BADGE_OUT.gear] = state.gear;
  out[BADGE_OUT.tiltX] = state.tiltX;
  out[BADGE_OUT.tiltY] = state.tiltY;
  out[BADGE_OUT.settled] = input[BADGE_IN.reduced] > .5 ? 1 : 0; // The gear idles forever otherwise.
  return out;
}
