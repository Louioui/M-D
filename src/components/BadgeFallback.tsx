import { useLanguage } from '../i18n';

/** Static badge shown before WebGL is ready, or when it is unavailable. */
export function BadgeFallback() {
  const { copy } = useLanguage();
  return <img className="logo-fallback" src="/brand.webp" alt={copy.hero.badgeAlt} />;
}
