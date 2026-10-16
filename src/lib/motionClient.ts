// Main-thread side of scrollWorker.ts. One request per channel is in flight;
// newer inputs coalesce (their frame deltas accumulate) until the reply lands.
import {
  BADGE_IN, BADGE_OUT, CHANNEL, ENGINE_IN, ENGINE_OUT,
  createBadgeState, createEngineState, setFraming, solveBadge, solveEngine,
} from './cameraSolver.ts';

type Listener = () => void;

class Channel {
  readonly input: Float32Array;
  readonly latest: Float32Array;
  ready = false;
  private spare: Float32Array | null;
  private pending = false;
  private queued = false;
  private accumulatedDt = 0;
  private listeners = new Set<Listener>();

  constructor(channelId: number, inputLength: number, private outputLength: number, private dtIndex: number,
    private solveLocally: (input: Float32Array, out: Float32Array) => void) {
    this.input = new Float32Array(inputLength);
    this.input[0] = channelId;
    this.latest = new Float32Array(outputLength);
    this.spare = new Float32Array(Math.max(inputLength, outputLength));
  }

  push(dt: number) {
    this.accumulatedDt += dt;
    if (!worker) { this.input[this.dtIndex] = this.accumulatedDt; this.accumulatedDt = 0; this.solveLocally(this.input, this.latest); this.ready = true; this.emit(); return; }
    if (this.pending) { this.queued = true; return; }
    this.send();
  }

  private send() {
    const buffer = this.spare ?? new Float32Array(Math.max(this.input.length, this.outputLength));
    this.spare = null;
    buffer.fill(0);
    buffer.set(this.input);
    buffer[this.dtIndex] = this.accumulatedDt;
    this.accumulatedDt = 0;
    this.pending = true;
    worker!.postMessage(buffer, [buffer.buffer]);
  }

  receive(data: Float32Array) {
    this.latest.set(data.subarray(0, this.outputLength));
    this.spare = data;
    this.pending = false;
    this.ready = true;
    if (this.queued) { this.queued = false; this.send(); }
    this.emit();
  }

  /** Worker died mid-flight: finish this request locally so nothing waits forever. */
  recover() {
    if (!this.pending && !this.queued) return;
    this.pending = this.queued = false;
    this.push(0);
  }

  subscribe(listener: Listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { this.listeners.forEach(listener => listener()); }
}

const engineState = createEngineState(), badgeState = createBadgeState();
export const engineChannel = new Channel(CHANNEL.engine, ENGINE_IN.length, ENGINE_OUT.length, ENGINE_IN.dt, (i, o) => solveEngine(engineState, i, o));
export const badgeChannel = new Channel(CHANNEL.badge, BADGE_IN.length, BADGE_OUT.length, BADGE_IN.dt, (i, o) => solveBadge(badgeState, i, o));
let framing: Float32Array | null = null;

let worker: Worker | null = null;
try {
  worker = new Worker(new URL('../workers/scrollWorker.ts', import.meta.url), { type: 'module', name: 'md-scroll-camera' });
  worker.onmessage = ({ data }: MessageEvent<Float32Array>) => {
    if (data[0] === CHANNEL.engine) engineChannel.receive(data);
    else if (data[0] === CHANNEL.badge) badgeChannel.receive(data);
  };
  worker.onerror = event => {
    console.error('[md] scroll worker failed; solving camera on the main thread.', event.message);
    worker?.terminate();
    worker = null;
    if (framing) setFraming(engineState, framing.subarray(1));
    engineChannel.recover();
    badgeChannel.recover();
  };
} catch (error) {
  console.warn('[md] module workers unavailable; solving camera on the main thread.', error);
  worker = null;
}

/** Engine support points (world space, flattened xyz) used by the bounds fit. */
export function sendFraming(points: ArrayLike<number>) {
  framing = new Float32Array(points.length + 1);
  framing[0] = CHANNEL.framing;
  framing.set(points, 1);
  setFraming(engineState, points);
  worker?.postMessage(framing.slice());
}

export const usingWorker = () => worker !== null;
