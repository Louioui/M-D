// Streams GLBs with byte-level progress, decodes Draco in a bounded worker pool,
// and runs engine analysis in engineDetailWorker before the engine canvas mounts
// (badge analysis runs afterwards, without blocking the hero).
import { BufferAttribute, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace, RGBAFormat, RepeatWrapping, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { deviceProfile } from './deviceTier.ts';
import type { DetailMessage, DetailRequest, DetailStage, MeshInput } from '../workers/engineDetailWorker.ts';
import { publish } from './loadProgress.ts';
import { createAsyncResourceCache } from './asyncResource.ts';
import { webgl2Available } from './graphics.ts';

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

const glbCache = createAsyncResourceCache<string, GLTF>();
function loadGLB(url: string, onProgress: (fraction: number) => void) {
  return glbCache(url, () => fetchWithProgress(url, onProgress).then(buffer => gltfLoader().parseAsync(buffer, '/models/')));
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

type DetailResult = Extract<DetailMessage, { type: 'done' }>;

function workerInput(geometry: BufferGeometry, withTangents: boolean): MeshInput {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv'), index = geometry.getIndex();
  if (!index || !(position.array instanceof Float32Array) || !normal || !(normal.array instanceof Float32Array)) {
    throw new Error('Detail analysis needs indexed Float32 geometry.');
  }
  return {
    positions: position.array.slice(), normals: normal.array.slice(),
    uvs: withTangents && uv && uv.array instanceof Float32Array ? uv.array.slice() : null,
    index: index.array instanceof Uint32Array || index.array instanceof Uint16Array ? index.array.slice() : Uint32Array.from(index.array),
  };
}

function runDetailWorker(meshes: MeshInput[], detailSize: number, onProgress?: (stage: DetailStage, value: number) => void) {
  return new Promise<DetailResult>((resolve, reject) => {
    const request: DetailRequest = { meshes, detailSize };
    const worker = new Worker(new URL('../workers/engineDetailWorker.ts', import.meta.url), { type: 'module', name: 'md-surface-detail' });
    worker.onmessage = ({ data }: MessageEvent<DetailMessage>) => {
      if (data.type === 'progress') { onProgress?.(data.stage, data.value); return; }
      worker.terminate();
      if (data.type === 'done') resolve(data); else reject(new Error(data.message));
    };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message || 'Surface detail worker failed.')); };
    const transfer: Transferable[] = [];
    for (const mesh of meshes) {
      transfer.push(mesh.positions.buffer, mesh.normals.buffer, mesh.index.buffer);
      if (mesh.uvs) transfer.push(mesh.uvs.buffer);
    }
    worker.postMessage(request, transfer);
  });
}

// ---------- Badge analysis ----------
/**
 * Curvature/cavity for every badge part plus the forged-steel atlas. Runs after
 * the badge is already on screen: BadgeModel renders with neutral attributes
 * and upgrades in place when this lands, so the hero never waits on it.
 * Resolves null on failure (the badge simply keeps its neutral surface data).
 */
let badgeDetail: Promise<DataTexture | null> | null = null;
export function loadBadgeDetail() {
  return badgeDetail ??= loadBadge().then(async gltf => {
    const geometries: BufferGeometry[] = [];
    gltf.scene.traverse(object => { if (object instanceof Mesh && !geometries.includes(object.geometry)) geometries.push(object.geometry); });
    const result = await runDetailWorker(geometries.map(geometry => workerInput(geometry, false)), deviceProfile().tier === 'desktop' ? 1024 : 512);
    geometries.forEach((geometry, i) => {
      geometry.setAttribute('aCurvature', new BufferAttribute(result.meshes[i].curvature, 1));
      geometry.setAttribute('aCavity', new BufferAttribute(result.meshes[i].cavity, 1));
    });
    console.info(`[md] badge detail ready: ${geometries.length} parts, ${result.detailSize}px forged-steel atlas, worker ${Math.round(result.milliseconds)} ms`);
    return makeDetailTexture(result.detail, result.detailSize);
  }).catch(error => { console.error('[md] badge detail analysis failed; keeping neutral surface data.', error); return null; });
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
      const weights = { curvature: [0, .45], tangents: [.45, .1], maps: [.55, .45] } as const;
      const result = await runDetailWorker([workerInput(geometry, true)], profile.detailSize, (stage, value) => {
        const [start, span] = weights[stage];
        publish({ stage, engineDetail: start + span * value });
      });
      const { tangents, curvature, cavity } = result.meshes[0];
      console.info(`[md] ${profile.tier} engine ready: download ${Math.round(downloaded - started)} ms, Draco decode ${Math.round(decoded - downloaded)} ms, ` +
        `worker analysis ${Math.round(result.milliseconds)} ms (${count.toLocaleString()} vertices, ${result.detailSize}px atlas), total ${Math.round(performance.now() - started)} ms`);
      if (tangents) geometry.setAttribute('tangent', new BufferAttribute(tangents, 4));
      geometry.setAttribute('aCurvature', new BufferAttribute(curvature, 1));
      geometry.setAttribute('aCavity', new BufferAttribute(cavity, 1));
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
  // Keep the rejected promise stable so the section's error boundary can render
  // its fallback instead of restarting the download on every Suspense retry.
  engineAssets.catch(() => { publish({ stage: 'error' }); });
  return engineAssets;
}

/** Badge first (critical path for the hero), then the engine while the visitor reads the hero. */
export function prefetchAssets() {
  if (!webgl2Available) return;
  const idle = (callback: () => void) => typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(callback, { timeout: 2500 })
    : window.setTimeout(callback, 600);
  loadBadge().catch(() => undefined).finally(() => idle(() => {
    loadBadgeDetail().finally(() => idle(() => { loadEngineAssets().catch(() => undefined); }));
  }));
}
