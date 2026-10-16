// Off-main-thread camera spline, bounds fit, quaternion slerp and gear velocity.
// Messages are small Float32Arrays whose buffers ping-pong as Transferables.
import {
  BADGE_IN, BADGE_OUT, CHANNEL, ENGINE_OUT, createBadgeState, createEngineState, setFraming, solveBadge, solveEngine,
} from '../lib/cameraSolver.ts';

interface WorkerScope {
  onmessage: ((event: MessageEvent<Float32Array>) => void) | null;
  postMessage(message: Float32Array, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;
const engine = createEngineState(), badge = createBadgeState();

scope.onmessage = ({ data }) => {
  const channel = data[0];
  if (channel === CHANNEL.framing) { setFraming(engine, data.subarray(1)); return; }
  if (channel === CHANNEL.engine) {
    const out = data.length >= ENGINE_OUT.length ? data : new Float32Array(ENGINE_OUT.length);
    const input = Float32Array.from(data);
    scope.postMessage(solveEngine(engine, input, out), [out.buffer]);
  } else if (channel === CHANNEL.badge) {
    const input = data.slice(0, BADGE_IN.length);
    const out = data.length >= BADGE_OUT.length ? data : new Float32Array(BADGE_OUT.length);
    scope.postMessage(solveBadge(badge, input, out), [out.buffer]);
  }
};
