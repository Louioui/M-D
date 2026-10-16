import { useLanguage } from '../i18n';

/** English / Español switch; 48px minimum target. */
export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, copy } = useLanguage();
  return <div className={'lang-toggle mono ' + className} role="group" aria-label={copy.switchLabel}>
    {(['en', 'es'] as const).map(code => <button key={code} type="button" lang={code} aria-pressed={lang === code}
      className={lang === code ? 'is-active' : ''} onClick={() => setLang(code)}>{code === 'en' ? 'EN' : 'ES'}</button>)}
  </div>;
}
