import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { publishTourProgress } from './motion';
import { TOUR_CHAPTERS } from './tourContent';
import './EngineTour.css';

const Scene = lazy(() => import('./Scene'));
gsap.registerPlugin(ScrollTrigger);

export default function EngineTour({ reduced, onBook }: { reduced: boolean; onBook: () => void }) {
  const section = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const rail = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const chapter = TOUR_CHAPTERS[active];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '700px' });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const playhead = { value: 0 };
    const paint = () => {
      const p = playhead.value;
      publishTourProgress(p);
      const index = Math.min(3, Math.floor(p * 4));
      if (index !== activeRef.current) { activeRef.current = index; setActive(index); }
      bars.current.forEach((bar, i) => {
        if (bar) gsap.set(bar, { scaleX: Math.min(1, Math.max(0, p * 4 - i)), transformOrigin: 'left' });
      });
      if (rail.current) gsap.set(rail.current, { yPercent: p * 1600 });
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

  useEffect(() => {
    if (!copy.current) return;
    const tween = gsap.fromTo(copy.current, { y: reduced ? 0 : 12, opacity: 1 }, {
      y: 0, opacity: 1, force3D: true, duration: reduced ? 0 : .4, ease: 'power2.out', overwrite: true,
    });
    return () => { tween.kill(); };
  }, [active, reduced]);

  const go = (index: number) => {
    const root = section.current;
    if (!root) return;
    if (index > 3) {
      document.getElementById('location')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
      return;
    }
    const clamped = Math.min(3, Math.max(0, index));
    const top = root.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + (root.offsetHeight - innerHeight) * (clamped + .18) / 4,
      behavior: reduced ? 'instant' : 'smooth' });
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.engine-chapter')];
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const current = focused >= 0 ? focused : active;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : Math.max(0, Math.min(3, current + (event.key === 'ArrowRight' ? 1 : -1)));
    go(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('.engine-chapter')[next]?.focus({ preventScroll: true });
  };

  return <section ref={section} className="engine-tour" id="difference" aria-label="Look under the hood: four engine views">
    <div className="engine-tour-stage">
      <div className="engine-tour-topline mono"><span>LOOK UNDER THE HOOD</span><span>0{active + 1} / 04</span></div>
      <h2 className="engine-tour-title" aria-live="polite">{chapter.headline}</h2>
      <div className="engine-tour-body">
        <article className="engine-tour-copy" aria-label={chapter.short}>
          <div ref={copy} className="engine-copy-inner">
            <p className="engine-part mono">0{active + 1} / {chapter.part}</p>
            <h3>{chapter.title[0]}<br />{chapter.title[1]}</h3>
            <p className="engine-story">{chapter.text}</p>
            <button className="engine-tour-cta" onClick={onBook}>{chapter.cta}<ArrowUpRight size={19} /></button>
          </div>
        </article>
        <div className="engine-visual-stage" aria-label="Scroll to turn the engine">
          <div className="engine-studio-light" aria-hidden="true" />
          <div className="engine-stage-canvas">{visible && <Suspense fallback={<div className="loading-model mono">LOADING THE ENGINE…</div>}>
            <Scene kind="engine" reduced={reduced} />
          </Suspense>}</div>
          <div className="engine-focus-label mono"><span />{chapter.focus}</div>
          <div className="engine-stage-ruler" aria-hidden="true"><span ref={rail} /></div>
        </div>
      </div>
      <div className="engine-tour-footer">
        <nav className="engine-chapters" aria-label="Engine tour chapters" onKeyDown={keyboard}>
          {TOUR_CHAPTERS.map((item, i) => <button key={item.short} className={'engine-chapter ' + (active === i ? 'is-active' : '')}
            aria-current={active === i ? 'step' : undefined} aria-label={`View ${i + 1}: ${item.short}`} onClick={() => go(i)}>
            <span className="engine-chapter-number">0{i + 1}</span><span>{item.short}</span>
            <span className="engine-chapter-track" aria-hidden="true"><span ref={el => { bars.current[i] = el; }} /></span>
          </button>)}
        </nav>
        <div className="engine-step-controls">
          <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous engine view"><ArrowLeft size={19} /></button>
          <button onClick={() => go(active + 1)} aria-label={active === 3 ? 'Continue to shop location' : 'Next engine view'}><ArrowRight size={19} /></button>
        </div>
      </div>
      <p className="engine-scroll-note mono">SCROLL TO TURN THE ENGINE</p>
    </div>
  </section>;
}
