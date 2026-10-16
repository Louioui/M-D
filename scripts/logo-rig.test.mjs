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
  assert.ok(bytes.length < 3_000_000, 'The detailed badge must stay within its 3MB budget');
  assert.ok(gltf.images.every(image => image.bufferView !== undefined), 'Textures ship inside the GLB');
  const movingMeshes = [...descendants].filter(i => gltf.nodes[i].mesh !== undefined);
  const movingDraws = movingMeshes.reduce((sum, i) => sum + gltf.meshes[gltf.nodes[i].mesh].primitives.length, 0);
  assert.ok(movingDraws <= 5, 'Small hardware must be batched into at most five gear draw calls');
  const triangles = gltf.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, p) => count + gltf.accessors[p.indices].count / 3, 0), 0);
  assert.ok(triangles < 180_000, 'Extra detail must remain within the mobile geometry budget');
  const steel = gltf.materials.find(m => m.name === 'Brushed forged steel');
  assert.ok(steel.normalTexture && steel.pbrMetallicRoughness.metallicRoughnessTexture,
    'Metal grain needs lighting-responsive normal and roughness maps');
});
