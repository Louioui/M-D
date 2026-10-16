import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { frameQuality } from '../lib/frameQuality';

/** Demand rendering continues only while this canvas is visible and the tab is active. */
export function useSceneActivity(reduced: boolean) {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);
  const visible = useRef(false);

  useEffect(() => {
    const update = () => { if (visible.current && !document.hidden) invalidate(); };
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; update(); });
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

export const SLOW_FRAME_SECONDS = .022; // < 45 fps
export const SLOW_FRAME_RUN = 30;

/**
 * Frame-time governor. The scene explicitly reports continued animation, so a
 * true idle gap resets the run while even >250ms active frames count as slow.
 * 0 = full quality, 1 = smaller shadow map + lower DPR, 2 = no shadows/micro-detail, DPR 1.
 */
export function useFrameGovernor(enabled: boolean, animating: RefObject<boolean>) {
  const [level, setLevel] = useState(0);
  const quality = useRef({ level: 0, slowRun: 0 });
  useFrame((_, delta) => {
    if (!enabled || level >= 2) return;
    const next = frameQuality(quality.current, delta, animating.current);
    if (next !== level) setLevel(next);
  });
  return level;
}
