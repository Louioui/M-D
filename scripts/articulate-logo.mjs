/** Rebuild the badge's fused rear gear as an independent, beveled steel assembly.
 * The source badge stays untouched. Mask coordinates refer to a 1000px orthographic
 * front view at a 2.15 world-unit span; the original lettering/tools retain their UVs.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, weld, dedup, simplify, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { Shape, Path, ExtrudeGeometry, CylinderGeometry, TorusGeometry, Matrix4 } from 'three';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
await MeshoptSimplifier.ready;
const doc = await io.read(process.argv[2] || '../M&D3dmodel.glb');
const root = doc.getRoot(), scene = root.listScenes()[0], buffer = root.listBuffers()[0];
const source = root.listMeshes()[0].listPrimitives()[0];
const positions = source.getAttribute('POSITION'), indices = source.getIndices();
// Front objects are traced separately so the old fixed gear is removed rather than
// hidden behind another gear. The central circular plate remains stationary.
const silhouettes = [
  [[700,700],[914,700],[914,892],[700,892]],
  [[122,733],[278,733],[278,862],[122,862]],
  [[265,103],[448,103],[456,128],[554,127],[580,180],[581,106],[688,103],[730,158],[733,300],[694,314],[577,278],[460,272],[350,309],[269,341]],
  [[85,231],[144,212],[194,210],[226,225],[246,257],[263,301],[290,351],[339,401],[390,429],[421,477],[664,679],[720,702],[763,717],[822,723],[862,751],[881,792],[895,825],[849,797],[812,796],[792,819],[795,848],[832,870],[788,875],[755,862],[729,830],[710,786],[692,757],[646,737],[366,513],[306,463],[264,442],[220,433],[151,437],[122,433],[132,394],[110,380],[79,352],[62,318],[59,293],[82,301],[128,330],[159,332],[173,302],[168,279],[127,257],[92,247]],
  [[873,212],[833,217],[791,233],[773,259],[750,295],[750,339],[718,365],[661,406],[618,449],[588,505],[306,704],[269,727],[225,724],[184,739],[154,769],[136,810],[142,840],[165,855],[204,858],[238,843],[264,813],[268,786],[302,754],[351,729],[642,523],[706,475],[745,445],[780,412],[817,400],[870,386],[911,368],[935,336],[944,309],[934,275],[916,304],[891,321],[866,326],[840,311],[826,281],[837,259],[864,236]],
  [[75,477],[102,465],[126,464],[130,432],[198,435],[195,480],[303,481],[345,418],[651,418],[696,479],[804,479],[800,401],[840,394],[870,464],[922,479],[924,537],[908,550],[899,640],[886,661],[813,653],[744,644],[252,645],[106,665],[94,548],[78,541]],
];
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
function keep(x,y){return Math.hypot(x,y)<.665 || silhouettes.some(p=>inside(500+x/2.15*1000,500-y/2.15*1000,p));}
const retained=[],positionArray=positions.getArray();
for(let i=0;i<indices.getCount();i+=3){const face=[indices.getScalar(i),indices.getScalar(i+1),indices.getScalar(i+2)];let x=0,y=0;for(const n of face){x+=positionArray[n*3]/3;y+=positionArray[n*3+1]/3;}if(keep(x,y))retained.push(...face);}
source.setIndices(doc.createAccessor('Stationary indices').setType('SCALAR').setArray(new Uint32Array(retained)).setBuffer(buffer));
await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.1,error:.01}),textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048]}));
root.listNodes()[0].setName('StationaryBadge');root.listMeshes()[0].setName('Original lettering, plate and crossed wrenches');
const gear = doc.createNode('GearAssembly'); scene.addChild(gear);
// Deterministic, subtle surface variation gives the new metal a worn brushed finish.
const side=256,pixels=new Uint8Array(side*side*4);let seed=2020;
for(let y=0;y<side;y++)for(let x=0;x<side;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=((seed>>>24)/255-.5)*22,brush=Math.sin(y*2.1)*3,scratch=(seed%997<6)?-45:0;const i=(y*side+x)*4;pixels[i]=Math.max(0,Math.min(255,193+grain+brush+scratch));pixels[i+1]=Math.max(0,Math.min(255,198+grain+brush+scratch));pixels[i+2]=Math.max(0,Math.min(255,205+grain+brush+scratch));pixels[i+3]=255;}
const brushed=doc.createTexture('Rebuilt gear steel grain').setMimeType('image/png').setImage(new Uint8Array(await sharp(pixels,{raw:{width:side,height:side,channels:4}}).png().toBuffer()));
const steel = doc.createMaterial('Brushed forged steel').setBaseColorFactor([.42,.45,.49,1]).setMetallicFactor(.92).setRoughnessFactor(.38).setBaseColorTexture(brushed);
const dark = doc.createMaterial('Dark steel edge').setBaseColorFactor([.035,.047,.072,1]).setMetallicFactor(.86).setRoughnessFactor(.43);
const bright = doc.createMaterial('Machined edge and rivets').setBaseColorFactor([.57,.60,.65,1]).setMetallicFactor(.94).setRoughnessFactor(.3);
function addGeometry(name,g,material,parent=gear){
 const primitive=doc.createPrimitive().setMaterial(material);
 for(const [threeName,gltfName] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){
  const a=g.getAttribute(threeName);if(!a)continue;
  primitive.setAttribute(gltfName,doc.createAccessor(name+' '+gltfName).setType(a.itemSize===2?'VEC2':'VEC3').setArray(new Float32Array(a.array)).setBuffer(buffer));
 }
 if(g.index)primitive.setIndices(doc.createAccessor(name+' indices').setType('SCALAR').setArray(new Uint32Array(g.index.array)).setBuffer(buffer));
 const mesh=doc.createMesh(name).addPrimitive(primitive),node=doc.createNode(name).setMesh(mesh);parent.addChild(node);g.dispose();return node;
}
function gearShape(extra=0){const s=new Shape();const teeth=12;
 for(let n=0;n<teeth;n++)for(const [phase,r] of [[0,.79],[.18,.79],[.28,.895],[.72,.895],[.82,.79],[1,.79]]){
  const a=(n+phase)*Math.PI*2/teeth+Math.PI/12,x=Math.cos(a)*(r+extra),y=Math.sin(a)*(r+extra);if(n===0&&phase===0)s.moveTo(x,y);else s.lineTo(x,y);
 }s.closePath();const hole=new Path();hole.absarc(0,0,.652,0,Math.PI*2,true);s.holes.push(hole);return s;
}
const extrusion={depth:.105,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:.009,bevelThickness:.009,curveSegments:48};
addGeometry('Gear dark outline',new ExtrudeGeometry(gearShape(.013),extrusion),dark).setTranslation([0,0,-.139]);
addGeometry('Gear steel teeth',new ExtrudeGeometry(gearShape(),extrusion),steel).setTranslation([0,0,-.12]);
addGeometry('Machined outer race',new TorusGeometry(.773,.008,6,128),bright).setTranslation([0,0,-.003]);
addGeometry('Inner steel rim',new TorusGeometry(.669,.011,6,128),dark).setTranslation([0,0,.002]);
for(let n=0;n<12;n++){
 const a=n*Math.PI*2/12+Math.PI/12;
 const bolt=new CylinderGeometry(.017,.017,.011,6,1);bolt.applyMatrix4(new Matrix4().makeRotationX(Math.PI/2));
 addGeometry(`Gear rivet ${n+1}`,bolt,bright).setTranslation([Math.cos(a)*.727,Math.sin(a)*.727,.001]);
}
// An authored idle clip also makes the articulated asset usable outside this site.
const times=new Float32Array([0,15,30,45,60]);const rotations=new Float32Array(20);
for(let i=0;i<5;i++){const a=i*Math.PI/2;rotations.set([0,0,Math.sin(a/2),Math.cos(a/2)],i*4);}
const sampler=doc.createAnimationSampler().setInput(doc.createAccessor('Gear idle time').setType('SCALAR').setArray(times).setBuffer(buffer)).setOutput(doc.createAccessor('Gear idle rotation').setType('VEC4').setArray(rotations).setBuffer(buffer)).setInterpolation('LINEAR');
doc.createAnimation('Gear idle — 60 second revolution').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(gear).setTargetPath('rotation').setSampler(sampler));
await doc.transform(weld(),prune(),draco({method:'edgebreaker'}));
await io.write('public/models/logo-articulated.glb',doc);
console.log(JSON.stringify({sourceTriangles:indices.getCount()/3,stationaryTriangles:retained.length/3,bytes:(await fs.stat('public/models/logo-articulated.glb')).size,nodes:root.listNodes().map(n=>n.getName())},null,2));
