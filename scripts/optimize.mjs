import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,simplify,textureCompress,draco,prune} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import {MeshoptSimplifier} from 'meshoptimizer';
import fs from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule(),'draco3d.decoder':await draco3d.createDecoderModule()});
await MeshoptSimplifier.ready;
const stats=[];
for (const [source,target,ratio] of [['../M&D3dmodel.glb','logo.glb',.08],['../EngineM&D.glb','engine.glb',.025]]) {
 const doc=await io.read(source);
 await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio,error:.02}),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048]}),draco({method:'edgebreaker'}));
 await io.write('public/models/'+target,doc);
 stats.push({source,target,originalBytes:(await fs.stat(source)).size,optimizedBytes:(await fs.stat('public/models/'+target)).size});
 console.log(stats.at(-1));
}
await fs.writeFile('design/asset-report.json',JSON.stringify(stats,null,2));
