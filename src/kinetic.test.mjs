import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, DataTexture, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { createEngineRig } from './lib/engineRig.ts';
import { splitAt } from './lib/splitTimeline.ts';
import { prepareEngineMaterials } from './lib/engineMaterials.ts';
import { createLiquidState, prepareLiquidBadge, stepLiquid } from './lib/liquidBadge.ts';
import { createEngineState, ENGINE_IN, ENGINE_OUT, setFraming, solveEngine } from './lib/cameraSolver.ts';

test('split timeline only opens between 25% and 75%, with reversible eased endpoints',()=>{
  assert.equal(splitAt(-1),0);assert.equal(splitAt(.25),0);assert.equal(splitAt(.5),.5);assert.equal(splitAt(.75),1);assert.equal(splitAt(2),1);
  let last=0;
  for(let i=0;i<=100;i++){const v=splitAt(i/100);assert.ok(v>=last && v<=1);last=v;}
  assert.ok(splitAt(.251)<.000001);assert.ok(1-splitAt(.749)<.000001);
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
  const prepared=prepareEngineMaterials(source,{detailMap:texture,clearcoat:true});
  const physical=prepared.model.children[0].material;
  assert.notEqual(physical,original);
  prepared.setXray(true);assert.equal(prepared.model.children[0].material,prepared.plasma);
  assert.equal(prepared.plasma.uniforms.uHoverPoint,prepared.uniforms.uHoverPoint);
  prepared.uniforms.uHoverIntensity.value=.8;assert.equal(prepared.plasma.uniforms.uHoverIntensity.value,.8);
  prepared.setXray(false);assert.equal(prepared.model.children[0].material,physical);assert.equal(source.children[0].material,original);
  let originalDisposed=false;original.addEventListener('dispose',()=>originalDisposed=true);
  prepared.dispose();assert.equal(originalDisposed,false);
});

test('liquid badge reacts to velocity, settles, respects reduced motion and owns its materials',()=>{
  const state=createLiquidState();
  stepLiquid(state,1,0,0,1/60,false);assert.ok(state.energy>0 && state.energy<=1);
  for(let i=0;i<240;i++)stepLiquid(state,1,0,0,1/60,false);
  assert.ok(state.energy<.00001,'A held pointer must stop adding energy');
  stepLiquid(state,1,0,2000,1/60,false);assert.ok(state.energy>0);
  stepLiquid(state,1,0,2000,1/60,true);assert.equal(state.energy,0);assert.equal(state.phase,0);
  const source=fixture(),original=source.children[0].material;
  const finish=prepareLiquidBadge(source,true);
  assert.notEqual(source.children[0].material,original);
  finish.update(.8,1,.5,.3,false);assert.equal(finish.uniforms.uLiquid.value,.8);assert.ok(finish.materials[0].anisotropy>.12);
  finish.update(0,0,.5,.3,true);assert.equal(finish.materials[0].envMapRotation.y,0);
  finish.dispose();
});
