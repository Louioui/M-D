import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { COPY, type Copy } from './copy.ts';
import type { Lang } from './shop.ts';

const STORAGE_KEY = 'md-lang';

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch { /* Private mode or blocked storage: fall through to the browser language. */ }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

interface LanguageState { lang: Lang; copy: Copy; setLang: (lang: Lang) => void; toggle: () => void }
const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Preference simply isn't remembered. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => ({ lang, copy: COPY[lang], setLang, toggle: () => setLang(lang === 'en' ? 'es' : 'en') }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside <LanguageProvider>.');
  return value;
}
