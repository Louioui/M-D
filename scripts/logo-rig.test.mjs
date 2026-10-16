import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('articulated badge keeps the branding separate from the animated gear', () => {
  const bytes = readFileSync(new URL('../public/models/logo-articulated.glb', import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const gear = gltf.nodes.findIndex(n => n.name === 'GearAssembly');
  const badge = gltf.nodes.findIndex(n => n.name === 'StationaryBadge');
  assert.ok(gear >= 0 && badge >= 0);
  const roots = gltf.scenes[gltf.scene ?? 0].nodes;
  assert.ok(roots.includes(gear) && roots.includes(badge), 'Gear and branding must be sibling objects');
  const descendants = new Set();
  const visit = i => { descendants.add(i); (gltf.nodes[i].children ?? []).forEach(visit); };
  visit(gear);
  assert.ok(!descendants.has(badge), 'Branding must never inherit gear rotation');
  assert.equal(gltf.animations.length, 1);
  assert.ok(gltf.animations[0].channels.every(c => c.target.node === gear && c.target.path === 'rotation'));
  assert.ok(gltf.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert.ok(bytes.length < 2_000_000, 'The articulated badge must stay within its 2MB budget');
  assert.ok(gltf.images.every(image => image.bufferView !== undefined), 'Textures ship inside the GLB');
});
