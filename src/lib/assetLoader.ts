// Streams GLBs with byte-level progress, decodes Draco in a bounded worker pool,
// and runs engine analysis in engineDetailWorker before any canvas mounts.
import { BufferAttribute, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace, RGBAFormat, RepeatWrapping, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { deviceProfile } from './deviceTier.ts';
import type { DetailMessage, DetailRequest } from '../workers/engineDetailWorker.ts';
import { publish } from './loadProgress.ts';

export const BADGE_URL = '/models/logo-articulated.glb';

// ---------- Loaders ----------
let loader: GLTFLoader | null = null;
function gltfLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader()
    .setDecoderPath('/draco/')
    .setDecoderConfig({ type: 'wasm' }) // draco_wasm_wrapper.js + draco_decoder.wasm
    .setWorkerLimit(deviceProfile().dracoWorkers);
  draco.preload();
  loader = new GLTFLoader().setDRACOLoader(draco);
  return loader;
}

/** Copies the received bytes into an exact-length ArrayBuffer for GLTFLoader.parse. */
function exact(bytes: Uint8Array, size: number) {
  const out = new ArrayBuffer(size);
  new Uint8Array(out).set(bytes.subarray(0, size));
  return out;
}

async function fetchWithProgress(url: string, onProgress: (fraction: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total) { const buffer = await response.arrayBuffer(); onProgress(1); return buffer; }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > bytes.length) { // Content-Length lied (e.g. transfer encoding): fall back to concatenation.
      const grown = new Uint8Array(Math.max(bytes.length * 2, received + value.length)); grown.set(bytes.subarray(0, received));
      return finishGrowing(reader, grown, received, value, onProgress);
    }
    bytes.set(value, received);
    received += value.length;
    onProgress(Math.min(1, received / total));
  }
  onProgress(1);
  return exact(bytes, received);
}

async function finishGrowing(reader: ReadableStreamDefaultReader<Uint8Array>, bytes: Uint8Array, received: number, first: Uint8Array, onProgress: (f: number) => void): Promise<ArrayBuffer> {
  let buffer = bytes, size = received;
  for (let chunk: Uint8Array | undefined = first; chunk; ) {
    if (size + chunk.length > buffer.length) { const grown = new Uint8Array((size + chunk.length) * 2); grown.set(buffer.subarray(0, size)); buffer = grown; }
    buffer.set(chunk, size); size += chunk.length;
    const next = await reader.read();
    chunk = next.done ? undefined : next.value;
  }
  onProgress(1);
  return exact(buffer, size);
}

const glbCache = new Map<string, Promise<GLTF>>();
function loadGLB(url: string, onProgress: (fraction: number) => void) {
  let cached = glbCache.get(url);
  if (!cached) {
    cached = fetchWithProgress(url, onProgress).then(buffer => gltfLoader().parseAsync(buffer, '/models/'));
    cached.catch(() => glbCache.delete(url)); // A failed request may be retried later.
    glbCache.set(url, cached);
  }
  return cached;
}

export const loadBadge = () => loadGLB(BADGE_URL, fraction => publish({ badge: fraction }));

// ---------- Engine analysis ----------
export interface EngineAssets {
  gltf: GLTF;
  mesh: Mesh;
  detailMap: DataTexture;
  /** True when curvature/cavity came from the worker (false: neutral fallback). */
  analyzed: boolean;
  milliseconds: number;
}

function firstMesh(root: Object3D) {
  let found: Mesh | null = null;
  let largest = 0;
  root.traverse(object => {
    if (object instanceof Mesh && object.geometry.getAttribute('position').count > largest) {
      found = object; largest = object.geometry.getAttribute('position').count;
    }
  });
  if (!found) throw new Error('Engine model contains no mesh.');
  return found as Mesh;
}

function makeDetailTexture(pixels: Uint8Array, size: number) {
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function runDetailWorker(geometry: BufferGeometry, detailSize: number) {
  return new Promise<Extract<DetailMessage, { type: 'done' }>>((resolve, reject) => {
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv'), index = geometry.getIndex();
    if (!index || !(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)) {
      reject(new Error('Engine geometry must be indexed Float32 data.')); return;
    }
    const indices = index.array instanceof Uint32Array || index.array instanceof Uint16Array ? index.array.slice() : Uint32Array.from(index.array);
    const request: DetailRequest = {
      positions: position.array.slice(), normals: normal.array.slice(),
      uvs: uv && uv.array instanceof Float32Array ? uv.array.slice() : null,
      index: indices, detailSize,
    };
    const worker = new Worker(new URL('../workers/engineDetailWorker.ts', import.meta.url), { type: 'module', name: 'md-engine-detail' });
    worker.onmessage = ({ data }: MessageEvent<DetailMessage>) => {
      if (data.type === 'progress') {
        const weights = { curvature: [0, .45], tangents: [.45, .1], maps: [.55, .45] } as const;
        const [start, span] = weights[data.stage];
        publish({ stage: data.stage, engineDetail: start + span * data.value });
        return;
      }
      worker.terminate();
      if (data.type === 'done') resolve(data); else reject(new Error(data.message));
    };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message || 'Engine detail worker failed.')); };
    const transfer: Transferable[] = [request.positions.buffer, request.normals.buffer, request.index.buffer];
    if (request.uvs) transfer.push(request.uvs.buffer);
    worker.postMessage(request, transfer);
  });
}

let engineAssets: Promise<EngineAssets> | null = null;
export function loadEngineAssets() {
  if (engineAssets) return engineAssets;
  const profile = deviceProfile();
  engineAssets = (async () => {
    publish({ stage: 'download' });
    const started = performance.now();
    let downloaded = started;
    const gltf = await loadGLB(profile.engineUrl, fraction => {
      if (fraction >= 1 && downloaded === started) downloaded = performance.now();
      publish({ engineBytes: fraction, stage: fraction < 1 ? 'download' : 'decode' });
    });
    const decoded = performance.now();
    const mesh = firstMesh(gltf.scene);
    const geometry = mesh.geometry, count = geometry.getAttribute('position').count;
    // Reconstructed hard-surface groups have explicit materials and clean normals.
    // Only the inherited casting needs the expensive reconstruction analysis.
    gltf.scene.traverse(object => {
      if (!(object instanceof Mesh) || object === mesh) return;
      const n = object.geometry.getAttribute('position').count;
      object.geometry.setAttribute('aCurvature', object.geometry.getAttribute('_curvature') ?? new BufferAttribute(new Float32Array(n).fill(.25), 1));
      object.geometry.setAttribute('aCavity', object.geometry.getAttribute('_cavity') ?? new BufferAttribute(new Float32Array(n), 1));
    });
    try {
      const result = await runDetailWorker(geometry, profile.detailSize);
      console.info(`[md] ${profile.tier} engine ready: download ${Math.round(downloaded - started)} ms, Draco decode ${Math.round(decoded - downloaded)} ms, ` +
        `worker analysis ${Math.round(result.milliseconds)} ms (${count.toLocaleString()} vertices, ${result.detailSize}px atlas), total ${Math.round(performance.now() - started)} ms`);
      if (result.tangents) geometry.setAttribute('tangent', new BufferAttribute(result.tangents, 4));
      geometry.setAttribute('aCurvature', new BufferAttribute(result.curvature, 1));
      geometry.setAttribute('aCavity', new BufferAttribute(result.cavity, 1));
      publish({ engineDetail: 1, stage: 'ready' });
      return { gltf, mesh, detailMap: makeDetailTexture(result.detail, result.detailSize), analyzed: true, milliseconds: result.milliseconds };
    } catch (error) {
      // The engine still renders: neutral attributes, flat detail texel, zones by colour only.
      console.error('[md] engine detail analysis failed; using neutral surface data.', error);
      geometry.setAttribute('aCurvature', new BufferAttribute(new Float32Array(count), 1));
      geometry.setAttribute('aCavity', new BufferAttribute(new Float32Array(count), 1));
      publish({ engineDetail: 1, stage: 'ready' });
      return { gltf, mesh, detailMap: makeDetailTexture(new Uint8Array([128, 128, 128, 255]), 1), analyzed: false, milliseconds: 0 };
    }
  })();
  engineAssets.catch(() => { engineAssets = null; publish({ stage: 'error' }); });
  return engineAssets;
}

/** Badge first (critical path for the hero), then the engine while the visitor reads the hero. */
export function prefetchAssets() {
  const idle = (callback: () => void) => typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(callback, { timeout: 2500 })
    : window.setTimeout(callback, 600);
  loadBadge().catch(() => undefined).finally(() => idle(() => { loadEngineAssets().catch(() => undefined); }));
}
