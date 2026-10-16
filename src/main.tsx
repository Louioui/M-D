import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './i18n';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode>
  <ErrorBoundary><LanguageProvider><App /></LanguageProvider></ErrorBoundary>
</StrictMode>);

// Start streaming once the shell has painted: badge first, then the tiered engine.
requestAnimationFrame(() => {
  import('./lib/assetLoader.ts').then(({ prefetchAssets }) => prefetchAssets()).catch(error => console.error('[md] asset prefetch failed', error));
});
