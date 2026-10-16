import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useLanguage } from '../i18n';
import { CAR_PALETTE, DAVID_PALETTE, SPRITES } from './pixelSprites';

// Pixel David cruising a silver Mercedes-Benz roadster back and forth inside the
// booking section. One rAF loop writes transforms only; it runs while the strip
// is on screen and the tab is visible, and never under reduced motion.

/** Row run-length encoding keeps each sprite to a few dozen <rect>s. */
function pixels(rows: readonly string[], palette: Record<string, string>, key: string) {
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (c !== '.') rects.push(<rect key={`${key}${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={palette[c]} />);
      x = end;
    }
  });
  return rects;
}

const CYCLE = 12000; // ms: drive right, chat, drive left, chat
const DRIVE = 4200; // ms per crossing
const HALF = CYCLE / 2;
const HEAD_X = 10, HEAD_Y = -9;
const ease = (t: number) => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export default function PixelDrive({ reduced }: { reduced: boolean }) {
  const { copy } = useLanguage();
  const road = useRef<HTMLDivElement>(null), run = useRef<HTMLDivElement>(null), flip = useRef<HTMLDivElement>(null);
  const head = useRef<SVGGElement>(null), wheelA = useRef<SVGGElement>(null), wheelB = useRef<SVGGElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const art = useMemo(() => ({
    car: pixels(SPRITES.CAR, CAR_PALETTE, 'c'),
    wheelA: pixels(SPRITES.WHEELS_A, CAR_PALETTE, 'a'),
    wheelB: pixels(SPRITES.WHEELS_B, CAR_PALETTE, 'b'),
    david: pixels(SPRITES.DAVID, DAVID_PALETTE, 'd'),
  }), []);

  useEffect(() => {
    const track = road.current, runner = run.current, flipper = flip.current;
    if (!track || !runner || !flipper) return;
    let span = 0, frame = 0, visible = false, started = performance.now();
    let lastFacing = 0, lastWheel = -1, lastBubble = '';
    const measure = () => { span = Math.max(0, track.clientWidth - runner.offsetWidth); };
    const show = (state: string) => {
      if (state === lastBubble || !bubble.current) return;
      lastBubble = state;
      bubble.current.className = 'pixel-bubble' + (state ? ` is-visible is-${state}` : '');
    };
    const place = (x: number, facing: 1 | -1, pop: number, wheel: number, bob: number) => {
      runner.style.transform = `translate3d(${x.toFixed(1)}px, ${bob}px, 0)`;
      if (facing !== lastFacing) { flipper.style.transform = `scaleX(${facing})`; lastFacing = facing; }
      head.current?.setAttribute('transform', `translate(${HEAD_X} ${HEAD_Y - pop})`);
      if (wheel !== lastWheel) {
        wheelA.current?.setAttribute('visibility', wheel ? 'hidden' : 'visible');
        wheelB.current?.setAttribute('visibility', wheel ? 'visible' : 'hidden');
        lastWheel = wheel;
      }
    };

    if (reduced) {
      // Parked mid-road, popped up and saying hello.
      measure();
      place(span / 2, 1, 2, 0, 0);
      show('center');
      const observer = new ResizeObserver(() => { measure(); place(span / 2, 1, 2, 0, 0); });
      observer.observe(track);
      return () => observer.disconnect();
    }

    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      const t = (now - started) % CYCLE, local = t % HALF, outbound = t < HALF;
      let x: number, pop = 0, bob = 0, bubbleState = '';
      if (local < DRIVE) {
        const p = ease(local / DRIVE);
        x = (outbound ? p : 1 - p) * span;
        bob = Math.floor(local / 140) % 2 ? -1 : 0; // little engine rumble
      } else {
        x = outbound ? span : 0;
        const parked = local - DRIVE;
        pop = parked < 120 ? 1 : parked < HALF - DRIVE - 200 ? 2 : 0;
        if (parked > 150 && parked < HALF - DRIVE - 250) bubbleState = outbound ? 'end' : 'start';
      }
      place(x, outbound ? 1 : -1, pop, Math.floor(x / 7) % 2, bob);
      show(bubbleState);
      frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); };
    const resize = new ResizeObserver(measure);
    resize.observe(track);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); });
    io.observe(track);
    document.addEventListener('visibilitychange', wake);
    measure();
    started = performance.now();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', wake);
    };
  }, [reduced]);

  return <div className="pixel-drive" role="img" aria-label={copy.booking.pixelLabel}>
    <div ref={road} className="pixel-road">
      <div ref={run} className="pixel-run">
        <div ref={bubble} className="pixel-bubble" aria-hidden="true">{copy.booking.pixelBubble}</div>
        <div ref={flip} className="pixel-flip">
          <svg className="pixel-car" viewBox="0 -12 40 28" shapeRendering="crispEdges" aria-hidden="true">
            <g ref={head} transform={`translate(${HEAD_X} ${HEAD_Y})`}>{art.david}</g>
            <rect x={4} y={15} width={32} height={1} fill="#000" opacity={.35} />
            <g>{art.car}</g>
            <g ref={wheelA}>{art.wheelA}</g>
            <g ref={wheelB} visibility="hidden">{art.wheelB}</g>
          </svg>
        </div>
      </div>
      <span className="pixel-lane" aria-hidden="true" />
    </div>
  </div>;
}
