import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { motion } from '../motion';
import { BADGE_IN, BADGE_OUT } from '../lib/cameraSolver.ts';
import { badgeChannel } from '../lib/motionClient.ts';
import { useGraphicsRecovery, useSceneActivity } from './sceneHooks';
import { createLiquidState, prepareLiquidBadge, stepLiquid } from '../lib/liquidBadge.ts';
import { deviceProfile } from '../lib/deviceTier.ts';
import { loadBadgeDetail } from '../lib/assetLoader.ts';

const debugZones = new URLSearchParams(location.search).has('zones');

/** The forged badge: lettering, plate and wrenches stay upright; only GearAssembly turns. */
export default function BadgeModel({ gltf, reduced }: { gltf: GLTF; reduced: boolean }) {
  // Geometry and textures remain shared; object transforms belong to this instance.
  const { badge, gear } = useMemo(() => {
    const badge = gltf.scene.clone(true);
    const gear = badge.getObjectByName('GearAssembly');
    if (!gear) throw new Error('The articulated logo is missing its gear assembly.');
    return { badge, gear };
  }, [gltf]);
  const finish = useMemo(() => prepareLiquidBadge(badge,deviceProfile().clearcoat),[badge]);
  useEffect(() => finish.dispose,[finish]);
  const liquid = useRef(createLiquidState());
  const tilt = useRef<Group>(null);
  const { visible, invalidate } = useSceneActivity(reduced);
  const recovery = useGraphicsRecovery();
  const gl = useThree(state => state.gl);
  // Forged-steel atlas + curvature/cavity land after first paint; upgrade in place.
  useEffect(() => {
    let alive = true;
    finish.setZones(debugZones);
    loadBadgeDetail().then(texture => { if (alive) { finish.setDetail(texture); invalidate(); } });
    return () => { alive = false; };
  }, [finish, invalidate]);
  // Canvas rect for the cursor ripple: re-measured lazily after scroll/resize/dock
  // flips, never on every frame.
  const rect = useRef({ left: 0, bottom: 0, dirty: true });
  useEffect(() => {
    const dirty = () => { rect.current.dirty = true; };
    const observer = new ResizeObserver(dirty); observer.observe(gl.domElement);
    window.addEventListener('scroll', dirty, { passive: true });
    window.addEventListener('resize', dirty, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', dirty); window.removeEventListener('resize', dirty); };
  }, [gl]);

  useFrame((_, frameDelta) => {
    if (!tilt.current || !visible.current || document.hidden) return;
    const delta = Math.min(frameDelta, .1); // No large jump after tab suspension.
    const energy = stepLiquid(liquid.current,motion.pointerX,motion.pointerY,motion.velocity,delta,reduced);
    finish.update(energy,liquid.current.phase,motion.pointerX,motion.pointerY,reduced);
    // Ripples only in the hero (not while docked in the navbar) and only while moving.
    const rippling = !reduced && !motion.docked && !motion.coarse && energy > .002;
    if (rippling) {
      const box = rect.current;
      if (box.dirty) { const r = gl.domElement.getBoundingClientRect(); box.left = r.left; box.bottom = r.bottom; box.dirty = false; }
      const dpr = gl.getPixelRatio();
      finish.ripple((motion.clientX - box.left) * dpr, (box.bottom - motion.clientY) * dpr, 150 * dpr, Math.min(1, energy * 2.2));
    } else finish.ripple(-1e4, -1e4, 150, 0);
    motion.velocity *= Math.exp(-delta * 6);
    const input = badgeChannel.input;
    input[BADGE_IN.velocity] = motion.velocity;
    input[BADGE_IN.pointerX] = motion.pointerX;
    input[BADGE_IN.pointerY] = motion.pointerY;
    input[BADGE_IN.reduced] = reduced ? 1 : 0;
    badgeChannel.push(delta);
    if (badgeChannel.ready) {
      const out = badgeChannel.latest;
      gear.rotation.z = out[BADGE_OUT.gear];
      tilt.current.rotation.set(out[BADGE_OUT.tiltX], out[BADGE_OUT.tiltY], 0);
    }
    if (!reduced || badgeUnsettled()) invalidate();
  });

  return <>
    <ambientLight intensity={.65} />
    <directionalLight position={[-3, 5, 5]} color="#fff1dd" intensity={3.1} />
    <directionalLight position={[4, 0, 3]} color="#c8ddff" intensity={1.65} />
    <directionalLight position={[0, 3, -4]} color="#ecf3ff" intensity={3} />
    <pointLight position={[3, 1, -3]} color="#E63946" intensity={12} />
    {/* Captured once: narrow studio reflections reveal the bevels and socket depth
        without animated lights, postprocessing passes, or per-frame allocations. */}
    <Environment resolution={256} frames={1}>
      <group name={`Badge reflection capture ${recovery}`}>
        <Lightformer intensity={3.4} color="#fff2df" position={[-1, 4, 3]} scale={[7, 1.4, 1]} />
        <Lightformer intensity={2.6} color="#d4e5ff" position={[-4, 0, 2]} scale={[.7, 7, 1]} />
        <Lightformer intensity={2.2} position={[4, 1, 1]} scale={[.45, 6, 1]} />
        <Lightformer intensity={1.4} position={[0, -4, 2]} scale={[5, .4, 1]} />
      </group>
    </Environment>
    <group ref={tilt} scale={1.38}><primitive object={badge} /></group>
  </>;
}

/** Reduced motion still needs frames until the gear and tilt have returned to rest. */
function badgeUnsettled() {
  const out = badgeChannel.latest;
  return Math.abs(out[BADGE_OUT.gear]) + Math.abs(out[BADGE_OUT.tiltX]) + Math.abs(out[BADGE_OUT.tiltY]) > 1e-4;
}
