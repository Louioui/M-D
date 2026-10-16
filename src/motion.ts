import { useEffect, useState } from 'react';

/** Mutable per-frame input shared by scroll handlers and canvases (never React state). */
export const motion = { scroll: 0, velocity: 0, tour: 0, pointerX: 0, pointerY: 0, reduced: false, mobile: false, coarse: false, gyroAllowed: false };

export function useMotionPreference() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { motion.reduced = query.matches; setReduced(query.matches); };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}

// ScrollTrigger's smoothed playhead wakes demand-rendered engine canvases directly.
const tourListeners = new Set<() => void>();
export function publishTourProgress(value: number) {
  motion.tour = value;
  tourListeners.forEach(listener => listener());
}
export function subscribeTourProgress(listener: () => void) {
  tourListeners.add(listener);
  return () => { tourListeners.delete(listener); };
}
