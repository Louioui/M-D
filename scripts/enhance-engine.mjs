/** Rebuilds web LODs from the untouched source. No inferred mechanical parts. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';
import { MeshBVH } from 'three-mesh-bvh';
import { BufferGeometry, BufferAttribute, Vector3, Ray, DoubleSide } from 'three';
import sharp from 'sharp';
import fs from 'node:fs/promises';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptSimplifier.ready;
const source = '../EngineM&D.glb';
const report = { source, sourceBytes: (await fs.stat(source)).size, limitations: 'Single fused scan/reconstruction mesh; no claim of separated CAD parts or manifold topology.', variants: [] };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

for (const [name, ratio, size] of [['engine-studio', .065, 4096], ['engine-mobile', .025, 2048]]) {
  const doc = await io.read(source);
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: .001 }), prune());
  const root = doc.getRoot(), primitive = root.listMeshes()[0].listPrimitives()[0];
  const positions = primitive.getAttribute('POSITION').getArray();
  const normals = primitive.getAttribute('NORMAL').getArray();
  const uv = primitive.getAttribute('TEXCOORD_0').getArray();
  const indices = primitive.getIndices().getArray();
  console.log(name, 'geometry', positions.length / 3, 'vertices', indices.length / 3, 'triangles');

  // Offline hemispherical ray sampling. This costs nothing in the render loop.
  const geo = new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex(new BufferAttribute(indices.slice(), 1));
  const bvh = new MeshBVH(geo, { maxLeafTris: 10 });
  const ray = new Ray(), normal = new Vector3(), tangent = new Vector3(), bitangent = new Vector3(), axis = new Vector3();
  const ao = new Float32Array(positions.length / 3), rays = 12;
  let aoMin = 1, aoSum = 0;
  for (let i = 0; i < ao.length; i++) {
    normal.fromArray(normals, i * 3).normalize();
    axis.set(Math.abs(normal.y) > .9 ? 1 : 0, Math.abs(normal.y) > .9 ? 0 : 1, 0);
    tangent.crossVectors(axis, normal).normalize(); bitangent.crossVectors(normal, tangent);
    ray.origin.fromArray(positions, i * 3).addScaledVector(normal, .0025);
    let occlusion = 0;
    const phase = ((i * 16807) % 65536) / 65536 * Math.PI * 2;
    for (let s = 0; s < rays; s++) {
      const r = Math.sqrt((s + .5) / rays), a = s * 2.3999632297 + phase;
      ray.direction.copy(normal).multiplyScalar(Math.sqrt(1 - r * r))
        .addScaledVector(tangent, Math.cos(a) * r).addScaledVector(bitangent, Math.sin(a) * r);
      const hit = bvh.raycastFirst(ray, DoubleSide, .001, .12);
      if (hit) occlusion += 1 - hit.distance / .12;
    }
    ao[i] = 1 - .48 * occlusion / rays;
    aoMin = Math.min(aoMin, ao[i]); aoSum += ao[i];
  }
  console.log(name, 'AO sampled', { min: aoMin, mean: aoSum / ao.length });

  // Rasterize visibility into the existing UV atlas, then dilate its gutters.
  const bakeSize = 2048, baked = new Float32Array(bakeSize * bakeSize).fill(-1);
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t], ib = indices[t + 1], ic = indices[t + 2];
    const ax = uv[ia * 2] * (bakeSize - 1), ay = uv[ia * 2 + 1] * (bakeSize - 1);
    const bx = uv[ib * 2] * (bakeSize - 1), by = uv[ib * 2 + 1] * (bakeSize - 1);
    const cx = uv[ic * 2] * (bakeSize - 1), cy = uv[ic * 2 + 1] * (bakeSize - 1);
    const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denom) < .00001) continue;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy))); y <= Math.min(bakeSize - 1, Math.ceil(Math.max(ay, by, cy))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx))); x <= Math.min(bakeSize - 1, Math.ceil(Math.max(ax, bx, cx))); x++) {
        const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denom;
        const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denom, c = 1 - a - b;
        if (Math.min(a, b, c) >= -.02) baked[y * bakeSize + x] = a * ao[ia] + b * ao[ib] + c * ao[ic];
      }
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    const previous = baked.slice();
    for (let y = 1; y < bakeSize - 1; y++) for (let x = 1; x < bakeSize - 1; x++) {
      const i = y * bakeSize + x;
      if (previous[i] >= 0) continue;
      let sum = 0, count = 0;
      for (const n of [i - 1, i + 1, i - bakeSize, i + bakeSize]) if (previous[n] >= 0) { sum += previous[n]; count++; }
      if (count) baked[i] = sum / count;
    }
  }

  const mat = root.listMaterials()[0];
  const colorTexture = mat.getBaseColorTexture(), normalTexture = mat.getNormalTexture(), oldORM = mat.getMetallicRoughnessTexture();
  const color = await sharp(colorTexture.getImage()).resize(size, size).removeAlpha().raw().toBuffer();
  const originalORM = await sharp(oldORM.getImage()).resize(bakeSize, bakeSize).removeAlpha().raw().toBuffer();
  const smallColor = await sharp(colorTexture.getImage()).resize(bakeSize, bakeSize).removeAlpha().raw().toBuffer();
  const orm = Buffer.alloc(bakeSize * bakeSize * 3);
  for (let i = 0; i < bakeSize * bakeSize; i++) {
    const k = i * 3, luminance = (smallColor[k] + smallColor[k + 1] + smallColor[k + 2]) / 765;
    const metal = originalORM[k + 2] / 255;
    const polymer = 1 - clamp((luminance - .16) / .21);
    const cast = clamp((luminance - .35) / .35);
    orm[k] = Math.round(clamp(baked[i] < 0 ? 1 : baked[i]) * 255);
    orm[k + 1] = Math.round(clamp(.37 + cast * .12 + polymer * .31, .28, .85) * 255);
    orm[k + 2] = Math.round(clamp((.72 + metal * .24) * (1 - polymer * .98)) * 255);
  }
  colorTexture.setImage(await sharp(color, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 88 }).toBuffer()).setMimeType('image/webp').setName('Engine authored base color');
  normalTexture.setImage(await sharp(normalTexture.getImage()).resize(size, size).webp({ quality: 90 }).toBuffer()).setMimeType('image/webp').setName('Engine authored tangent normals');
  const packed = doc.createTexture('Baked crevice AO + calibrated roughness + metalness')
    .setImage(await sharp(orm, { raw: { width: bakeSize, height: bakeSize, channels: 3 } }).resize(1024, 1024).webp({ lossless: true }).toBuffer()).setMimeType('image/webp');
  mat.setName('Studio automotive PBR').setMetallicRoughnessTexture(packed).setOcclusionTexture(packed).setOcclusionStrength(.75).setRoughnessFactor(1).setMetallicFactor(1);
  mat.getOcclusionTextureInfo().setMinFilter(9987).setMagFilter(9729);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  root.listMeshes()[0].setName('Original engine surface — optimized, not CAD separated');
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }));
  const target = `public/models/${name}.glb`;
  await io.write(target, doc);
  report.variants.push({ target, bytes: (await fs.stat(target)).size, triangles: indices.length / 3, vertices: ao.length, colorAndNormalSize: size, ormSize: 1024, aoRaysPerVertex: rays, aoMin, aoMean: aoSum / ao.length });
  console.log(report.variants.at(-1));
  geo.dispose();
}
await fs.writeFile('design/engine-studio-asset-report.json', JSON.stringify(report, null, 2) + '\n');
