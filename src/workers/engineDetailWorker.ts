// Off-main-thread mesh analysis and procedural surface synthesis. Inputs are
// copies of the decoded geometry (the live geometry stays attached on the main
// thread); every result returns as a zero-copy Transferable.
import { computeCurvature, computeTangents, generateDetailAtlas, type IndexArray } from '../lib/meshDetail.ts';

export interface DetailRequest {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array | null;
  index: IndexArray;
  detailSize: number;
}
export type DetailStage = 'curvature' | 'tangents' | 'maps';
export type DetailMessage =
  | { type: 'progress'; stage: DetailStage; value: number }
  | { type: 'done'; tangents: Float32Array | null; curvature: Float32Array; cavity: Float32Array; detail: Uint8Array; detailSize: number; milliseconds: number }
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
    const { curvature, cavity } = computeCurvature(data.positions, data.index, 2, progress('curvature'));
    const tangents = data.uvs ? computeTangents(data.positions, data.normals, data.uvs, data.index) : null;
    progress('tangents')(1);
    const detail = generateDetailAtlas(data.detailSize, progress('maps'));
    const transfer: Transferable[] = [curvature.buffer, cavity.buffer, detail.buffer];
    if (tangents) transfer.push(tangents.buffer);
    scope.postMessage({ type: 'done', tangents, curvature, cavity, detail, detailSize: data.detailSize, milliseconds: performance.now() - started }, transfer);
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
