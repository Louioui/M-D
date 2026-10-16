import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { classifyDevice, cameraProfile } from './lib/deviceTier.ts';
import { BADGE_IN, BADGE_OUT, ENGINE_IN, ENGINE_OUT, IDLE_GEAR_SPEED, createBadgeState, createEngineState, setFraming, solveBadge, solveEngine } from './lib/cameraSolver.ts';
import { computeCurvature, computeTangents, generateDetailAtlas, weldVertices } from './lib/meshDetail.ts';
import { frameQuality } from './lib/frameQuality.ts';

test('quality governor distinguishes idle gaps from genuinely slow active frames',()=>{
  const state={level:0,slowRun:0};
  for(let i=0;i<40;i++)frameQuality(state,1,false);
  assert.equal(state.level,0,'Idle demand rendering must not downgrade quality');
  for(let i=0;i<30;i++)frameQuality(state,.4,true);
  assert.equal(state.level,1,'Even very slow active frames must trigger a downgrade');
  for(let i=0;i<29;i++)frameQuality(state,.03,true);
  frameQuality(state,.016,true);assert.equal(state.slowRun,0);
  for(let i=0;i<30;i++)frameQuality(state,.03,true);
  assert.equal(state.level,2);
});

test('device tiering routes phones/tablets/low-memory devices to the mobile engine', () => {
  const path = profile => new URL(profile.engineUrl, 'https://shop.test').pathname;
  const phone = classifyDevice({ width: 390, height: 844, coarsePointer: true });
  assert.equal(phone.tier, 'phone'); assert.deepEqual(phone.dpr, [1, 1.25]); assert.equal(path(phone), '/models/engine-rebuilt-mobile.glb'); assert.equal(phone.detailSize, 512);
  const tablet = classifyDevice({ width: 1024, height: 1366, coarsePointer: true });
  assert.equal(tablet.tier, 'tablet'); assert.deepEqual(tablet.dpr, [1, 1.5]); assert.equal(path(tablet), '/models/engine-rebuilt-mobile.glb');
  const desktop = classifyDevice({ width: 1440, height: 900, coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 12 });
  assert.equal(desktop.tier, 'desktop'); assert.deepEqual(desktop.dpr, [1, 2]); assert.equal(desktop.detailSize, 2048); assert.equal(desktop.dracoWorkers, 4);
  assert.equal(path(classifyDevice({ width: 1440, height: 900, coarsePointer: false, deviceMemory: 4 })), '/models/engine-rebuilt-mobile.glb');
  assert.equal(path(classifyDevice({ width: 900, height: 700, coarsePointer: false })), '/models/engine-rebuilt-mobile.glb');
  assert.equal(path(desktop), '/models/engine-rebuilt-studio.glb');
  for (const profile of [phone, tablet, desktop]) assert.ok(new URL(profile.engineUrl, 'https://shop.test').searchParams.get('v'), 'Model updates need a cache revision');
});

test('camera profile bands follow viewport aspect', () => {
  assert.equal(cameraProfile(16 / 9).fov, 38);
  assert.equal(cameraProfile(1).fov, 46);
  assert.equal(cameraProfile(.7).fov, 46);
  assert.equal(cameraProfile(390 / 844).fov, 52);
});

function engineInput(progress, aspect, viewportAspect = aspect, dt = 1 / 60) {
  const input = new Float32Array(ENGINE_IN.length);
  input[ENGINE_IN.channel] = 1; input[ENGINE_IN.dt] = dt; input[ENGINE_IN.progress] = progress;
  input[ENGINE_IN.aspect] = aspect; input[ENGINE_IN.viewportAspect] = viewportAspect;
  return input;
}
// Support points of a box roughly the engine's size (scaled), like prepareEngineMaterials produces.
const FRAMING = [];
for (const x of [-.87, .87]) for (const y of [-1.16, 1.16]) for (const z of [-1, 1]) FRAMING.push(x, y, z);

test('settled solver keeps every framing point inside the frustum for every aspect band', () => {
  for (const [aspect, viewport] of [[2.4, 1.6], [1, .75], [.95, 390 / 844]]) {
    const state = createEngineState(); setFraming(state, FRAMING);
    const out = new Float32Array(ENGINE_OUT.length);
    for (let i = 0; i <= 40; i++) {
      // Orientation is slerped, so check the settled pose at each scroll position.
      for (let frame = 0; frame < 240; frame++) solveEngine(state, engineInput(i / 40, aspect, viewport), out);
      const position = new Vector3(out[ENGINE_OUT.px], out[ENGINE_OUT.py], out[ENGINE_OUT.pz]);
      const q = new Quaternion(out[ENGINE_OUT.qx], out[ENGINE_OUT.qy], out[ENGINE_OUT.qz], out[ENGINE_OUT.qw]);
      const inverse = q.clone().invert(), tanY = Math.tan(out[ENGINE_OUT.fov] * Math.PI / 360);
      for (let p = 0; p < FRAMING.length; p += 3) {
        const v = new Vector3(FRAMING[p], FRAMING[p + 1], FRAMING[p + 2]).sub(position).applyQuaternion(inverse);
        assert.ok(v.z < 0, 'point in front of the camera');
        assert.ok(Math.abs(v.y / -v.z) <= tanY * 1.001, `vertical fit at aspect ${aspect}`);
        assert.ok(Math.abs(v.x / -v.z) <= tanY * aspect * 1.001, `horizontal fit at aspect ${aspect}`);
      }
    }
  }
});

test('solver damps toward the playhead and reports when it settles', () => {
  const state = createEngineState(), out = new Float32Array(ENGINE_OUT.length);
  solveEngine(state, engineInput(0, 1.6), out);
  solveEngine(state, engineInput(1, 1.6), out);
  assert.ok(out[ENGINE_OUT.progress] > 0 && out[ENGINE_OUT.progress] < .5, 'one frame moves only part of the way');
  assert.equal(out[ENGINE_OUT.settled], 0);
  for (let i = 0; i < 400; i++) solveEngine(state, engineInput(1, 1.6), out);
  assert.ok(Math.abs(out[ENGINE_OUT.progress] - 1) < 1e-3);
  assert.equal(out[ENGINE_OUT.settled], 1);
  const reduced = engineInput(.25, 1.6); reduced[ENGINE_IN.reduced] = 1;
  solveEngine(state, reduced, out);
  assert.equal(out[ENGINE_OUT.progress], .25, 'reduced motion snaps without a sweep');
});

test('fast scroll reversals keep framing points visible throughout quaternion damping',()=>{
  for(const [aspect,viewport] of [[2.4,1.6],[1.3,.46]]){
    const state=createEngineState(),out=new Float32Array(ENGINE_OUT.length);
    // A raised cover and lowered sump exercise the split assembly's tall bounds.
    const bounds=[...FRAMING,0,2.3,0,0,-1.4,0];setFraming(state,bounds);
    for(const progress of [0,1,.1,.9,.2,.8,.3,.7,1,0]){
      const input=engineInput(progress,aspect,viewport);input[ENGINE_IN.split]=progress;
      solveEngine(state,input,out);
      const inverse=new Quaternion(out[ENGINE_OUT.qx],out[ENGINE_OUT.qy],out[ENGINE_OUT.qz],out[ENGINE_OUT.qw]).invert();
      const position=new Vector3(out[ENGINE_OUT.px],out[ENGINE_OUT.py],out[ENGINE_OUT.pz]);const tan=Math.tan(out[ENGINE_OUT.fov]*Math.PI/360);
      for(let i=0;i<bounds.length;i+=3){const p=new Vector3(bounds[i],bounds[i+1],bounds[i+2]).sub(position).applyQuaternion(inverse);
        assert.ok(p.z<0);assert.ok(Math.abs(p.y/-p.z)<=tan*1.001,'Vertical bounds during an unsettled frame');assert.ok(Math.abs(p.x/-p.z)<=tan*aspect*1.001,'Horizontal bounds during an unsettled frame');}
    }
  }
});

test('badge gear idles at one rpm, follows scroll velocity both ways, and rests when reduced', () => {
  const state = createBadgeState(), out = new Float32Array(BADGE_OUT.length);
  const input = new Float32Array(BADGE_IN.length); input[BADGE_IN.dt] = .05;
  solveBadge(state, input, out);
  assert.ok(Math.abs(out[BADGE_OUT.gear] - IDLE_GEAR_SPEED * .05) < 1e-6);
  input[BADGE_IN.velocity] = -2000;
  for (let i = 0; i < 40; i++) solveBadge(state, input, out);
  assert.ok(state.speed < 0, 'scrolling up reverses the gear');
  input[BADGE_IN.reduced] = 1; solveBadge(state, input, out);
  assert.equal(out[BADGE_OUT.gear], 0); assert.equal(out[BADGE_OUT.settled], 1);
});

/** A unit cube with split (unwelded) faces, like a hard-edged GLB. */
function cube() {
  const positions = [], normals = [], uvs = [], index = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, u, v] of faces) {
    const base = positions.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      positions.push(...n.map((c, i) => c * .5 + u[i] * a * .5 + v[i] * b * .5)); normals.push(...n); uvs.push((a + 1) / 2, (b + 1) / 2);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), index: new Uint32Array(index) };
}

test('welding joins split corners; dihedral curvature marks convex edges, not cavities', () => {
  const { positions, index } = cube();
  assert.equal(weldVertices(positions).unique, 8);
  const { curvature, cavity } = computeCurvature(positions, index, 0);
  // Face diagonals add zero-angle edges, so corners differ in degree but all stay convex.
  assert.ok(curvature.every(v => v > .4), 'every cube corner is convex');
  assert.ok(cavity.every(v => v === 0));
});

test('tangents are unit length, orthogonal to normals, with a handedness sign', () => {
  const { positions, normals, uvs, index } = cube();
  const tangents = computeTangents(positions, normals, uvs, index);
  for (let v = 0; v < positions.length / 3; v++) {
    const t = tangents.subarray(v * 4, v * 4 + 4);
    assert.ok(Math.abs(Math.hypot(t[0], t[1], t[2]) - 1) < 1e-5);
    assert.ok(Math.abs(t[0] * normals[v * 3] + t[1] * normals[v * 3 + 1] + t[2] * normals[v * 3 + 2]) < 1e-5);
    assert.ok(t[3] === 1 || t[3] === -1);
  }
});

test('procedural detail atlas tiles seamlessly in every channel', () => {
  const size = 64, pixels = generateDetailAtlas(size);
  assert.equal(pixels.length, size * size * 4);
  const at = (x, y, c) => pixels[((y % size) * size + (x % size)) * 4 + c];
  for (let c = 0; c < 3; c++) {
    let edge = 0, interior = 0;
    for (let i = 0; i < size; i++) {
      edge += Math.abs(at(size - 1, i, c) - at(0, i, c)) + Math.abs(at(i, size - 1, c) - at(i, 0, c));
      interior += Math.abs(at(31, i, c) - at(32, i, c)) + Math.abs(at(i, 31, c) - at(i, 32, c));
    }
    assert.ok(edge <= interior * 1.6 + size * 4, `channel ${c} wraps like any interior seam (${edge} vs ${interior})`);
  }
  let variance = 0; for (let i = 0; i < pixels.length; i += 4) variance += Math.abs(pixels[i] - 128);
  assert.ok(variance / (size * size) > 8, 'sand-cast channel is not flat');
});
