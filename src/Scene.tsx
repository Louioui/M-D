import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { ACESFilmicToneMapping, BufferGeometry, Float32BufferAttribute, Group, MathUtils, Vector3 } from 'three';
import { motion, subscribeTourProgress } from './motion';
import { sampleEnginePath, ENGINE_FOCUS, chapterAt } from './enginePath.mjs';
import { prepareEngineMaterials } from './engineMaterials';

const LOGO_MODEL = '/models/logo-articulated.glb';
const IDLE_SPEED = Math.PI / 30; // One revolution per minute.

/** Demand rendering continues only while this canvas is visible and the tab is active. */
function useSceneActivity(reduced: boolean) {
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const visible = useRef(false);

  useEffect(() => {
    const update = () => {
      if (visible.current && !document.hidden) invalidate();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      update();
    });
    observer.observe(canvas);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('pointermove', update, { passive: true });
    window.addEventListener('deviceorientation', update, { passive: true });
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('pointermove', update);
      window.removeEventListener('deviceorientation', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [canvas, invalidate]);

  useEffect(() => { invalidate(); }, [reduced, invalidate]);
  return { visible, invalidate };
}

function LogoModel({ reduced }: { reduced: boolean }) {
  const { scene } = useGLTF(LOGO_MODEL, '/draco/');
  // Geometry and textures remain shared; object transforms belong to this instance.
  const { badge, gear } = useMemo(() => {
    const badge = scene.clone(true);
    const gear = badge.getObjectByName('GearAssembly');
    if (!gear) throw new Error('The articulated logo is missing its gear assembly.');
    return { badge, gear };
  }, [scene]);
  const tilt = useRef<Group>(null);
  const speed = useRef(IDLE_SPEED);
  const { visible, invalidate } = useSceneActivity(reduced);

  useFrame((_, frameDelta) => {
    if (!tilt.current) return;
    const delta = Math.min(frameDelta, .1); // No large jump after tab suspension.
    if (reduced) {
      tilt.current.rotation.set(0, 0, 0);
      gear.rotation.z = 0;
      speed.current = IDLE_SPEED;
      return;
    }
    if (!visible.current || document.hidden) return;

    motion.velocity *= Math.exp(-delta * 6);
    const scrollSpeed = MathUtils.clamp(motion.velocity * .0025, -3, 3);
    const targetSpeed = Math.abs(motion.velocity) > 35 ? scrollSpeed : IDLE_SPEED;
    speed.current = MathUtils.damp(speed.current, targetSpeed, 5, delta);
    gear.rotation.z = (gear.rotation.z + speed.current * delta) % (Math.PI * 2);
    tilt.current.rotation.x = MathUtils.damp(tilt.current.rotation.x, motion.pointerY * .15, 7, delta);
    tilt.current.rotation.y = MathUtils.damp(tilt.current.rotation.y, motion.pointerX * .22, 7, delta);
    // The plate, lettering and wrenches never inherit the gear's Z rotation.
    tilt.current.rotation.z = 0;
    invalidate();
  });

  return <group ref={tilt} scale={1.38}><primitive object={badge} /></group>;
}

function EngineModel({ reduced }: { reduced: boolean }) {
  // Choose before fetching: phones never download the desktop model or 4K maps.
  const [compact] = useState(() => window.matchMedia('(max-width: 767px)').matches ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
  const { scene } = useGLTF(compact ? '/models/engine-mobile.glb' : '/models/engine-studio.glb', '/draco/');
  const prepared = useMemo(() => prepareEngineMaterials(scene), [scene]);
  const model = prepared.model;
  useEffect(() => prepared.dispose, [prepared]);
  const { visible, invalidate } = useSceneActivity(reduced);
  const progress = useRef(0), lean = useRef({ x: 0, y: 0 });
  const stage = useRef<Group>(null), marker = useRef<Group>(null);
  const vectors = useMemo(() => ({ position: new Vector3(), target: new Vector3(), focus: new Vector3(), direction: new Vector3(), right: new Vector3(), up: new Vector3(), corner: new Vector3() }), []);
  const ticks = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2, inner = i % 4 === 0 ? 1.43 : 1.49;
      points.push(Math.cos(angle) * inner, -1.19, Math.sin(angle) * inner,
        Math.cos(angle) * 1.57, -1.19, Math.sin(angle) * 1.57);
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
  }, []);
  useEffect(() => () => { ticks.dispose(); }, [ticks]);
  useEffect(() => subscribeTourProgress(() => {
    if (visible.current && !document.hidden) invalidate();
  }), [visible, invalidate]);

  useFrame(({ camera }, frameDelta) => {
    if (!visible.current || document.hidden) return;
    const delta = Math.min(frameDelta, .1);
    progress.current = reduced ? 0 : MathUtils.damp(progress.current, motion.tour, 11, delta);
    const x = reduced || motion.mobile ? 0 : motion.pointerX * .1;
    const y = reduced || motion.mobile ? 0 : motion.pointerY * .055;
    lean.current.x = reduced ? 0 : MathUtils.damp(lean.current.x, x, 7, delta);
    lean.current.y = reduced ? 0 : MathUtils.damp(lean.current.y, y, 7, delta);
    sampleEnginePath(progress.current, vectors.position, vectors.target, motion.mobile);
    vectors.position.x += lean.current.x;
    vectors.position.y += lean.current.y;
    // Fit the real engine bounds, including during portrait and short-screen views.
    // Solving distance in camera space prevents clipping without changing layout.
    if ('fov' in camera && 'aspect' in camera) {
      vectors.direction.copy(vectors.position).sub(vectors.target).normalize();
      vectors.right.crossVectors(camera.up, vectors.direction).normalize();
      vectors.up.crossVectors(vectors.direction, vectors.right);
      const tanY = Math.tan(Number(camera.fov) * Math.PI / 360) * .94;
      const tanX = tanY * Number(camera.aspect);
      let distance = vectors.position.distanceTo(vectors.target);
      for (const point of prepared.framing) {
        vectors.corner.copy(point).sub(vectors.target);
        distance = Math.max(distance, vectors.corner.dot(vectors.direction) +
          Math.max(Math.abs(vectors.corner.dot(vectors.right)) / tanX, Math.abs(vectors.corner.dot(vectors.up)) / tanY));
      }
      vectors.position.copy(vectors.target).addScaledVector(vectors.direction, distance);
    }
    camera.position.copy(vectors.position);
    camera.lookAt(vectors.target);
    const focus = ENGINE_FOCUS[chapterAt(reduced ? 0 : motion.tour)];
    vectors.focus.set(focus[0] * 1.22, focus[1] * 1.22, focus[2] * 1.22);
    if (marker.current) {
      if (reduced) marker.current.position.copy(vectors.focus);
      else marker.current.position.lerp(vectors.focus, 1 - Math.exp(-delta * 9));
      marker.current.quaternion.copy(camera.quaternion);
    }
    if (stage.current) stage.current.rotation.y = reduced ? 0 : -progress.current * Math.PI * .3;
    const unsettled = Math.abs(progress.current - motion.tour) > .00003 ||
      Math.abs(lean.current.x - x) + Math.abs(lean.current.y - y) > .0001 ||
      (marker.current ? marker.current.position.distanceTo(vectors.focus) > .001 : false);
    if (!reduced && unsettled) invalidate();
  });
  return <>
    <group name="EngineTourModel" scale={1.22}><primitive object={model} /></group>
    <group ref={stage} name="EngineTurntable">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.205, 0]}>
        <circleGeometry args={[1.1, 64]} /><meshBasicMaterial color="#050505" transparent opacity={.65} depthWrite={false} />
      </mesh>
      {[1.15, 1.36, 1.57].map((radius, i) => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <ringGeometry args={[radius, radius + (i === 2 ? .008 : .004), 128]} />
        <meshBasicMaterial color={i === 1 ? '#787878' : '#ed2429'} transparent opacity={i === 2 ? .85 : .4} side={2} depthWrite={false} />
      </mesh>)}
      <lineSegments geometry={ticks}><lineBasicMaterial color="#8d6767" transparent opacity={.7} depthWrite={false} /></lineSegments>
    </group>
    <group ref={marker} name="EngineFocusMarker" renderOrder={20}>
      <mesh renderOrder={20}><ringGeometry args={[.075, .082, 48]} /><meshBasicMaterial color="#ff343b" transparent opacity={.95} depthTest={false} depthWrite={false} /></mesh>
      <mesh renderOrder={20}><ringGeometry args={[.105, .108, 48]} /><meshBasicMaterial color="#ff343b" transparent opacity={.4} depthTest={false} depthWrite={false} /></mesh>
      <mesh renderOrder={20}><circleGeometry args={[.018, 16]} /><meshBasicMaterial color="#ff343b" depthTest={false} depthWrite={false} /></mesh>
    </group>
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

export default function Scene({ kind, reduced }: { kind: 'logo' | 'engine'; reduced: boolean }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => { setReady(true); }, []);
  const fallback = kind === 'logo'
    ? <img className="logo-fallback" src="/brand.webp" alt="M&D Multi-Service forged steel badge" />
    : <div className="engine-fallback">Your engine. In good hands.</div>;
  return <SceneBoundary fallback={fallback}><div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {kind === 'engine' && !ready && <div className="scene-loading mono" role="status">LOADING THE ENGINE…</div>}
    <Canvas dpr={[1, kind === 'engine' && window.matchMedia('(max-width: 767px)').matches ? 1.25 : 1.5]} frameloop="demand" resize={{ offsetSize: true }}
      camera={{ position: kind === 'logo' ? [0, 0, 6.5] : [2.5, 1.5, 3.7], fov: 38 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }} fallback={fallback}
      aria-label={kind === 'logo' ? 'M&D badge with an independently rotating steel gear' : 'Interactive four-zone engine tour'}>
      <ambientLight intensity={kind === 'engine' ? .3 : 1.4} />
      {kind === 'engine' ? <>
        <directionalLight name="Warm studio key" position={[3, 5, 4]} color="#fff0dc" intensity={2.4} />
        <directionalLight name="Cool studio fill" position={[-4, 1.5, 2]} color="#b6d0ef" intensity={1.15} />
        <directionalLight name="Edge separation rim" position={[1, 3, -4]} color="#e3eeff" intensity={3} />
      </> : <>
        <directionalLight position={[3, 5, 5]} intensity={3.5} />
        <directionalLight position={[-4, 1, 2]} intensity={2} />
        <pointLight position={[3, 1, -3]} color="#ff2525" intensity={24} />
      </>}
      <Suspense fallback={null}>
        <Environment resolution={kind === 'engine' ? 256 : 128} frames={1}>
          <Lightformer intensity={kind === 'engine' ? 2 : 4} color={kind === 'engine' ? '#fff0de' : '#ffffff'} position={[0, 4, 3]} scale={kind === 'engine' ? [6, 2, 1] : [8, 2, 1]} />
          <Lightformer intensity={kind === 'engine' ? 1 : 2} color={kind === 'engine' ? '#b5d3ff' : '#ffffff'} position={kind === 'engine' ? [-4, 1, 1] : [-4, 0, 1]} rotation={[0, kind === 'engine' ? Math.PI / 2 : 0, 0]} scale={kind === 'engine' ? [2, 6, 1] : [2, 8, 1]} />
          <Lightformer intensity={kind === 'engine' ? 3 : 2} position={kind === 'engine' ? [3, 2, -3] : [4, 0, -2]} rotation={[0, kind === 'engine' ? -Math.PI / 4 : 0, 0]} scale={kind === 'engine' ? [1, 5, 1] : [2, 8, 1]} />
        </Environment>
        {kind === 'logo' ? <LogoModel reduced={reduced} /> : <EngineModel reduced={reduced} />}
        <SceneReady onReady={onReady} />
      </Suspense>
    </Canvas>
  </div></SceneBoundary>;
}
