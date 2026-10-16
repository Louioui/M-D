import { Component, type ReactNode } from 'react';

/** A failed optional 3D asset leaves the rest of the shop and booking form live. */
export default class AssetBoundary extends Component<{
  name: string;
  children: ReactNode;
  fallback: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.warn(`[md] ${this.props.name} unavailable; showing the static fallback.`, error);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
