import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import {
  AdditiveBlending, Box3, BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Mesh, PerspectiveCamera, ShaderMaterial, Vector3,
  type Group, type MeshBasicMaterial, type SpotLight,
} from 'three';
import { motion, subscribeTourProgress } from '../motion';
import { ENGINE_FOCUS, ENGINE_SCALE, chapterAt } from '../enginePath.ts';
import { ENGINE_IN, ENGINE_OUT } from '../lib/cameraSolver.ts';
import { engineChannel, sendFraming } from '../lib/motionClient.ts';
import { cameraProfile, deviceProfile } from '../lib/deviceTier.ts';
import { prepareEngineMaterials } from '../lib/engineMaterials.ts';
import type { InspectionMode } from '../lib/inspection.ts';
import { engineHud } from '../lib/engineHud.ts';
import type { EngineAssets } from '../lib/assetLoader.ts';
import { useFrameGovernor, useGraphicsRecovery, useSceneActivity } from './sceneHooks';
import { createEngineRig } from '../lib/engineRig.ts';
import { createPlasmaMaterial, FIRING_PHASE } from '../lib/plasmaMaterial.ts';
import { createShockTrigger, shockAt, shouldShock } from '../lib/shockwave.ts';
import { engineAudio } from '../lib/engineAudio.ts';
import { useEngineHeat } from './useEngineHeat.ts';
import { frameAssembly } from '../lib/frameAssembly.ts';

// White-balanced warm key, neutral rim and cool fill, calibrated against the reference.
const KELVIN_4500 = '#fff0e1', KELVIN_5600 = '#ffefe5', KELVIN_7000_NAVY = '#8ea7d1';
const CRIMSON = '#E63946';

/** Light intensities per inspection mode: [key, fill, rim, bounce, rake, ambient, env]. */
const RIG: Record<InspectionMode, readonly number[]> = {
  studio: [2.3, 1.0, 2.4, 2.3 * .10, 0, .25, .55],
  cad: [1.2, .6, 1.2, 0, 0, .3, .3],
  spec: [.55, .2, 1.4, .1, 5.2, .06, .28],
};

function StudioRig({ mode, shadowLevel }: { mode: InspectionMode; shadowLevel: number }) {
  const profile = deviceProfile();
  const [key, fill, rim, bounce, rake, ambient] = RIG[mode];
  const shadows = profile.shadows && shadowLevel < 2;
  const mapSize = shadowLevel === 0 ? 2048 : 1024;
  const keyLight = useRef<SpotLight>(null);
  useEffect(() => {
    const light = keyLight.current;
    if (!light) return;
    // Reallocate the shadow map when the governor steps resolution down.
    if (light.shadow.mapSize.x !== mapSize) {
      light.shadow.mapSize.set(mapSize, mapSize);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    }
  }, [mapSize]);
  return <>
    <ambientLight intensity={ambient} />
    {/* 4500K key: crisp contact shadows from high front-right. */}
    <spotLight ref={keyLight} name="Key 4500K" position={[3.2, 4.6, 3.4]} angle={.62} penumbra={.4} decay={0}
      color={KELVIN_4500} intensity={key} castShadow={shadows}
      shadow-bias={-.0004} shadow-normalBias={.02} shadow-mapSize={[mapSize, mapSize]} shadow-camera-near={2} shadow-camera-far={14} />
    {/* 7000K mechanic-navy fill on the intake side (+Z, camera-left at the intake stop). */}
    <directionalLight name="Fill 7000K navy" position={[-4, 1.5, 2.5]} color={KELVIN_7000_NAVY} intensity={fill} />
    {/* 5600K rim: razor backlight tracing the flexplate teeth and cover silhouette. */}
    <directionalLight name="Rim 5600K" position={[1, 3, -4.5]} color={KELVIN_5600} intensity={rim} />
    {/* Warm crimson under-bay bounce off the oil pan flanges: 15% of the key. */}
    <pointLight name="Under-bay bounce" position={[0, -2, 1.2]} color={CRIMSON} intensity={bounce} decay={2} distance={4.5} />
    {/* Spec lighting: low raking light that skims every bolt, runner and gear tooth. */}
    {rake > 0 && <directionalLight name="Raking inspection" position={[4.6, -.35, 1.2]} color="#ffffff" intensity={rake} />}
  </>;
}

interface EngineModelProps {
  assets: EngineAssets;
  reduced: boolean;
  mode: InspectionMode;
  inspect: boolean;
  split: boolean;
  xray: boolean;
  heat: boolean;
  debugZones?: boolean;
}

const tmp = new Vector3();

/** Fiber-optic telemetry: pulses run from each part's rest anchor out to the part. */
function createBeamMaterial(points: boolean) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aEnd; varying float vEnd;
      void main() {
        vEnd = aEnd;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = ${points ? '7.0 * aEnd' : '1.0'};
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uAmount; varying float vEnd;
      void main() {
        ${points ? 'vec2 c = gl_PointCoord - 0.5; if (vEnd < 0.5 || dot(c, c) > 0.25) discard;' : ''}
        float pulse = exp(-pow(fract(vEnd - uTime * 0.9) - 0.5, 2.0) * 60.0);
        vec3 color = mix(vec3(0.9, 0.13, 0.2), vec3(0.25, 0.9, 1.0), vEnd);
        float alpha = uAmount * ${points ? '0.95' : '(0.22 + pulse * 0.75)'};
        gl_FragColor = vec4(color * (1.0 + pulse), alpha);
      }`,
  });
}

export default function EngineModel({ assets, reduced, mode, inspect, split, xray, heat, debugZones = false }: EngineModelProps) {
  const profile = deviceProfile();
  const gpuAnisotropy = useThree(state => state.gl.capabilities.getMaxAnisotropy());
  // 16× on desktop; phones/tablets cap at 8× to spare memory bandwidth.
  const maxAnisotropy = Math.min(profile.tier === 'desktop' ? 16 : 8, gpuAnisotropy);
  const prepared = useMemo(() => prepareEngineMaterials(assets.gltf.scene, { detailMap: assets.detailMap, clearcoat: profile.clearcoat, maxAnisotropy }), [assets, profile.clearcoat, maxAnisotropy]);
  const rig = useMemo(()=>createEngineRig(prepared.model),[prepared]);
  // One core material per cylinder (same program) so each flashes on its own stroke.
  const cores = useMemo(()=>FIRING_PHASE.map(phase=>{ const core=createPlasmaMaterial(prepared.uniforms,true); core.uniforms.uFiring.value=phase; return core; }),[prepared]);
  useEffect(()=>()=>cores.forEach(core=>core.dispose()),[cores]);
  const beams = useMemo(()=>{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(rig.beams,3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('aEnd',new BufferAttribute(rig.beamEnds,1));
    return { geometry, line: createBeamMaterial(false), dots: createBeamMaterial(true) };
  },[rig]);
  useEffect(()=>()=>{ beams.geometry.dispose(); beams.line.dispose(); beams.dots.dispose(); },[beams]);
  // Shockwave radiates from the assembled engine's centre (world space).
  const shockOrigin = useMemo(()=>new Box3().setFromObject(prepared.model).getCenter(new Vector3()).multiplyScalar(ENGINE_SCALE),[prepared]);
  const shock = useRef({ trigger: createShockTrigger(), started: -1 });
  const shockRing = useRef<Mesh>(null);
  useEffect(() => prepared.dispose, [prepared]);
  const { visible, invalidate } = useSceneActivity(reduced);
  const updateHeat = useEngineHeat(prepared.model,prepared.uniforms,heat,reduced,visible);
  const splitState = useRef({ amount: 0, framed: -1, mobile: false });
  const recovery = useGraphicsRecovery();
  const setDpr = useThree(state => state.setDpr);
  const animating = useRef(false);
  const level = useFrameGovernor(!reduced, animating);
  const [target, setTarget] = useState<[number, number, number]>([0, .1, 0]);
  const stage = useRef<Group>(null);
  const applied = useRef({ x: NaN, y: NaN, z: NaN, w: NaN, fov: NaN });
  const anchors = useMemo(() => ENGINE_FOCUS.map(([x, y, z]) => new Vector3(x, y, z).multiplyScalar(ENGINE_SCALE)), []);

  useEffect(() => {
    prepared.model.traverse(object => {
      if (object instanceof Mesh) { object.castShadow = !xray && profile.shadows && level < 2; object.receiveShadow = !xray && profile.shadows && level < 2; }
    });
  }, [prepared, profile.shadows, level, xray]);
  useEffect(()=>{ prepared.setXray(xray); invalidate(); },[prepared,xray,invalidate]);
  useEffect(()=>{ invalidate(); },[split,heat,reduced,invalidate]);
  useEffect(() => {
    prepared.setMode(debugZones ? 'zones' : mode);
    const env = RIG[mode][6];
    prepared.materials.forEach(material => { material.envMapIntensity = env; });
    invalidate();
  }, [prepared, mode, debugZones, invalidate]);
  useEffect(() => {
    // Governor: L1 trims DPR and shadow resolution, L2 drops shadows and micro-detail.
    if (level === 0) return;
    setDpr(level === 1 ? Math.max(1, profile.dpr[1] * .75) : 1);
    prepared.uniforms.uDetail.value = level >= 2 ? 0 : 1;
    console.info(`[md] frame governor → quality level ${level}`);
    invalidate();
  }, [level, setDpr, prepared, profile.dpr, invalidate]);

  // Scroll progress and worker replies wake the demand loop; settled replies don't.
  useEffect(() => subscribeTourProgress(() => { if (visible.current && !document.hidden) invalidate(); }), [visible, invalidate]);
  useEffect(() => engineChannel.subscribe(() => {
    const out = engineChannel.latest, last = applied.current;
    if (!visible.current || document.hidden) return;
    if (out[ENGINE_OUT.qx] !== last.x || out[ENGINE_OUT.qy] !== last.y || out[ENGINE_OUT.qz] !== last.z || out[ENGINE_OUT.qw] !== last.w || out[ENGINE_OUT.fov] !== last.fov) invalidate();
  }), [visible, invalidate]);
  // Inspection starts orbiting around wherever the tour camera was aiming.
  useEffect(() => {
    if (!inspect) return;
    const out = engineChannel.latest;
    setTarget([out[ENGINE_OUT.tx], out[ENGINE_OUT.ty], out[ENGINE_OUT.tz]]);
  }, [inspect]);

  const ticks = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2, inner = i % 4 === 0 ? 1.43 : 1.49;
      points.push(Math.cos(angle) * inner, -1.19, Math.sin(angle) * inner, Math.cos(angle) * 1.57, -1.19, Math.sin(angle) * 1.57);
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
  }, []);
  useEffect(() => () => { ticks.dispose(); }, [ticks]);

  useFrame(({ camera, size, clock }, frameDelta) => {
    animating.current = false;
    if (!visible.current || document.hidden) return;
    const delta = Math.min(frameDelta, .1);
    const progress = reduced ? (chapterAt(motion.tour) + .3) / 4 : motion.tour; // Reduced motion snaps between stops.
    const splitGoal = split && !reduced ? motion.split : 0;
    const separation=splitState.current;
    separation.amount = reduced ? 0 : separation.amount+(splitGoal-separation.amount)*(1-Math.exp(-delta*9));
    if(Math.abs(separation.amount-splitGoal)<.0001)separation.amount=splitGoal;
    const bounds=rig.apply(separation.amount,motion.mobile,xray);
    if(Math.abs(separation.amount-separation.framed)>.001 || separation.mobile!==motion.mobile || (separation.amount===0 && separation.framed!==0)) {
      sendFraming(bounds); separation.framed=separation.amount; separation.mobile=motion.mobile;
      (beams.geometry.getAttribute('position') as BufferAttribute).needsUpdate=true;
    }
    const telemetry=reduced ? 0 : Math.min(1,separation.amount*4);
    beams.line.uniforms.uAmount.value=beams.dots.uniforms.uAmount.value=telemetry;
    beams.line.uniforms.uTime.value=clock.elapsedTime;
    if(telemetry>0){animating.current=true;invalidate();}
    // Reassembly shockwave (+ the clack when SOUND is on).
    const wave=shock.current;
    if(shouldShock(wave.trigger,separation.amount,motion.tour) && !reduced){ wave.started=clock.elapsedTime; engineAudio.clack(); }
    const front=shockAt(wave.started<0 ? -1 : clock.elapsedTime-wave.started);
    prepared.uniforms.uShockOrigin.value.copy(shockOrigin);
    prepared.uniforms.uShock.value.set(front.radius,front.strength);
    if(shockRing.current){
      shockRing.current.visible=front.strength>0;
      shockRing.current.scale.setScalar(Math.max(.01,front.radius));
      (shockRing.current.material as MeshBasicMaterial).opacity=front.strength*.9;
    }
    if(front.strength>0){animating.current=true;invalidate();}
    else wave.started=-1;
    // Opt-in engine idle: its measured level shivers the castings.
    const vibe=reduced ? 0 : engineAudio.level();
    prepared.uniforms.uVibe.value=vibe; prepared.uniforms.uVibeTime.value=clock.elapsedTime;
    if(vibe>0){animating.current=true;invalidate();}
    if(separation.amount!==splitGoal) {animating.current=true;invalidate();}
    let idle = false;
    if (!inspect) {
      const input = engineChannel.input;
      let leanX = 0, leanY = 0;
      if (!reduced) {
        if (!motion.coarse) { leanX = motion.pointerX * .1; leanY = motion.pointerY * .055; }
        else if (motion.gyroAllowed) { leanX = motion.pointerX * .08; leanY = motion.pointerY * .04; }
        else { idle = true; const t = clock.elapsedTime; leanX = Math.sin(t * .45) * .07; leanY = Math.sin(t * .31) * .03; }
      }
      input[ENGINE_IN.progress] = progress;
      input[ENGINE_IN.aspect] = size.width / Math.max(1, size.height);
      input[ENGINE_IN.viewportAspect] = window.innerWidth / Math.max(1, window.innerHeight);
      input[ENGINE_IN.leanX] = leanX;
      input[ENGINE_IN.leanY] = leanY;
      input[ENGINE_IN.mobile] = motion.mobile ? 1 : 0;
      input[ENGINE_IN.reduced] = reduced ? 1 : 0;
      input[ENGINE_IN.split] = separation.amount;
      engineChannel.push(delta);
      if (engineChannel.ready && camera instanceof PerspectiveCamera) {
        const out = engineChannel.latest, last = applied.current;
        camera.position.set(out[ENGINE_OUT.px], out[ENGINE_OUT.py], out[ENGINE_OUT.pz]);
        camera.quaternion.set(out[ENGINE_OUT.qx], out[ENGINE_OUT.qy], out[ENGINE_OUT.qz], out[ENGINE_OUT.qw]);
        if (camera.fov !== out[ENGINE_OUT.fov]) { camera.fov = out[ENGINE_OUT.fov]; camera.updateProjectionMatrix(); }
        last.x = out[ENGINE_OUT.qx]; last.y = out[ENGINE_OUT.qy]; last.z = out[ENGINE_OUT.qz]; last.w = out[ENGINE_OUT.qw]; last.fov = out[ENGINE_OUT.fov];
        if (out[ENGINE_OUT.settled] < .5) { animating.current = true; invalidate(); }
      }
    }
    if (stage.current) stage.current.rotation.y = reduced ? 0 : -engineChannel.latest[ENGINE_OUT.progress] * Math.PI * .3;
    if(!inspect && camera instanceof PerspectiveCamera){
      const fit=cameraProfile(window.innerWidth/Math.max(1,window.innerHeight));
      frameAssembly(camera,bounds,size.width/Math.max(1,size.height),fit.frameWidth,fit.frameHeight);
    }
    // Project the active inspection anchor to screen space for the DOM reticle + leader.
    camera.updateMatrixWorld();
    const chapter=chapterAt(motion.tour);
    rig.offsetFor(['cover','intake','timing','flywheel'][chapter],tmp);
    tmp.add(anchors[chapter]).project(camera);
    engineHud.place((tmp.x * .5 + .5) * size.width, (-tmp.y * .5 + .5) * size.height, tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2);
    if(updateHeat(camera,delta)) {animating.current=true;invalidate();}
    prepared.plasma.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
    for(const core of cores) core.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
    if(xray && !reduced) {animating.current=true;invalidate();}
    if (idle) { animating.current = true; invalidate(); }
  });

  return <>
    <StudioRig mode={mode} shadowLevel={level} />
    <Environment resolution={256} frames={1}>
      <group name={`Engine reflection capture ${recovery}`}>
        <Lightformer intensity={2} color="#fff0de" position={[0, 4, 3]} scale={[6, 2, 1]} />
        <Lightformer intensity={1} color="#b5c8e8" position={[-4, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 6, 1]} />
        <Lightformer intensity={3} position={[3, 2, -3]} rotation={[0, -Math.PI / 4, 0]} scale={[1, 5, 1]} />
      </group>
    </Environment>
    <group name="EngineTourModel" scale={ENGINE_SCALE}><primitive object={prepared.model} /></group>
    {/* Keep core geometry mounted across toggles and restored contexts. This
        avoids allocations and disposal callbacks holding pre-loss GPU handles. */}
    <group name="Illustrated crimson energy cores" scale={ENGINE_SCALE} visible={xray}>
      {[-.375,-.125,.125,.375].map((x,i)=><mesh key={x} position={[x,-.02,.02]} material={cores[i]} renderOrder={1}>
        <cylinderGeometry args={[.064,.075,.42,16,1]} />
      </mesh>)}
    </group>
    <group name="Telemetry beams" scale={ENGINE_SCALE}>
      <lineSegments geometry={beams.geometry} material={beams.line} renderOrder={3} frustumCulled={false} />
      <points geometry={beams.geometry} material={beams.dots} renderOrder={3} frustumCulled={false} />
    </group>
    <group ref={stage} name="EngineTurntable">
      <mesh ref={shockRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.195, 0]} visible={false}>
        <ringGeometry args={[.96, 1, 96]} />
        <meshBasicMaterial color={CRIMSON} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={2} />
      </mesh>
      {profile.shadows && level < 2 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.19, 0]} receiveShadow>
        <circleGeometry args={[1.25, 64]} /><shadowMaterial transparent opacity={.5} />
      </mesh>}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.205, 0]}>
        <circleGeometry args={[1.1, 64]} /><meshBasicMaterial color="#050505" transparent opacity={.65} depthWrite={false} />
      </mesh>
      {[1.15, 1.36, 1.57].map((radius, i) => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <ringGeometry args={[radius, radius + (i === 2 ? .008 : .004), 128]} />
        <meshBasicMaterial color={i === 1 ? '#8D99AE' : CRIMSON} transparent opacity={i === 2 ? .85 : .4} side={2} depthWrite={false} />
      </mesh>)}
      <lineSegments geometry={ticks}><lineBasicMaterial color="#8D99AE" transparent opacity={.55} depthWrite={false} /></lineSegments>
    </group>
    {inspect && <OrbitControls target={target} enableZoom enablePan={false} enableDamping dampingFactor={.12}
      minDistance={2.2} maxDistance={9} zoomSpeed={.65}
      minPolarAngle={.25} maxPolarAngle={Math.PI * .62} rotateSpeed={.7} />}
  </>;
}
