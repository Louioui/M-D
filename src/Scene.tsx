import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF } from '@react-three/drei';
import { Group, MathUtils, Vector3 } from 'three';
import { motion } from './motion';

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

const CAMERA: { position: [number, number, number]; target: [number, number, number] }[] = [
  { position: [2.5, 1.5, 3.7], target: [0, .25, 0] },
  { position: [-2.9, .55, 3.3], target: [-.15, .05, 0] },
  { position: [2.8, 1.5, 2.7], target: [.1, .35, 0] },
  { position: [1, -.4, 3.9], target: [0, -.35, 0] },
  { position: [.4, -.3, 3.7], target: [0, -.3, 0] },
];

function EngineModel({ reduced }: { reduced: boolean }) {
  const { scene } = useGLTF('/models/engine.glb', '/draco/');
  const model = useMemo(() => scene.clone(true), [scene]);
  const { visible } = useSceneActivity(reduced);
  const vectors = useMemo(() => ({ desired: new Vector3(), temp: new Vector3(), target: new Vector3() }), []);
  useFrame(({ camera }) => {
    if (!visible.current || document.hidden) return;
    const progress = reduced ? 0 : motion.tour;
    const index = Math.min(3, Math.floor(progress * 4));
    const blend = Math.min(1, progress * 4 - index);
    const a = CAMERA[index], b = CAMERA[index + 1];
    vectors.desired.set(...a.position).lerp(vectors.temp.set(...b.position), blend);
    if (motion.mobile) { vectors.desired.x *= .45; vectors.desired.multiplyScalar(1.17); }
    camera.position.copy(vectors.desired);
    vectors.target.set(...a.target).lerp(vectors.temp.set(...b.target), blend);
    camera.lookAt(vectors.target);
  });
  return <group scale={1.1}><primitive object={model} /></group>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Scene({ kind, reduced }: { kind: 'logo' | 'engine'; reduced: boolean }) {
  const fallback = kind === 'logo'
    ? <img className="logo-fallback" src="/brand.webp" alt="M&D Multi-Service forged steel badge" />
    : <div className="engine-fallback">Precision. From the inside out.</div>;
  return <SceneBoundary fallback={fallback}>
    <Canvas dpr={[1, 1.5]} frameloop="demand" resize={{ offsetSize: true }}
      camera={{ position: kind === 'logo' ? [0, 0, 6.5] : [2.5, 1.5, 3.7], fov: 38 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }} fallback={fallback}
      aria-label={kind === 'logo' ? 'M&D badge with an independently rotating steel gear' : 'Interactive four-zone engine tour'}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 5]} intensity={3.5} />
      <directionalLight position={[-4, 1, 2]} intensity={2} />
      <pointLight position={[3, 1, -3]} color="#ff2525" intensity={24} />
      <Suspense fallback={null}>
        <Environment resolution={128}>
          <Lightformer intensity={4} position={[0, 4, 3]} scale={[8, 2, 1]} />
          <Lightformer intensity={2} position={[-4, 0, 1]} scale={[2, 8, 1]} />
          <Lightformer intensity={2} position={[4, 0, -2]} scale={[2, 8, 1]} />
        </Environment>
        {kind === 'logo' ? <LogoModel reduced={reduced} /> : <EngineModel reduced={reduced} />}
      </Suspense>
    </Canvas>
  </SceneBoundary>;
}
