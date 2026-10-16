// Asset loading progress (read by the loading gauge, never by animation frames).
// Kept free of three.js so the first-paint bundle stays small.
import type { DetailStage } from '../workers/engineDetailWorker.ts';

export interface LoadProgress { badge: number; engineBytes: number; engineDetail: number; stage: 'idle' | 'download' | 'decode' | DetailStage | 'ready' | 'error' }
const progress: LoadProgress = { badge: 0, engineBytes: 0, engineDetail: 0, stage: 'idle' };
const listeners = new Set<() => void>();
let notificationPending = false;
export const publish = (patch: Partial<LoadProgress>) => {
  Object.assign(progress, patch);
  // A Suspense resource may start during render. Notify subscribers afterward,
  // coalescing streamed chunks rather than updating another component in render.
  if (!notificationPending) {
    notificationPending = true;
    queueMicrotask(() => { notificationPending = false; listeners.forEach(listener => listener()); });
  }
};
export const getProgress = () => progress;
export function subscribeProgress(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
let snapshot = { ...progress };
/** Stable snapshot for useSyncExternalStore. */
export function progressSnapshot() {
  if (snapshot.badge !== progress.badge || snapshot.engineBytes !== progress.engineBytes || snapshot.engineDetail !== progress.engineDetail || snapshot.stage !== progress.stage) snapshot = { ...progress };
  return snapshot;
}
