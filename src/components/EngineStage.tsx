import { use } from 'react';
import { useLanguage } from '../i18n';
import { loadEngineAssets } from '../lib/assetLoader.ts';
import type { InspectionMode } from '../lib/inspection.ts';
import ThreeCanvas from './ThreeCanvas';
import EngineModel from './EngineModel';

/** Suspends until the GLB is decoded and the detail worker's buffers have landed; only then mounts WebGL. */
export default function EngineStage({ reduced, mode, inspect, debugZones }: { reduced: boolean; mode: InspectionMode; inspect: boolean; debugZones: boolean }) {
  const { copy } = useLanguage();
  const assets = use(loadEngineAssets());
  return <ThreeCanvas kind="engine" label={copy.tour.canvasLabel} restoringLabel={copy.tour.restoring} interactive={inspect}
    fallback={<div className="engine-fallback">{copy.tour.fallback}</div>}>
    <EngineModel assets={assets} reduced={reduced} mode={mode} inspect={inspect} debugZones={debugZones} />
  </ThreeCanvas>;
}
