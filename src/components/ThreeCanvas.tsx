import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { deviceProfile } from '../lib/deviceTier.ts';
import { webgl2Available } from '../lib/graphics.ts';

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('[md] 3D scene failed; showing the static fallback.', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface ThreeCanvasProps {
  kind: 'badge' | 'engine';
  label: string;
  fallback: ReactNode;
  restoringLabel: string;
  /** Pointer capture only when the visitor opts into inspection; otherwise touch scroll stays native. */
  interactive?: boolean;
  children: ReactNode;
}

/**
 * Adaptive WebGL host: WebGL2 gate, tiered DPR, demand rendering, and context
 * loss recovery. A lost context (iOS GPU memory pressure) is cancelled with
 * preventDefault. Three restores its own GPU resources; wake the demand renderer
 * without replacing its canvas. No restore within 6 s → static fallback.
 */
export default function ThreeCanvas({ kind, label, fallback, restoringLabel, interactive = false, children }: ThreeCanvasProps) {
  const profile = deviceProfile();
  const [context, setContext] = useState<'live' | 'lost' | 'failed'>('live');
  const detach = useRef<(() => void) | null>(null);

  const onCreated = useCallback(({ gl, invalidate }: RootState) => {
    detach.current?.();
    const canvas = gl.domElement;
    let timer = 0;
    const lost = (event: Event) => {
      event.preventDefault();
      console.warn(`[md] ${kind} WebGL context lost; waiting for restore.`);
      setContext('lost');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        detach.current?.();
        detach.current = null;
        setContext('failed');
      }, 6000);
    };
    const restored = () => {
      // WebGLRenderer has already rebuilt its caches in its restore listener.
      // Remounting here raced disposal against restored GPU resources.
      window.clearTimeout(timer);
      setContext('live');
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    detach.current = () => {
      window.clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [kind]);
  useEffect(() => () => detach.current?.(), []);

  if (!webgl2Available || context === 'failed') return <>{fallback}</>;
  const engine = kind === 'engine';
  return <SceneBoundary fallback={fallback}>
    <div className="three-canvas">
      <Canvas
        // The badge canvas is small, so it renders at up to 2× everywhere: the
        // lettering is the first thing a visitor reads.
        dpr={engine ? profile.dpr : [1, 2]}
        frameloop="demand" resize={{ offsetSize: true }}
        shadows={engine && profile.shadows ? 'soft' : false}
        camera={{ position: engine ? [2.5, 1.5, 3.7] : [0, 0, 5.6], fov: 38, near: .1, far: 60 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
        onCreated={onCreated}
        aria-label={label}
        style={{ pointerEvents: interactive ? 'auto' : 'none', touchAction: interactive ? 'none' : 'pan-y' }}>
        {children}
      </Canvas>
      {context === 'lost' && <div className="scene-loading mono" role="status">{restoringLabel}</div>}
    </div>
  </SceneBoundary>;
}
