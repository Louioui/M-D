import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, BufferAttribute, DataTexture, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { frameAssembly } from './lib/frameAssembly.ts';
import { createEngineRig } from './lib/engineRig.ts';
import { splitAt } from './lib/splitTimeline.ts';
import { prepareEngineMaterials } from './lib/engineMaterials.ts';
import { prepareBadgeFinish, sheenAt, SHEEN_FIRST, SHEEN_PERIOD, SHEEN_SECONDS } from './lib/badgeFinish.ts';
import { createShockTrigger, SHOCK_SECONDS, shockAt, shouldShock } from './lib/shockwave.ts';
import { inject } from './lib/shaderInject.ts';
import { FIRING_HZ, rmsLevel } from './lib/engineAudio.ts';
import { createEngineState, ENGINE_IN, ENGINE_OUT, setFraming, solveEngine } from './lib/cameraSolver.ts';

test('split timeline opens over 25–75%, holds, then snaps back together over 90–100%',()=>{
  assert.equal(splitAt(-1),0);assert.equal(splitAt(.25),0);assert.equal(splitAt(.5),.5);assert.equal(splitAt(.75),1);
  assert.equal(splitAt(.85),1);assert.equal(splitAt(.9),1);assert.equal(splitAt(1),0);assert.equal(splitAt(2),0);
  let last=0;
  for(let i=0;i<=90;i++){const v=splitAt(i/100);assert.ok(v>=last && v<=1);last=v;}
  for(let i=90;i<=100;i++){const v=splitAt(i/100);assert.ok(v<=last && v>=0);last=v;}
  assert.ok(splitAt(.251)<.000001);assert.ok(1-splitAt(.749)<.000001);
  assert.ok(splitAt(.95)>.8,'power3.in: the assembly lifts off slowly and lands hard');
});

test('shockwave fires once per deep explosion, with hysteresis, and its front fades to idle',()=>{
  const trigger=createShockTrigger();
  assert.equal(shouldShock(trigger,.3,.4),false,'a shallow split never arms');
  assert.equal(shouldShock(trigger,0,.4),false);
  let fired=0;
  for(const amount of [.2,.7,1,.6,.3,.05,.01,0,.01,0,.015]) if(shouldShock(trigger,amount,.95)) fired++;
  assert.equal(fired,1,'jitter around the landing threshold must not re-fire');
  for(const amount of [.8,0]) if(shouldShock(trigger,amount,.95)) fired++;
  assert.equal(fired,2,'a new explosion re-arms it');
  for(const [amount,progress] of [[1,.6],[.4,.4],[0,.3]]) assert.equal(shouldShock(trigger,amount,progress),false,'scrolling back up rebuilds silently');
  for(const [amount,progress] of [[.9,.8],[0,.8]]) assert.equal(shouldShock(trigger,amount,progress),false,'switching SPLIT PARTS off mid-tour lands silently');
  assert.equal(trigger.armed,false,'a silent landing disarms, so it cannot fire later on its own');
  assert.equal(shouldShock(trigger,0,.99),false);
  assert.deepEqual(shockAt(-1),{radius:0,strength:0});
  assert.equal(shockAt(0).strength,1);
  assert.ok(shockAt(.3).radius>shockAt(.1).radius && shockAt(.3).strength<shockAt(.1).strength);
  assert.equal(shockAt(SHOCK_SECONDS).strength,0,'the demand loop can go idle once the wave has passed');
});

test('telemetry beams run from each moving part\'s rest centre to its exploded centre',()=>{
  const rig=createEngineRig(fixture());
  assert.equal(rig.beams.length,3*6);assert.deepEqual([...rig.beamEnds],[0,1,0,1,0,1]);
  rig.apply(0,false,false);
  for(let i=0;i<rig.beams.length;i+=6) for(let k=0;k<3;k++) assert.ok(Math.abs(rig.beams[i+k]-rig.beams[i+3+k])<1e-9);
  rig.apply(1,false,false);
  assert.ok(Math.abs(rig.beams[4]-rig.beams[1]-1.02)<1e-6,'cover beam spans its full lift');
  rig.apply(1,true,false);
  assert.ok(Math.abs(rig.beams[4]-rig.beams[1]-1.02*.55)<1e-6,'phones use the reduced travel');
});

test('shader injection fails loudly when a three.js chunk anchor is missing',()=>{
  assert.equal(inject('a\n#include <x>\nb','#include <x>','y'),'a\n#include <x>\ny\nb');
  assert.equal(inject('#include <x>','#include <x>','y','before'),'y\n#include <x>');
  assert.throws(()=>inject('void main(){}','#include <missing>','y'),/anchor not found/);
  assert.equal(inject('a\n#include <x>\nb','#include <x>','y','replace'),'a\ny\nb');
});

test('engine audio level is a bounded RMS and silent input reads zero',()=>{
  assert.equal(rmsLevel(new Float32Array(64)),0);
  assert.ok(Math.abs(rmsLevel(new Float32Array(64).fill(.1),1)-.1)<1e-6);
  assert.equal(rmsLevel(new Float32Array(64).fill(1)),1);
  assert.ok(FIRING_HZ>20 && FIRING_HZ<30,'four-cylinder idle fires ~25 times a second');
});

function fixture(){
  const model=new Group();
  for(const [assembly,travel,position] of [['cover',[0,1.02,0],[0,.7,0]],['intake',[-.32,0,.48],[0,0,.6]],['piston-1',[0,.48,0],[0,.1,0]]]){
    const mesh=new Mesh(new BoxGeometry(.4,.2,.4),new MeshStandardMaterial());
    mesh.position.fromArray(position);mesh.userData={mdAssembly:assembly,mdExplode:travel,mdInternal:assembly.startsWith('piston')};model.add(mesh);
  }
  return model;
}

test('rig restores exact rest matrices after repeated scrubbing and reduces phone travel',()=>{
  const model=fixture(),rig=createEngineRig(model),rest=model.children.map(o=>o.position.clone());
  for(let i=0;i<100;i++){rig.apply(1,false,false);rig.apply(.32,false,false);rig.apply(0,false,false);}
  model.children.forEach((o,i)=>assert.deepEqual(o.position,rest[i]));
  assert.equal(model.children[2].visible,false);
  rig.apply(1,false,false);assert.ok(Math.abs(model.children[0].position.y-1.72)<1e-9);
  const anchor=new Vector3();rig.offsetFor('intake',anchor);assert.ok(anchor.x<0 && anchor.z>0);
  rig.apply(1,true,false);assert.ok(Math.abs(model.children[0].position.y-(.7+1.02*.55))<1e-9);
  rig.apply(0,true,true);assert.equal(model.children[2].visible,true,'X-ray reveals the hidden internals');
  rig.offsetFor('missing',anchor);assert.equal(anchor.length(),0);
});

test('moving assembly bounds are finite and camera fit includes every exploded point',()=>{
  for(const mobile of [false,true])for(const amount of [0,.5,1]){
    const rig=createEngineRig(fixture()),points=rig.apply(amount,mobile,false);
    assert.ok(points.every(Number.isFinite));
    const state=createEngineState(),input=new Float32Array(ENGINE_IN.length),out=new Float32Array(ENGINE_OUT.length);
    setFraming(state,points);input[ENGINE_IN.progress]=.75;input[ENGINE_IN.aspect]=mobile ? 1.25 : 2;
    input[ENGINE_IN.viewportAspect]=mobile ? .46 : 1.6;input[ENGINE_IN.dt]=1/60;
    input[ENGINE_IN.mobile]=mobile?1:0;input[ENGINE_IN.split]=amount;
    for(let frame=0;frame<240;frame++)solveEngine(state,input,out);
    assert.ok(out.every(Number.isFinite));assert.ok(out[ENGINE_OUT.pz]>0);
    const inverse=new Quaternion(out[ENGINE_OUT.qx],out[ENGINE_OUT.qy],out[ENGINE_OUT.qz],out[ENGINE_OUT.qw]).invert();
    const position=new Vector3(out[ENGINE_OUT.px],out[ENGINE_OUT.py],out[ENGINE_OUT.pz]);
    const tan=Math.tan(out[ENGINE_OUT.fov]*Math.PI/360);
    for(let i=0;i<points.length;i+=3){
      const v=new Vector3(points[i],points[i+1],points[i+2]).sub(position).applyQuaternion(inverse);
      assert.ok(v.z<0);assert.ok(Math.abs(v.y/-v.z)<=tan*1.001);assert.ok(Math.abs(v.x/-v.z)<=tan*input[ENGINE_IN.aspect]*1.001);
    }
  }
});

test('X-ray swaps only instance materials, shares world-space heat, and restores physical shading',()=>{
  const source=fixture(),original=source.children[0].material,texture=new DataTexture();
  source.children[0].material.map=new DataTexture();
  const prepared=prepareEngineMaterials(source,{detailMap:texture,clearcoat:true,maxAnisotropy:16});
  assert.equal(source.children[0].material.map.anisotropy,16,'engine textures get anisotropic filtering');
  assert.equal(texture.anisotropy,16,'so does the procedural detail atlas');
  const physical=prepared.model.children[0].material;
  assert.notEqual(physical,original);
  prepared.setXray(true);assert.equal(prepared.model.children[0].material,prepared.plasma);
  assert.equal(prepared.plasma.uniforms.uHoverPoint,prepared.uniforms.uHoverPoint);
  prepared.uniforms.uHoverIntensity.value=.8;assert.equal(prepared.plasma.uniforms.uHoverIntensity.value,.8);
  prepared.setXray(false);assert.equal(prepared.model.children[0].material,physical);assert.equal(source.children[0].material,original);
  let originalDisposed=false;original.addEventListener('dispose',()=>originalDisposed=true);
  prepared.dispose();assert.equal(originalDisposed,false);
  assert.equal(prepared.materials[0].clearcoat,.35,'flexplate clearcoat per spec (masked to that zone in the shader)');
  assert.ok(prepared.plasma.uniforms.uShock===prepared.uniforms.uShock,'the shockwave reaches the X-ray shell too');
});

test('render-frame safety fit prevents clipping while a worker still has the previous pose',()=>{
  const rig=createEngineRig(fixture()),bounds=rig.apply(1,false,false);
  const camera=new PerspectiveCamera(38,1.4,.1,60);camera.position.set(.3,.1,.9);camera.lookAt(0,.1,0);
  assert.ok(frameAssembly(camera,bounds,1.4,.8,.86)>0);
  camera.updateMatrixWorld();
  for(let i=0;i<bounds.length;i+=3){const p=new Vector3().fromArray(bounds,i).project(camera);assert.ok(Math.abs(p.x)<=.801 && Math.abs(p.y)<=.861 && p.z<1);}
  const position=camera.position.clone();assert.equal(frameAssembly(camera,bounds,1.4,.8,.86),0);assert.deepEqual(camera.position,position);
});

test('badge glint runs on a clock every SHEEN_PERIOD seconds, never from the cursor',()=>{
  assert.equal(sheenAt(0),-1,'no glint during the first moments after load');
  assert.equal(sheenAt(SHEEN_FIRST),0);
  assert.ok(sheenAt(SHEEN_FIRST+SHEEN_SECONDS/2)>.4 && sheenAt(SHEEN_FIRST+SHEEN_SECONDS/2)<.6);
  assert.equal(sheenAt(SHEEN_FIRST+SHEEN_SECONDS+.01),-1,'idle between sweeps');
  assert.equal(sheenAt(SHEEN_FIRST+SHEEN_PERIOD),0,'repeats every period');
  assert.ok(SHEEN_PERIOD>=10 && SHEEN_PERIOD<=15,'requested 10–15 s cadence');
  let last=-1;for(let t=0;t<=SHEEN_SECONDS;t+=.05){const v=sheenAt(SHEEN_FIRST+t);if(v<0)continue;assert.ok(v>=last && v<=1);last=v;}
});

test('badge finish owns its materials and upgrades in place when worker data lands',()=>{
  const source=fixture(),original=source.children[0].material;
  original.map=new DataTexture();
  const finish=prepareBadgeFinish(source,true,8);
  assert.equal(original.map.anisotropy,8,'lettering texture gets anisotropic filtering');
  assert.notEqual(source.children[0].material,original);
  assert.ok('PHYSICAL' in finish.materials[0].defines,'Physical specular/IOR shader features survive the Standard material copy');
  assert.equal(finish.uniforms.uSheen.value,-1);
  finish.setSheen(.5);assert.equal(finish.uniforms.uSheen.value,.5);
  const geometry=source.children[0].geometry,count=geometry.getAttribute('position').count;
  assert.equal(geometry.getAttribute('aCurvature').count,count,'neutral curvature until the worker lands');
  assert.equal(finish.uniforms.uDetail.value,0);
  const atlas=new DataTexture();finish.setDetail(atlas);assert.equal(finish.uniforms.uDetailMap.value,atlas);assert.equal(finish.uniforms.uDetail.value,1);
  finish.setDetail(null);assert.equal(finish.uniforms.uDetail.value,0);
  const supplied=new Float32Array(count).fill(.7);geometry.setAttribute('aCurvature',new BufferAttribute(supplied,1));
  prepareBadgeFinish(source,false).dispose();assert.equal(geometry.getAttribute('aCurvature').array,supplied,'worker data on shared geometry is never overwritten');
  let originalDisposed=false;original.addEventListener('dispose',()=>originalDisposed=true);
  finish.dispose();assert.equal(originalDisposed,false);
});
