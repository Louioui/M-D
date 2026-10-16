import { useSyncExternalStore } from 'react';
import { progressSnapshot, subscribeProgress } from '../lib/loadProgress.ts';
import { useLanguage } from '../i18n';

/** Industrial progress bar for streaming + Draco decode + worker analysis. */
export default function LoadingGauge() {
  const { copy } = useLanguage();
  const progress = useSyncExternalStore(subscribeProgress, progressSnapshot);
  const total = Math.round((progress.engineBytes * .6 + progress.engineDetail * .4) * 100);
  return <div className="loading-gauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={total} aria-label={copy.tour.loading}>
    <p className="mono loading-gauge-title">{copy.tour.loading}</p>
    <div className="loading-gauge-track"><span style={{ transform: `scaleX(${total / 100})` }} /></div>
    <p className="mono loading-gauge-meta"><span>{copy.tour.stages[progress.stage]}</span><span>{String(total).padStart(3, '0')}%</span></p>
  </div>;
}
