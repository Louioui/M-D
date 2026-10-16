// Opt-in engine sound, fully synthesized with WebAudio: no audio files, nothing
// plays until the visitor presses SOUND (a user gesture), and the context is
// suspended whenever the engine section is off screen or the tab is hidden.

const IDLE_RPM = 760;
/** Four-stroke, four cylinders: two power strokes per crank revolution. */
export const FIRING_HZ = IDLE_RPM / 60 * 2;

/** Normalized RMS (0..1) of a time-domain buffer; the vibration drive. */
export function rmsLevel(samples: Float32Array, gain = 3) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * gain);
}

interface Graph { ctx: AudioContext; master: GainNode; analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>; noise: AudioBuffer }

let graph: Graph | null = null;
let enabled = false, active = false;

function build(): Graph | null {
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const master = ctx.createGain(); master.gain.value = 0;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
  master.connect(analyser); analyser.connect(ctx.destination);
  // Idle: sawtooth at the firing frequency + its octave through a low-pass,
  // with a slow LFO so the idle "hunts" a little like a real engine.
  const body = ctx.createOscillator(); body.type = 'sawtooth'; body.frequency.value = FIRING_HZ;
  const octave = ctx.createOscillator(); octave.type = 'triangle'; octave.frequency.value = FIRING_HZ * 2;
  const lfo = ctx.createOscillator(); lfo.frequency.value = .7;
  const lfoDepth = ctx.createGain(); lfoDepth.gain.value = .6;
  lfo.connect(lfoDepth); lfoDepth.connect(body.frequency); lfoDepth.connect(octave.frequency);
  const octaveGain = ctx.createGain(); octaveGain.gain.value = .4;
  const lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 220; lowpass.Q.value = .8;
  const idle = ctx.createGain(); idle.gain.value = .32;
  body.connect(lowpass); octave.connect(octaveGain); octaveGain.connect(lowpass); lowpass.connect(idle); idle.connect(master);
  body.start(); octave.start(); lfo.start();
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * .2), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return { ctx, master, analyser, samples: new Float32Array(analyser.fftSize), noise };
}

function apply() {
  if (!graph) return;
  const { ctx, master } = graph, on = enabled && active, now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(on ? .5 : 0, now, .12);
  if (on) void ctx.resume();
  else window.setTimeout(() => { if (graph && !(enabled && active)) void graph.ctx.suspend(); }, 600);
}

export const engineAudio = {
  get enabled() { return enabled; },
  /** Must be called from a click/tap handler: browsers only start audio on a gesture. */
  setEnabled(next: boolean) {
    enabled = next;
    if (next && !graph) graph = build();
    apply();
  },
  /** Section visible and tab in front. */
  setActive(next: boolean) { active = next; apply(); },
  /** Heavy metallic clack: low thud, struck-steel transient and a short ring. */
  clack() {
    if (!graph || !enabled || !active) return;
    const { ctx, master, noise } = graph, t = ctx.currentTime;
    const thud = ctx.createOscillator(), thudGain = ctx.createGain();
    thud.frequency.setValueAtTime(95, t); thud.frequency.exponentialRampToValueAtTime(42, t + .14);
    thudGain.gain.setValueAtTime(1, t); thudGain.gain.exponentialRampToValueAtTime(.001, t + .32);
    thud.connect(thudGain); thudGain.connect(master); thud.start(t); thud.stop(t + .34);
    const hit = ctx.createBufferSource(), band = ctx.createBiquadFilter(), hitGain = ctx.createGain();
    hit.buffer = noise; band.type = 'bandpass'; band.frequency.value = 2600; band.Q.value = 5;
    hitGain.gain.setValueAtTime(.7, t); hitGain.gain.exponentialRampToValueAtTime(.001, t + .12);
    hit.connect(band); band.connect(hitGain); hitGain.connect(master); hit.start(t);
    for (const [frequency, level] of [[1870, .1], [2745, .07]] as const) {
      const ring = ctx.createOscillator(), ringGain = ctx.createGain();
      ring.frequency.value = frequency;
      ringGain.gain.setValueAtTime(level, t); ringGain.gain.exponentialRampToValueAtTime(.0005, t + .7);
      ring.connect(ringGain); ringGain.connect(master); ring.start(t); ring.stop(t + .72);
    }
  },
  /** Current output level, 0 when silent; read once per rendered frame. */
  level() {
    if (!graph || !enabled || !active || graph.ctx.state !== 'running') return 0;
    graph.analyser.getFloatTimeDomainData(graph.samples);
    return rmsLevel(graph.samples);
  },
};
