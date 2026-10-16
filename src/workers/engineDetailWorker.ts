// Off-main-thread mesh analysis and procedural surface synthesis for the engine
// casting and the badge parts. Inputs are copies of the decoded geometry (the
// live geometry stays attached on the main thread); every result returns as a
// zero-copy Transferable.
import { computeCurvature, computeTangents, generateDetailAtlas, type IndexArray } from '../lib/meshDetail.ts';

export interface MeshInput {
  positions: Float32Array;
  normals: Float32Array;
  /** null skips tangents (meshes without UVs, or callers that shade from derivatives). */
  uvs: Float32Array | null;
  index: IndexArray;
}
export interface DetailRequest {
  meshes: MeshInput[];
  detailSize: number;
}
export interface MeshResult { tangents: Float32Array | null; curvature: Float32Array; cavity: Float32Array }
export type DetailStage = 'curvature' | 'tangents' | 'maps';
export type DetailMessage =
  | { type: 'progress'; stage: DetailStage; value: number }
  | { type: 'done'; meshes: MeshResult[]; detail: Uint8Array; detailSize: number; milliseconds: number }
  | { type: 'error'; message: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<DetailRequest>) => void) | null;
  postMessage(message: DetailMessage, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = ({ data }) => {
  const started = performance.now();
  const progress = (stage: DetailStage) => (value: number) => scope.postMessage({ type: 'progress', stage, value });
  try {
    const total = data.meshes.reduce((sum, mesh) => sum + mesh.positions.length, 0) || 1;
    let done = 0;
    const meshes = data.meshes.map(mesh => {
      const share = mesh.positions.length / total, before = done;
      const { curvature, cavity } = computeCurvature(mesh.positions, mesh.index, 2, value => progress('curvature')(before + value * share));
      done += share;
      const tangents = mesh.uvs ? computeTangents(mesh.positions, mesh.normals, mesh.uvs, mesh.index) : null;
      return { tangents, curvature, cavity };
    });
    progress('tangents')(1);
    const detail = generateDetailAtlas(data.detailSize, progress('maps'));
    const transfer: Transferable[] = [detail.buffer];
    for (const mesh of meshes) {
      transfer.push(mesh.curvature.buffer, mesh.cavity.buffer);
      if (mesh.tangents) transfer.push(mesh.tangents.buffer);
    }
    scope.postMessage({ type: 'done', meshes, detail, detailSize: data.detailSize, milliseconds: performance.now() - started }, transfer);
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
