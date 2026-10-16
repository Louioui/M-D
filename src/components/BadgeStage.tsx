import { use } from 'react';
import { useLanguage } from '../i18n';
import { loadBadge } from '../lib/assetLoader.ts';
import ThreeCanvas from './ThreeCanvas';
import BadgeModel from './BadgeModel';
import { BadgeFallback } from './BadgeFallback';

/** Critical-path hero badge: streamed first, before the engine. */
export default function BadgeStage({ reduced }: { reduced: boolean }) {
  const { copy } = useLanguage();
  const gltf = use(loadBadge());
  return <ThreeCanvas kind="badge" label={copy.hero.badgeLabel} restoringLabel={copy.tour.restoring} fallback={<BadgeFallback />}>
    <BadgeModel gltf={gltf} reduced={reduced} />
  </ThreeCanvas>;
}
