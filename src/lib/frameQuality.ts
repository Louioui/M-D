export interface FrameQualityState { level: number; slowRun: number }
/** Ignore true idle gaps; count every slow frame while the engine is animating. */
export function frameQuality(state: FrameQualityState, seconds: number, animating: boolean) {
  if (!animating || seconds <= .022) state.slowRun = 0;
  else state.slowRun++;
  if (state.slowRun >= 30 && state.level < 2) { state.level++; state.slowRun = 0; }
  return state.level;
}
