import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { MathUtils, Raycaster, Vector2, type Mesh, type Object3D, type Camera, type Intersection } from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import type { HeatUniforms } from '../lib/plasmaMaterial.ts';

/** Passive pointer input, coalesced into the existing render RAF. On touch, a
 * tap heats a part briefly; no capture/preventDefault, so scrolling stays native. */
export function useEngineHeat(model: Object3D, uniforms: HeatUniforms, enabled: boolean, reduced: boolean, visible: RefObject<boolean>) {
  const canvas = useThree(state=>state.gl.domElement), invalidate = useThree(state=>state.invalidate);
  const state = useRef({ x: 0, y: 0, inside: false, touchUntil: 0, dirty: true, rect: {left:0,top:0,width:1,height:1} });
  const ray = useMemo(()=>new Raycaster(),[]), pointer = useMemo(()=>new Vector2(),[]);
  const hits = useMemo<Intersection[]>(()=>[],[]);
  const meshes = useMemo<Mesh[]>(()=>{
    const parts: Mesh[]=[];
    model.traverse(object=>{ if('isMesh' in object && object.isMesh) parts.push(object as Mesh); });
    return parts;
  },[model]);
  useEffect(()=>{
    if(!enabled || reduced) { uniforms.uHoverIntensity.value=0; invalidate(); return; }
    // Cache the tree on the cached geometry, and raycast only this scene's clones.
    // Indirect mode leaves authored triangle/index buffers unchanged.
    for(const mesh of meshes) {
      if(!mesh.geometry.boundsTree) computeBoundsTree.call(mesh.geometry,{indirect:true,maxLeafTris:12});
      mesh.raycast=acceleratedRaycast;
    }
    ray.firstHitOnly=true;
    const s=state.current;
    const measure=()=>{ const r=canvas.getBoundingClientRect(); s.rect={left:r.left,top:r.top,width:r.width,height:r.height}; s.dirty=false; };
    const dirty=()=>{ s.dirty=true; };
    const record=(event: PointerEvent)=>{
      if(!visible.current || document.hidden) return;
      if(event.pointerType==='touch' && event.type!=='pointerdown') return;
      s.x=event.clientX; s.y=event.clientY;
      const blocked=event.target instanceof Element && !!event.target.closest('button,a,input,select,textarea,.engine-hud-card');
      s.inside=!blocked;
      s.touchUntil=event.pointerType==='touch' ? performance.now()+1600 : 0;
      invalidate();
    };
    const leave=(event: Event)=>{
      // Touch pointers leave the document when the finger lifts. Keep the tap's
      // short heat pulse alive; only a mouse leave or window blur cancels it.
      if(event.type==='pointerleave' && event instanceof PointerEvent && event.pointerType==='touch') return;
      s.inside=false; invalidate();
    };
    const resize=new ResizeObserver(dirty); resize.observe(canvas);
    window.addEventListener('pointermove',record,{passive:true});
    window.addEventListener('pointerdown',record,{passive:true});
    window.addEventListener('scroll',dirty,{passive:true});
    window.addEventListener('blur',leave); document.addEventListener('pointerleave',leave);
    measure();
    return ()=>{
      resize.disconnect(); window.removeEventListener('pointermove',record); window.removeEventListener('pointerdown',record);
      window.removeEventListener('scroll',dirty);window.removeEventListener('blur',leave); document.removeEventListener('pointerleave',leave);
      s.inside=false; uniforms.uHoverIntensity.value=0;
    };
  },[canvas,enabled,reduced,meshes,ray,uniforms,visible,invalidate]);

  return (camera: Camera, dt: number) => {
    if(!enabled || reduced) return false;
    const s=state.current;
    if(s.dirty) { const r=canvas.getBoundingClientRect(); s.rect={left:r.left,top:r.top,width:r.width,height:r.height}; s.dirty=false; }
    const r=s.rect;
    pointer.set((s.x-r.left)/Math.max(1,r.width)*2-1,-(s.y-r.top)/Math.max(1,r.height)*2+1);
    let target=0;
    if(s.inside && (!s.touchUntil || performance.now()<s.touchUntil) && Math.abs(pointer.x)<=1 && Math.abs(pointer.y)<=1) {
      ray.setFromCamera(pointer,camera); hits.length=0;
      // Mesh.raycast doesn't check visibility; exclude hidden internal pistons.
      for(const mesh of meshes) if(mesh.visible) ray.intersectObject(mesh,false,hits);
      if(hits.length) {
        let hit=hits[0];for(let i=1;i<hits.length;i++)if(hits[i].distance<hit.distance)hit=hits[i];
        uniforms.uHoverPoint.value.copy(hit.point); target=1;
      }
    }
    uniforms.uHoverIntensity.value=MathUtils.damp(uniforms.uHoverIntensity.value,target,target ? 12 : 5,dt);
    // Touch must keep ticking through its timeout; desktop rests once settled.
    return Math.abs(uniforms.uHoverIntensity.value-target)>.001 || (target===1 && s.touchUntil>0);
  };
}
