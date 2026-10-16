// Pure geometry + texture synthesis for engineDetailWorker.ts. No three.js
// imports, so the worker bundle stays small and Node tests can run it directly.

export type IndexArray = Uint32Array | Uint16Array;

/**
 * Per-vertex tangent frames by Lengyel's UV-gradient accumulation (the method
 * behind BufferGeometry.computeTangents). xyz = tangent, w = bitangent sign.
 */
export function computeTangents(positions: Float32Array, normals: Float32Array, uvs: Float32Array, index: IndexArray) {
  const count = positions.length / 3;
  const tan1 = new Float32Array(count * 3), tan2 = new Float32Array(count * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const x1 = positions[b * 3] - positions[a * 3], y1 = positions[b * 3 + 1] - positions[a * 3 + 1], z1 = positions[b * 3 + 2] - positions[a * 3 + 2];
    const x2 = positions[c * 3] - positions[a * 3], y2 = positions[c * 3 + 1] - positions[a * 3 + 1], z2 = positions[c * 3 + 2] - positions[a * 3 + 2];
    const s1 = uvs[b * 2] - uvs[a * 2], t1 = uvs[b * 2 + 1] - uvs[a * 2 + 1];
    const s2 = uvs[c * 2] - uvs[a * 2], t2 = uvs[c * 2 + 1] - uvs[a * 2 + 1];
    const det = s1 * t2 - s2 * t1;
    if (!Number.isFinite(1 / det) || Math.abs(det) < 1e-14) continue;
    const r = 1 / det;
    const sx = (t2 * x1 - t1 * x2) * r, sy = (t2 * y1 - t1 * y2) * r, sz = (t2 * z1 - t1 * z2) * r;
    const tx = (s1 * x2 - s2 * x1) * r, ty = (s1 * y2 - s2 * y1) * r, tz = (s1 * z2 - s2 * z1) * r;
    for (const v of [a, b, c]) {
      tan1[v * 3] += sx; tan1[v * 3 + 1] += sy; tan1[v * 3 + 2] += sz;
      tan2[v * 3] += tx; tan2[v * 3 + 1] += ty; tan2[v * 3 + 2] += tz;
    }
  }
  const out = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    let tx = tan1[v * 3], ty = tan1[v * 3 + 1], tz = tan1[v * 3 + 2];
    // Gram-Schmidt against the normal.
    const d = nx * tx + ny * ty + nz * tz;
    tx -= nx * d; ty -= ny * d; tz -= nz * d;
    let len = Math.hypot(tx, ty, tz);
    if (len < 1e-10) {
      // Degenerate UVs: any vector perpendicular to the normal is valid.
      tx = Math.abs(nx) < .9 ? 0 : 1; ty = Math.abs(nx) < .9 ? -nz : 0; tz = Math.abs(nx) < .9 ? ny : 0;
      const e = nx * tx + ny * ty + nz * tz; tx -= nx * e; ty -= ny * e; tz -= nz * e;
      len = Math.hypot(tx, ty, tz) || 1;
    }
    tx /= len; ty /= len; tz /= len;
    // Handedness: is (n × t) aligned with the accumulated bitangent?
    const cx = ny * tz - nz * ty, cy = nz * tx - nx * tz, cz = nx * ty - ny * tx;
    const w = cx * tan2[v * 3] + cy * tan2[v * 3 + 1] + cz * tan2[v * 3 + 2] < 0 ? -1 : 1;
    out[v * 4] = tx; out[v * 4 + 1] = ty; out[v * 4 + 2] = tz; out[v * 4 + 3] = w;
  }
  return out;
}

/**
 * Welds coincident vertices (UV/normal seams split them) so creases between
 * separately-indexed surfaces still share edges. Returns canonical ids.
 */
export function weldVertices(positions: Float32Array, tolerance = 1e-5) {
  const count = positions.length / 3, canonical = new Uint32Array(count);
  const K = 2 / tolerance + 1, ids = new Map<number, number>();
  let unique = 0;
  for (let v = 0; v < count; v++) {
    const qx = Math.round(positions[v * 3] / tolerance) + 1 / tolerance;
    const qy = Math.round(positions[v * 3 + 1] / tolerance) + 1 / tolerance;
    const qz = Math.round(positions[v * 3 + 2] / tolerance) + 1 / tolerance;
    const key = (qx * K + qy) * K + qz;
    let id = ids.get(key);
    if (id === undefined) { id = unique++; ids.set(key, id); }
    canonical[v] = id;
  }
  return { canonical, unique };
}

function percentile(values: Float32Array, predicate: (v: number) => boolean, p: number) {
  const sample: number[] = [];
  const stride = Math.max(1, Math.floor(values.length / 60000));
  for (let i = 0; i < values.length; i += stride) if (predicate(values[i])) sample.push(Math.abs(values[i]));
  if (!sample.length) return 1;
  sample.sort((a, b) => a - b);
  return sample[Math.min(sample.length - 1, Math.floor(sample.length * p))] || 1;
}

/**
 * Signed dihedral curvature. Every interior edge contributes its dihedral angle,
 * positive when convex (bolt heads, bosses, gear tips) and negative when concave
 * (crevices, tooth roots, flange seams). Values normalize to 0..1 by the 92nd
 * percentile and receive light Laplacian smoothing to suppress triangle noise.
 */
export function computeCurvature(positions: Float32Array, index: IndexArray, smoothing = 2, onProgress?: (fraction: number) => void) {
  const { canonical, unique } = weldVertices(positions);
  const triangles = index.length / 3;
  const faceNormals = new Float32Array(triangles * 3), centroids = new Float32Array(triangles * 3);
  for (let f = 0; f < triangles; f++) {
    const a = index[f * 3] * 3, b = index[f * 3 + 1] * 3, c = index[f * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    faceNormals.set([nx, ny, nz], f * 3);
    centroids[f * 3] = (positions[a] + positions[b] + positions[c]) / 3;
    centroids[f * 3 + 1] = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    centroids[f * 3 + 2] = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
  }
  onProgress?.(.25);

  const sum = new Float32Array(unique), hits = new Float32Array(unique);
  const open = new Map<number, number>();
  for (let f = 0; f < triangles; f++) {
    for (let e = 0; e < 3; e++) {
      const p = canonical[index[f * 3 + e]], q = canonical[index[f * 3 + (e + 1) % 3]];
      if (p === q) continue;
      const key = p < q ? p * unique + q : q * unique + p;
      const other = open.get(key);
      if (other === undefined) { open.set(key, f); continue; }
      open.delete(key);
      const dot = faceNormals[f * 3] * faceNormals[other * 3] + faceNormals[f * 3 + 1] * faceNormals[other * 3 + 1] + faceNormals[f * 3 + 2] * faceNormals[other * 3 + 2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      // Convex when the neighbour's centroid sits behind this face's plane.
      const side = faceNormals[f * 3] * (centroids[other * 3] - centroids[f * 3]) +
        faceNormals[f * 3 + 1] * (centroids[other * 3 + 1] - centroids[f * 3 + 1]) +
        faceNormals[f * 3 + 2] * (centroids[other * 3 + 2] - centroids[f * 3 + 2]);
      const signed = side < 0 ? angle : -angle;
      sum[p] += signed; sum[q] += signed; hits[p]++; hits[q]++;
    }
  }
  onProgress?.(.7);

  let mean = new Float32Array(unique);
  for (let v = 0; v < unique; v++) mean[v] = hits[v] ? sum[v] / hits[v] : 0;
  for (let pass = 0; pass < smoothing; pass++) {
    const acc = new Float32Array(unique), n = new Float32Array(unique);
    for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) {
      const p = canonical[index[t + e]], q = canonical[index[t + (e + 1) % 3]];
      acc[p] += mean[q]; n[p]++; acc[q] += mean[p]; n[q]++;
    }
    const next = new Float32Array(unique);
    for (let v = 0; v < unique; v++) next[v] = n[v] ? mean[v] * .5 + acc[v] / n[v] * .5 : mean[v];
    mean = next;
  }
  const convexScale = percentile(mean, v => v > 0, .92), concaveScale = percentile(mean, v => v < 0, .92);
  const count = positions.length / 3;
  const curvature = new Float32Array(count), cavity = new Float32Array(count);
  for (let v = 0; v < count; v++) {
    const k = mean[canonical[v]];
    curvature[v] = k > 0 ? Math.min(1, k / convexScale) : 0;
    cavity[v] = k < 0 ? Math.min(1, -k / concaveScale) : 0;
  }
  onProgress?.(1);
  return { curvature, cavity };
}

// ---------- Procedural tileable detail atlas ----------

/** Deterministic lattice of random values; sampling wraps so every map tiles. */
function lattice(width: number, height: number, seed: number) {
  const values = new Float32Array(width * height);
  let s = seed >>> 0;
  for (let i = 0; i < values.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    values[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return { values, width, height };
}
type Lattice = ReturnType<typeof lattice>;

/** Smooth periodic value noise at texture coordinate u,v in [0,1). */
function sample(l: Lattice, u: number, v: number) {
  const x = u * l.width, y = v * l.height;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  let fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % l.width) + l.width) % l.width, xb = (xa + 1) % l.width;
  const ya = ((y0 % l.height) + l.height) % l.height, yb = (ya + 1) % l.height;
  const a = l.values[ya * l.width + xa], b = l.values[ya * l.width + xb];
  const c = l.values[yb * l.width + xa], d = l.values[yb * l.width + xb];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Deep-stamped forged steel: 0.5 is the polished plane, lower values are
 * fatigue pits and tool gouges, higher values are burnished scratch lips.
 * Scratches are rasterized with wrapped pixel indices, so the field tiles.
 */
function forgedSteel(size: number, unit: number) {
  const field = new Float32Array(size * size);
  const grain = lattice(Math.round(160 * unit), Math.round(160 * unit), 51), pits = lattice(Math.round(96 * unit), Math.round(96 * unit), 52);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, pit = Math.max(0, (sample(pits, u, v) - .84) / .16);
    field[y * size + x] = .5 + (sample(grain, u, v) - .5) * .08 - pit * pit * .38;
  }
  // Scratches: short, mostly-parallel strokes (tool marks) plus random scuffs.
  const random = lattice(4096, 1, 53).values;
  const strokes = Math.round(700 * unit * unit);
  for (let s = 0; s < strokes; s++) {
    const r = (k: number) => random[(s * 6 + k) % random.length];
    const tool = r(0) < .6;
    const angle = tool ? .35 + (r(1) - .5) * .25 : r(1) * Math.PI;
    const length = (tool ? 18 + r(2) * 60 : 6 + r(2) * 26) * unit, depth = .1 + r(3) * .22;
    const dx = Math.cos(angle), dy = Math.sin(angle), x0 = r(4) * size, y0 = r(5) * size;
    for (let t = 0; t < length; t++) {
      const fade = Math.sin(Math.PI * t / length);
      const px = Math.round(x0 + dx * t), py = Math.round(y0 + dy * t);
      const at = (ox: number, oy: number) => ((((py + oy) % size) + size) % size) * size + ((((px + ox) % size) + size) % size);
      field[at(0, 0)] -= depth * fade;
      // Displaced metal piles up as a bright lip beside the groove.
      const lip = at(Math.round(-dy), Math.round(dx));
      field[lip] += depth * fade * .45;
    }
  }
  return field;
}

/**
 * RGBA8 atlas, one height field per channel:
 *  R — sand-cast aluminum: foundry fBm with sparse shrinkage pores.
 *  G — CNC brushed steel: long anisotropic streaks (sampled radially on the flywheel).
 *  B — glass-filled polymer: jittered-cell stipple like molded composite.
 *  A — deep-stamped forged steel: scratches, tool marks and fatigue pitting (badge).
 * Feature sizes scale with the atlas so tiers look alike.
 */
export function generateDetailAtlas(size: number, onProgress?: (fraction: number) => void) {
  const pixels = new Uint8Array(size * size * 4);
  const unit = size / 512;
  const forged = forgedSteel(size, unit);
  const sand = [lattice(Math.round(24 * unit), Math.round(24 * unit), 11), lattice(Math.round(48 * unit), Math.round(48 * unit), 12),
    lattice(Math.round(96 * unit), Math.round(96 * unit), 13), lattice(Math.round(192 * unit), Math.round(192 * unit), 14)];
  const pores = lattice(Math.round(128 * unit), Math.round(128 * unit), 21);
  const streaks = [lattice(6, Math.round(256 * unit), 31), lattice(12, Math.round(512 * unit), 32)];
  const cells = Math.round(64 * unit), jitter = lattice(cells, cells, 41), jitter2 = lattice(cells, cells, 42);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size, o = (y * size + x) * 4;
      const fbm = sample(sand[0], u, v) * .45 + sample(sand[1], u, v) * .27 + sample(sand[2], u, v) * .17 + sample(sand[3], u, v) * .11;
      const pit = Math.max(0, (sample(pores, u, v) - .8) / .2);
      const r = fbm * .85 + .15 - pit * pit * .6;
      const g = sample(streaks[0], u, v) * .6 + sample(streaks[1], u, v) * .4;
      // Stipple: distance to the nearest jittered cell centre (periodic 3×3 search).
      const cx = u * cells, cy = v * cells, ix = Math.floor(cx), iy = Math.floor(cy);
      let nearest = 9;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const gx = ((ix + ox) % cells + cells) % cells, gy = ((iy + oy) % cells + cells) % cells;
        const px = ix + ox + jitter.values[gy * cells + gx] * .8 + .1, py = iy + oy + jitter2.values[gy * cells + gx] * .8 + .1;
        nearest = Math.min(nearest, (px - cx) ** 2 + (py - cy) ** 2);
      }
      const b = 1 - Math.min(1, Math.sqrt(nearest) / .62);
      pixels[o] = Math.max(0, Math.min(255, r * 255));
      pixels[o + 1] = Math.max(0, Math.min(255, g * 255));
      pixels[o + 2] = Math.max(0, Math.min(255, b * b * (3 - 2 * b) * 255));
      pixels[o + 3] = Math.max(0, Math.min(255, forged[y * size + x] * 255));
    }
    if (onProgress && (y & 63) === 0) onProgress(y / size);
  }
  onProgress?.(1);
  return pixels;
}
