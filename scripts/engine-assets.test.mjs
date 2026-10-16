import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

async function inspect(file) {
  const buffer = await fs.readFile(new URL(`../public/models/${file}.glb`, import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB header must match payload');
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength));
  const images = await Promise.all(json.images.map(async image => {
    const view = json.bufferViews[image.bufferView];
    assert.ok(view.byteOffset + view.byteLength <= json.buffers[0].byteLength, 'Texture must be inside the GLB buffer');
    return sharp(buffer.subarray(28 + jsonLength + view.byteOffset, 28 + jsonLength + view.byteOffset + view.byteLength)).metadata();
  }));
  return { buffer, json, images };
}

test('engine LODs preserve detail within download budgets and decode their textures', async () => {
  const [desktop, mobile, old] = await Promise.all(['engine-studio', 'engine-mobile', 'engine'].map(inspect));
  const count = item => item.json.accessors[item.json.meshes[0].primitives[0].indices].count / 3;
  assert.ok(count(desktop) > count(old) * 2.5, 'Desktop must retain substantially more geometry');
  assert.ok(count(mobile) < count(desktop) * .5, 'Phone geometry must remain below half desktop');
  assert.ok(desktop.buffer.length < 9_000_000 && mobile.buffer.length < 4_500_000, 'Asset budgets exceeded');
  assert.equal(desktop.images[0].width, 4096); assert.equal(mobile.images[0].width, 2048);
});

test('studio engine exports real AO and normal channels with Draco geometry', async () => {
  const { json } = await inspect('engine-studio');
  const material = json.materials[0];
  assert.ok(material.normalTexture);
  const imageOf = index => json.textures[index].extensions.EXT_texture_webp.source;
  assert.equal(imageOf(material.occlusionTexture.index), imageOf(material.pbrMetallicRoughness.metallicRoughnessTexture.index));
  assert.ok(json.meshes[0].primitives[0].extensions.KHR_draco_mesh_compression);
  assert.ok(json.extensionsRequired.includes('KHR_draco_mesh_compression'));
});

test('rebuilt engine retains explicit mechanical finishes and compact phone geometry', async () => {
  const [desktop,mobile] = await Promise.all(['engine-rebuilt-studio','engine-rebuilt-mobile'].map(inspect));
  const count = item => item.json.meshes.reduce((n,mesh)=>n+mesh.primitives.reduce((sum,p)=>sum+item.json.accessors[p.indices].count/3,0),0);
  assert.ok(count(mobile)<count(desktop)*.6,'Phone must use substantially fewer triangles');
  assert.ok(desktop.buffer.length<9_500_000 && mobile.buffer.length<5_000_000,'Rebuilt assets must stay within budgets');
  for(const {json} of [desktop,mobile]) {
    const surfaces=json.nodes.filter(n=>n.extras?.mdRebuilt).map(n=>n.extras.mdSurface);
    assert.deepEqual([...surfaces].sort((a,b)=>a-b),[1,2,3,4,5,6,7]);
    assert.equal(json.meshes.length,8,'Hardware must be batched by finish');
    assert.ok(json.meshes.every(m=>m.primitives.every(p=>p.extensions?.KHR_draco_mesh_compression)));
    for(const node of json.nodes.filter(n=>n.extras?.mdRebuilt)){
      const p=json.meshes[node.mesh].primitives[0];
      assert.ok(p.attributes._CAVITY!==undefined && p.attributes._CURVATURE!==undefined,'New hardware must retain its baked local surface data');
    }
  }
  const report=JSON.parse(await fs.readFile(new URL('../design/engine-rebuild-report.json',import.meta.url),'utf8'));
  for(const tier of report){
    assert.ok(tier.components.length>=73);
    assert.ok(tier.components.every(c=>c.nonManifoldEdges===0),'New parts must have closed manifold edges before export');
    assert.ok(tier.components.some(c=>c.name.includes('120 beveled starter teeth')));
    assert.ok(tier.webGroups.every(g=>g.nonManifoldEdges===0),'Mobile reduction must preserve closed hardware');
  }
});
