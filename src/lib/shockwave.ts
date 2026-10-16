// Reassembly shockwave: decides *when* the exploded engine "lands" and shapes
// the visual front (and the optional clack) that follows. Pure, no three.js.
import { SPLIT_CLOSE } from './splitTimeline.ts';

export interface ShockTrigger {
  /** True once the assembly has been meaningfully exploded since the last shockwave. */
  armed: boolean;
  /** Split amount on the previous frame. */
  last: number;
}
export const createShockTrigger = (): ShockTrigger => ({ armed: false, last: 0 });

/** Explosion depth that arms the trigger, and the "landed" threshold that fires it. */
export const ARM_AT = .6;
export const LAND_AT = .02;

/**
 * Called once per rendered frame with the damped split amount (0 = assembled,
 * 1 = fully exploded) and the scroll progress through the tour (0..1).
 * Returns true on exactly the frame the shockwave should fire.
 *
 * Only the end-of-tour snap (progress past SPLIT_CLOSE[0]) earns the clack.
 * Any other landing (a slow scroll back up through 75% → 25%, or switching
 * SPLIT PARTS off mid-tour) disarms silently. Hysteresis (arm high, fire low,
 * disarm on every landing) means jitter around a threshold can never fire twice.
 */
export function shouldShock(trigger: ShockTrigger, amount: number, progress: number): boolean {
  const previous = trigger.last;
  trigger.last = amount;
  if (amount >= ARM_AT) trigger.armed = true;
  if (trigger.armed && previous > LAND_AT && amount <= LAND_AT) {
    trigger.armed = false;
    return progress >= SPLIT_CLOSE[0];
  }
  return false;
}

/** Seconds the front takes to cross the assembly. */
export const SHOCK_SECONDS = .9;

/**
 * Front radius (model-scaled world units) and strength at `elapsed` seconds:
 * a fast-out expanding ring whose glow decays as it travels.
 * Returns strength 0 once the wave has passed (lets the demand loop go idle).
 */
export function shockAt(elapsed: number, reach = 2.4) {
  if (elapsed < 0 || elapsed >= SHOCK_SECONDS) return { radius: 0, strength: 0 };
  const t = elapsed / SHOCK_SECONDS;
  return { radius: reach * (1 - Math.pow(1 - t, 3)), strength: Math.pow(1 - t, 2) };
}
