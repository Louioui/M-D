// Device classification happens once, before any model is fetched, so phones
// never download the desktop engine or allocate desktop-sized detail maps.
export type DeviceTier = 'phone' | 'tablet' | 'desktop';

export interface DeviceSignals {
  width: number;
  height: number;
  coarsePointer: boolean;
  /** navigator.deviceMemory in GB when the browser exposes it. */
  deviceMemory?: number;
  saveData?: boolean;
  hardwareConcurrency?: number;
}

export interface TierProfile {
  tier: DeviceTier;
  engineUrl: string;
  /** Edge length of the procedural detail atlas synthesized in the worker. */
  detailSize: number;
  dpr: [number, number];
  shadows: boolean;
  clearcoat: boolean;
  dracoWorkers: number;
}

export function classifyDevice(s: DeviceSignals): TierProfile {
  const lowMemory = s.deviceMemory !== undefined && s.deviceMemory <= 4;
  const compact = s.width < 1024 || s.coarsePointer || lowMemory || Boolean(s.saveData);
  const phone = Math.min(s.width, s.height) < 768 && (s.coarsePointer || s.width < 768);
  const tier: DeviceTier = phone ? 'phone' : compact ? 'tablet' : 'desktop';
  return {
    tier,
    engineUrl: compact ? '/models/engine-rebuilt-mobile.glb' : '/models/engine-rebuilt-studio.glb',
    detailSize: compact ? 512 : 2048,
    dpr: tier === 'phone' ? [1, 1.25] : tier === 'tablet' ? [1, 1.5] : [1, 2],
    shadows: !compact,
    clearcoat: !compact,
    dracoWorkers: Math.max(1, Math.min(s.hardwareConcurrency || 4, 4)),
  };
}

export function readDeviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

let cached: TierProfile | null = null;
/** Stable for the page lifetime: a rotation must not swap models mid-session. */
export function deviceProfile() {
  return cached ??= classifyDevice(readDeviceSignals());
}

export interface CameraProfile {
  fov: number;
  /** Multiplier on the scripted camera distance (the bounds fit still wins if larger). */
  distanceScale: number;
  /** Upward image shift as a fraction of the half frame height. */
  yOffset: number;
  /** Fraction of the frame width/height the engine may occupy. */
  frameWidth: number;
  frameHeight: number;
}

/**
 * Framing bands by viewport aspect. Portrait layouts give the engine its own
 * canvas in the upper 58% of the stage, so the screen-space lift is modest here.
 *
 * The pull-back on narrow screens (spec: 1.25× tablet, 1.45× phone) is produced
 * by the camera-space bounds fit in cameraSolver, which solves the exact distance
 * at which the measured engine extremes stay inside the frame. Multiplying the
 * scripted distance as well would double-count it and shrink the engine to a
 * thumbnail, so `distanceScale` stays 1 unless a band needs extra air.
 */
export function cameraProfile(viewportAspect: number): CameraProfile {
  if (viewportAspect > 1.2) return { fov: 38, distanceScale: 1, yOffset: 0, frameWidth: .5, frameHeight: .86 };
  if (viewportAspect >= .7) return { fov: 46, distanceScale: 1, yOffset: .06, frameWidth: .9, frameHeight: .9 };
  return { fov: 52, distanceScale: 1, yOffset: .08, frameWidth: .94, frameHeight: .92 };
}
