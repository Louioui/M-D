import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight, ArrowUpRight, Hand, ScanLine } from 'lucide-react';
import { publishTourProgress } from '../motion';
import { useLanguage } from '../i18n';
import type { ServiceKey } from '../copy.ts';
import { engineHud } from '../lib/engineHud.ts';
import { INSPECTION_MODES, type InspectionMode } from '../lib/inspection.ts';
import LoadingGauge from './LoadingGauge';
import Words from './Words';
import './EngineShowcase.css';

const EngineStage = lazy(() => import('./EngineStage'));
gsap.registerPlugin(ScrollTrigger);
const debugZones = new URLSearchParams(location.search).has('zones');

class LoadBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('[md] engine assets failed to load.', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function EngineShowcase({ reduced, onBook }: { reduced: boolean; onBook: (service: ServiceKey) => void }) {
  const { copy } = useLanguage();
  const tour = copy.tour;
  const section = useRef<HTMLElement>(null), stageRef = useRef<HTMLDivElement>(null), visual = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null), cardInner = useRef<HTMLDivElement>(null), watermark = useRef<HTMLSpanElement>(null);
  const reticle = useRef<HTMLDivElement>(null), leader = useRef<SVGPathElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const [mode, setMode] = useState<InspectionMode>('studio');
  const [inspect, setInspect] = useState(false);
  const chapter = tour.chapters[active];
  const side = active % 2 ? 'right' : 'left';

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '800px' });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  // HUD bridge: element refs plus layout measured only on resize / chapter change.
  const measure = useCallback(() => {
    const stage = stageRef.current, canvasBox = visual.current, box = card.current;
    if (!stage || !canvasBox || !box) return;
    const surface = canvasBox.querySelector<HTMLElement>('.engine-stage-canvas');
    // The phone toolbar reserves space above the canvas. Projected 3D anchors
    // must use the canvas origin, not the surrounding visual area's origin.
    engineHud.canvasX = canvasBox.offsetLeft + (surface?.offsetLeft ?? 0);
    engineHud.canvasY = canvasBox.offsetTop + (surface?.offsetTop ?? 0);
    const stacked = getComputedStyle(stage).getPropertyValue('--stacked').trim() === '1';
    engineHud.card = stacked ? null : {
      x: box.offsetLeft + (side === 'left' ? box.offsetWidth : 0),
      y: box.offsetTop + Math.min(64, box.offsetHeight / 2),
    };
    engineHud.dirty();
  }, [side]);
  useLayoutEffect(() => {
    engineHud.reticle = reticle.current;
    engineHud.leader = leader.current;
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    if (card.current) observer.observe(card.current);
    return () => { observer.disconnect(); engineHud.reticle = null; engineHud.leader = null; };
  }, [measure]);

  // Smoothed playhead follows native scroll; React state changes only at chapter boundaries.
  useEffect(() => {
    const playhead = { value: 0 };
    const paint = () => {
      const p = playhead.value;
      publishTourProgress(p);
      const index = Math.min(3, Math.floor(p * 4));
      if (index !== activeRef.current) { activeRef.current = index; setActive(index); }
      bars.current.forEach((bar, i) => { if (bar) gsap.set(bar, { scaleX: Math.min(1, Math.max(0, p * 4 - i)), transformOrigin: 'left' }); });
      // Z-depth: background watermark drifts at 0.25×, foreground HUD card at 1.35× the stage.
      const within = Math.min(1, p * 4 - index) - .5;
      if (watermark.current) gsap.set(watermark.current, { y: reduced ? 0 : within * -.25 * 96, force3D: true });
      if (card.current) {
        engineHud.drift = reduced ? 0 : within * -.35 * 96;
        gsap.set(card.current, { y: engineHud.drift, force3D: true });
        engineHud.dirty();
      }
    };
    const tween = gsap.fromTo(playhead, { value: 0 }, {
      value: 1, ease: 'none', onUpdate: paint,
      scrollTrigger: {
        trigger: section.current, start: 'top top', end: 'bottom bottom',
        scrub: reduced ? true : .6, invalidateOnRefresh: true,
        onRefresh: self => { playhead.value = self.progress; paint(); },
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced]);

  // Foreground HUD card: slides in from its own side (1.35× parallax feel), compositor-only.
  useEffect(() => {
    if (!cardInner.current) return;
    const tween = gsap.fromTo(cardInner.current, { x: reduced ? 0 : side === 'left' ? -28 : 28, y: reduced ? 0 : 12, opacity: reduced ? 1 : .2 }, {
      x: 0, y: 0, opacity: 1, force3D: true, duration: reduced ? 0 : .55, ease: 'power3.out', overwrite: true,
    });
    return () => { tween.kill(); };
  }, [active, side, reduced]);

  useEffect(() => { if (!near) setInspect(false); }, [near]);

  const go = (index: number) => {
    const root = section.current;
    if (!root) return;
    if (index > 3) { document.getElementById('location')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); return; }
    const clamped = Math.min(3, Math.max(0, index));
    const top = root.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + (root.offsetHeight - innerHeight) * (clamped + .3) / 4, behavior: reduced ? 'instant' : 'smooth' });
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.engine-chapter')];
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const current = focused >= 0 ? focused : active;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : Math.max(0, Math.min(3, current + (event.key === 'ArrowRight' ? 1 : -1)));
    go(next);
    buttons[next]?.focus({ preventScroll: true });
  };

  return <section ref={section} className="engine-tour" id="difference" aria-label={tour.section}>
    <div ref={stageRef} className={`engine-tour-stage hud-${side}`}>
      <span ref={watermark} className="engine-watermark" aria-hidden="true">0{active + 1}</span>
      <div className="engine-tour-topline mono">
        <span>{tour.topline} <span className="red">/</span> {chapter.part}</span>
        <span className="engine-count">0{active + 1} / 04</span>
      </div>

      <div ref={visual} className="engine-visual-stage">
        <div className="engine-studio-light" aria-hidden="true" />
        <div className="engine-stage-canvas">
          {near && <LoadBoundary fallback={<div className="engine-fallback">{tour.fallback}</div>}>
            <Suspense fallback={<LoadingGauge />}><EngineStage reduced={reduced} mode={mode} inspect={inspect} debugZones={debugZones} /></Suspense>
          </LoadBoundary>}
        </div>
        <div className="engine-tools">
          <div className="engine-modes" role="radiogroup" aria-label={tour.modesLabel}>
            {INSPECTION_MODES.map(item => <button key={item} role="radio" aria-checked={mode === item}
              className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>{tour.modes[item]}</button>)}
          </div>
          <button className={'engine-inspect' + (inspect ? ' is-active' : '')} aria-pressed={inspect} onClick={() => setInspect(value => !value)}>
            {inspect ? <ScanLine size={15} /> : <Hand size={15} />}{inspect ? tour.inspectOff : tour.inspectOn}
          </button>
          {inspect && <p className="engine-inspect-hint mono" role="status">{tour.inspectHint}</p>}
        </div>
      </div>

      <svg className="engine-leader" aria-hidden="true"><path ref={leader} /></svg>
      <div ref={reticle} className="engine-reticle" aria-hidden="true">
        <span className="engine-reticle-ring" /><span className="engine-reticle-dot" />
        <span className="engine-readout mono"><b>{tour.tag}</b>{chapter.readout.join(' | ')}</span>
      </div>

      <article ref={card} className={`engine-hud-card side-${side}`} aria-live="polite">
        <div ref={cardInner} className="engine-card-inner">
          <p className="engine-part mono">0{active + 1} / {chapter.focus}</p>
          <p className="engine-card-readout mono" aria-hidden="true"><b>{tour.tag}</b>{chapter.readout[0]}</p>
          <h2 className="engine-hook"><Words text={chapter.hook[0]} /><br /><span><Words text={chapter.hook[1]} /></span></h2>
          <p className="engine-story">{chapter.text}</p>
          <button className="engine-tour-cta" onClick={() => onBook(chapter.service)}>{chapter.cta}<ArrowUpRight size={19} /></button>
        </div>
      </article>

      <div className="engine-tour-footer">
        <nav className="engine-chapters" aria-label={tour.chaptersLabel} onKeyDown={keyboard}>
          {tour.chapters.map((item, i) => <button key={item.short} className={'engine-chapter ' + (active === i ? 'is-active' : '')}
            aria-current={active === i ? 'step' : undefined} aria-label={tour.view(i + 1, item.short)} onClick={() => go(i)}>
            <span className="engine-chapter-number">0{i + 1}</span><span className="engine-chapter-name">{item.short}</span>
            <span className="engine-chapter-track" aria-hidden="true"><span ref={el => { bars.current[i] = el; }} /></span>
          </button>)}
        </nav>
        <div className="engine-step-controls">
          <button onClick={() => go(active - 1)} disabled={active === 0} aria-label={tour.prev}><ArrowLeft size={19} /></button>
          <button onClick={() => go(active + 1)} aria-label={active === 3 ? tour.continue : tour.next}><ArrowRight size={19} /></button>
        </div>
      </div>
      <p className="engine-scroll-note mono">{tour.scrollNote}</p>
    </div>
  </section>;
}
