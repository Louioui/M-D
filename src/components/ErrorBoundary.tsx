import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last-resort boundary: the shop stays reachable even if the app itself fails. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown, info: ErrorInfo) { console.error('[md] application error', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-error">
      <h1>M&D MULTI-SERVICE</h1>
      <p>Something stalled. Algo se trabó.</p>
      <p><a href="tel:+13233544795">(323) 354-4795</a> · <a href="mailto:md_multiservice@yahoo.com">md_multiservice@yahoo.com</a></p>
      <p>419 N Boyle Ave, Los Angeles, CA 90033</p>
      <button className="button primary" onClick={() => location.reload()}>Reload / Recargar</button>
    </main>;
  }
}
