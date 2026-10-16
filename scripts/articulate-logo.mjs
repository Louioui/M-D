/** Rebuild the badge's fused rear gear as an independent, beveled steel assembly.
 * The source badge stays untouched. Mask coordinates refer to a 1000px orthographic
 * front view at a 2.15 world-unit span; the original lettering/tools retain their UVs.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, prune, weld, dedup, simplify, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { Shape, Path, ExtrudeGeometry, CylinderGeometry, TorusGeometry, BoxGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
// Lower wrench heads are traced tightly (open-end jaw outline, box-end ring ellipse).
// Earlier bounding rectangles kept fragments of the old gear teeth around them.
const OPEN_END_HEAD = [[702,691],[722,698],[760,708],[796,713],[827,715],[856,725],[880,743],[895,765],[901,787],[899,798],[888,799],[877,786],[861,773],[841,767],[821,772],[807,785],[802,803],[803,821],[814,832],[834,840],[851,850],[859,863],[854,872],[836,874],[810,874],[781,865],[760,851],[747,834],[742,812],[728,790],[714,765],[702,752]];
const BOX_END_RING = { cx: 200, cy: 794, rx: 72, ry: 66 };
// The box-end wrench's neck between its ring and the stationary centre plate,
// traced on the source render (top and bottom outlines plus ~1px of edge).
const BOX_END_NECK = [[206,733],[211,725],[236,714],[261,702],[292,688],[312,700],[302,764],[286,774],[271,788],[262,797]];
const silhouettes = [
  OPEN_END_HEAD,
  BOX_END_NECK,
  [[265,103],[448,103],[456,128],[554,127],[580,180],[581,106],[688,103],[730,158],[733,300],[694,314],[577,278],[460,272],[350,309],[269,341]],
  [[85,231],[144,212],[194,210],[226,225],[246,257],[263,301],[290,351],[339,401],[390,429],[421,477],[664,679],[720,702],[760,708],[714,762],[692,748],[646,737],[366,513],[306,463],[264,442],[220,433],[151,437],[122,433],[132,394],[110,380],[79,352],[62,318],[59,293],[82,301],[128,330],[159,332],[173,302],[168,279],[127,257],[92,247]],
  [[873,212],[833,217],[791,233],[773,259],[750,295],[750,339],[718,365],[661,406],[618,449],[588,505],[306,700],[276,715],[246,731],[262,770],[272,790],[302,754],[351,729],[642,523],[706,475],[745,445],[780,412],[817,400],[870,386],[911,368],[935,336],[944,309],[934,275],[916,304],[891,321],[866,326],[840,311],[826,281],[837,259],[864,236]],
  [[75,477],[102,465],[126,464],[130,432],[198,435],[195,480],[303,481],[345,418],[651,418],[696,479],[804,479],[800,401],[840,394],[870,464],[922,479],[924,537],[908,550],[899,640],[886,661],[813,653],[744,644],[252,645],[106,665],[94,548],[78,541]],
];
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
function inRing(px,py){const {cx,cy,rx,ry}=BOX_END_RING;return ((px-cx)/rx)**2+((py-cy)/ry)**2<=1;}
function keep(x,y){const px=500+x/2.15*1000,py=500-y/2.15*1000;return Math.hypot(x,y)<.665 || inRing(px,py) || silhouettes.some(p=>inside(px,py,p));}
const retained=[],positionArray=positions.getArray();
for(let i=0;i<indices.getCount();i+=3){const face=[indices.getScalar(i),indices.getScalar(i+1),indices.getScalar(i+2)];let x=0,y=0;for(const n of face){x+=positionArray[n*3]/3;y+=positionArray[n*3+1]/3;}if(keep(x,y))retained.push(...face);}
source.setIndices(doc.createAccessor('Stationary indices').setType('SCALAR').setArray(new Uint32Array(retained)).setBuffer(buffer));
// Keep the small letter bevels, wrench jaws and ring opening crisp. The previous
// 10% reduction rounded away much of this silhouette at close inspection.
await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.22,error:.003,lockBorder:true}),textureCompress({encoder:sharp,targetFormat:'webp',resize:[3072,3072]}));
root.listNodes()[0].setName('StationaryBadge');root.listMeshes()[0].setName('Original lettering, plate and crossed wrenches');
const branding = source.getMaterial();
branding.setName('Original painted lettering and forged tools');
branding.setRoughnessFactor(.84).setNormalScale(.85);
const gear = doc.createNode('GearAssembly'); scene.addChild(gear);
// Deterministic, subtle surface variation gives the new metal a worn brushed finish.
const side=256,pixels=new Uint8Array(side*side*4);let seed=2020;
for(let y=0;y<side;y++)for(let x=0;x<side;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=((seed>>>24)/255-.5)*22,brush=Math.sin(y*2.1)*3,scratch=(seed%997<6)?-45:0;const i=(y*side+x)*4;pixels[i]=Math.max(0,Math.min(255,193+grain+brush+scratch));pixels[i+1]=Math.max(0,Math.min(255,198+grain+brush+scratch));pixels[i+2]=Math.max(0,Math.min(255,205+grain+brush+scratch));pixels[i+3]=255;}
const brushed=doc.createTexture('Rebuilt gear steel grain').setMimeType('image/png').setImage(new Uint8Array(await sharp(pixels,{raw:{width:side,height:side,channels:4}}).png().toBuffer()));
// Real normal and packed roughness channels: tiny surface grooves respond to
// lighting instead of painting all the apparent detail into the color texture.
const normals=new Uint8Array(side*side*3),roughness=new Uint8Array(side*side*3);
const height=(x,y)=>pixels[(((y+side)%side)*side+(x+side)%side)*4]/255;
for(let y=0;y<side;y++)for(let x=0;x<side;x++){
 const i=(y*side+x)*3,dx=(height(x+1,y)-height(x-1,y))*.6,dy=(height(x,y+1)-height(x,y-1))*.6;
 const length=Math.hypot(dx,dy,1);
 normals.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dy/length+.5)*255),Math.round((.5/length+.5)*255)],i);
 roughness.set([255,Math.round(90+(height(x,y)-.75)*65),247],i);
}
const microNormal=doc.createTexture('Microscopic brushed steel normal').setMimeType('image/png').setImage(new Uint8Array(await sharp(normals,{raw:{width:side,height:side,channels:3}}).png().toBuffer()));
const microRoughness=doc.createTexture('Steel roughness and metalness').setMimeType('image/png').setImage(new Uint8Array(await sharp(roughness,{raw:{width:side,height:side,channels:3}}).png().toBuffer()));
const steel = doc.createMaterial('Brushed forged steel').setBaseColorFactor([.42,.45,.49,1]).setMetallicFactor(.92).setRoughnessFactor(1).setBaseColorTexture(brushed).setNormalTexture(microNormal).setNormalScale(.3).setMetallicRoughnessTexture(microRoughness);
const dark = doc.createMaterial('Dark steel edge').setBaseColorFactor([.035,.047,.072,1]).setMetallicFactor(.86).setRoughnessFactor(.43);
const bright = doc.createMaterial('Machined edges and socket hardware').setBaseColorFactor([.57,.60,.65,1]).setMetallicFactor(.94).setRoughnessFactor(.3);
const satin = doc.createMaterial('Turned steel face').setBaseColorFactor([.29,.33,.38,1]).setMetallicFactor(.96).setRoughnessFactor(.9).setBaseColorTexture(brushed).setNormalTexture(microNormal).setNormalScale(.2).setMetallicRoughnessTexture(microRoughness);
const recess = doc.createMaterial('Socket recess and engraved marks').setBaseColorFactor([.012,.018,.027,1]).setMetallicFactor(.68).setRoughnessFactor(.48);
// Static parts of each finish share one mesh, keeping the detailed moving ring
// to five draw calls instead of creating a draw call for every screw or mark.
const batches = new Map();
const parts = [];
function addGeometry(name,g,material){
 parts.push(name);
 return { setTranslation(position) { g.translate(...position); queue(); } };
 function queue(){
  if(!g.index){ const count=g.getAttribute('position').count;g.setIndex(Array.from({length:count},(_,i)=>i)); }
  const batch=batches.get(material)??[];batch.push(g);batches.set(material,batch);
 }
}
function writeGeometry(name,g,material,parent=gear){
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
const extrusion={depth:.105,steps:1,bevelEnabled:true,bevelSegments:5,bevelSize:.009,bevelThickness:.009,curveSegments:64};
addGeometry('Gear dark outline',new ExtrudeGeometry(gearShape(.013),extrusion),dark).setTranslation([0,0,-.139]);
addGeometry('Gear steel teeth',new ExtrudeGeometry(gearShape(),extrusion),steel).setTranslation([0,0,-.12]);
function annulus(outer,inner){const s=new Shape();s.absarc(0,0,outer,0,Math.PI*2,false);const h=new Path();h.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(h);return s;}
const face = new ExtrudeGeometry(annulus(.766,.679),{depth:.009,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:2,curveSegments:96});
addGeometry('Recessed turned steel annulus',face,satin).setTranslation([0,0,-.01]);
addGeometry('Raised polished outer lip',new TorusGeometry(.774,.007,8,192),bright).setTranslation([0,0,-.002]);
addGeometry('Inner steel rim',new TorusGeometry(.669,.009,8,192),dark).setTranslation([0,0,.002]);
addGeometry('Polished inner race',new TorusGeometry(.682,.003,6,192),bright).setTranslation([0,0,.001]);
// Fine concentric machining tracks catch the strip lights as the gear turns.
for(const radius of [.69,.695,.746,.751,.756]){
 addGeometry('Lathe score '+radius,new TorusGeometry(radius,.00065,4,192),dark).setTranslation([0,0,.0015]);
}
function hexShape(radius,hole=0){const s=new Shape();for(let j=0;j<6;j++){const a=j*Math.PI/3;const p=[Math.cos(a)*radius,Math.sin(a)*radius];j?s.lineTo(...p):s.moveTo(...p);}s.closePath();if(hole){const h=new Path();for(let j=5;j>=0;j--){const a=j*Math.PI/3;const p=[Math.cos(a)*hole,Math.sin(a)*hole];j===5?h.moveTo(...p):h.lineTo(...p);}h.closePath();s.holes.push(h);}return s;}
for(let n=0;n<12;n++){
 const a=n*Math.PI*2/12+Math.PI/12;
 const x=Math.cos(a)*.721,y=Math.sin(a)*.721;
 addGeometry(`Washer ${n+1}`,new TorusGeometry(.021,.0035,6,24),bright).setTranslation([x,y,.003]);
 const bolt=new ExtrudeGeometry(hexShape(.016,.007),{depth:.009,bevelEnabled:true,bevelSize:.0013,bevelThickness:.001,bevelSegments:2});
 addGeometry(`Recessed hex socket ${n+1}`,bolt,bright).setTranslation([x,y,.003]);
 const socket=new CylinderGeometry(.007,.007,.001,6);socket.applyMatrix4(new Matrix4().makeRotationX(Math.PI/2));
 addGeometry(`Socket floor ${n+1}`,socket,recess).setTranslation([x,y,.002]);
 // A short, recessed stripe follows each tooth; the bevel remains uninterrupted.
 const mark=new BoxGeometry(.002,.022,.0008);mark.rotateZ(a-Math.PI/2);
 addGeometry(`Tooth machining mark ${n+1}`,mark,dark).setTranslation([Math.cos(a)*.822,Math.sin(a)*.822,-.004]);
 for(let j=0;j<3;j++){
  const angle=a+(j-1)*.055;
  const tick=new BoxGeometry(.0014,j===1?.012:.006,.0007);tick.rotateZ(angle-Math.PI/2);
  addGeometry(`Engraved index ${n+1}.${j+1}`,tick,recess).setTranslation([Math.cos(angle)*.758,Math.sin(angle)*.758,.0018]);
 }
}
for(const [material,geometries] of batches){
 const merged=mergeGeometries(geometries,false);
 if(!merged)throw new Error('Failed to batch gear finish '+material.getName());
 writeGeometry(material.getName(),merged,material);
 geometries.forEach(g=>g.dispose());
}
gear.setExtras({finish:'Machined forged steel',detailParts:parts.length,socketBolts:12,independentBranding:true});
// An authored idle clip also makes the articulated asset usable outside this site.
const times=new Float32Array([0,15,30,45,60]);const rotations=new Float32Array(20);
for(let i=0;i<5;i++){const a=i*Math.PI/2;rotations.set([0,0,Math.sin(a/2),Math.cos(a/2)],i*4);}
const sampler=doc.createAnimationSampler().setInput(doc.createAccessor('Gear idle time').setType('SCALAR').setArray(times).setBuffer(buffer)).setOutput(doc.createAccessor('Gear idle rotation').setType('VEC4').setArray(rotations).setBuffer(buffer)).setInterpolation('LINEAR');
doc.createAnimation('Gear idle — 60 second revolution').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(gear).setTargetPath('rotation').setSampler(sampler));
await doc.transform(weld(),prune(),draco({method:'edgebreaker'}));
await io.write('public/models/logo-articulated.glb',doc);
console.log(JSON.stringify({sourceTriangles:indices.getCount()/3,stationaryTriangles:retained.length/3,bytes:(await fs.stat('public/models/logo-articulated.glb')).size,nodes:root.listNodes().map(n=>n.getName())},null,2));
