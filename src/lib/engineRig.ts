import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { ENGINE_SCALE } from '../enginePath.ts';

/** Rest transforms are immutable. Scrubbing either way never accumulates drift. */
export function createEngineRig(model: Object3D) {
  model.updateMatrixWorld(true);
  const parts: { mesh: Mesh; rest: Vector3; travel: Vector3; corners: Vector3[]; internal: boolean }[] = [];
  const box = new Box3(), corner = new Vector3();
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const raw = object.userData.mdExplode;
    const travel = Array.isArray(raw) && raw.length === 3 && raw.every(Number.isFinite) ? new Vector3(...raw as [number, number, number]) : new Vector3();
    object.geometry.computeBoundingBox();
    box.copy(object.geometry.boundingBox!).applyMatrix4(object.matrixWorld);
    const corners: Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x,y,z));
    parts.push({ mesh: object, rest: object.position.clone(), travel, corners, internal: Boolean(object.userData.mdInternal) });
  });
  const framing = new Float32Array(parts.length * 8 * 3);
  // Telemetry beams: rest centre → current centre for every part that travels
  // (model space, drawn inside the scaled engine group). `beamEnds` tags each
  // vertex 0 (anchor) or 1 (moving part) so a shader can send pulses outward.
  const movers = parts.filter(part => part.travel.lengthSq() > 0);
  const centres = movers.map(part => part.corners.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / 8));
  const beams = new Float32Array(movers.length * 6), beamEnds = new Float32Array(movers.length * 2);
  for (let i = 0; i < movers.length; i++) { centres[i].toArray(beams, i * 6); centres[i].toArray(beams, i * 6 + 3); beamEnds[i * 2 + 1] = 1; }
  let amount = 0, compact = false;
  return {
    parts, framing, beams, beamEnds,
    apply(value: number, mobile: boolean, xray: boolean) {
      amount = Math.max(0, Math.min(1, value)); compact = mobile;
      for (const part of parts) {
        part.mesh.position.copy(part.rest).addScaledVector(part.travel, amount * (mobile ? .55 : 1));
        part.mesh.visible = !part.internal || xray || amount > .08;
      }
      model.updateMatrixWorld(true);
      for (let i = 0; i < movers.length; i++) corner.copy(centres[i]).addScaledVector(movers[i].travel, amount * (mobile ? .55 : 1)).toArray(beams, i * 6 + 3);
      let offset = 0;
      for (const part of parts) for (const point of part.corners) {
        corner.copy(point).addScaledVector(part.travel, amount * (mobile ? .55 : 1)).multiplyScalar(ENGINE_SCALE).toArray(framing, offset);
        offset += 3;
      }
      return framing;
    },
    offsetFor(assembly: string, target: Vector3) {
      const part = parts.find(item => item.mesh.userData.mdAssembly === assembly);
      return target.copy(part?.travel ?? corner.set(0,0,0)).multiplyScalar(amount * (compact ? .55 : 1) * ENGINE_SCALE);
    },
  };
}
