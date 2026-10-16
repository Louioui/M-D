import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { ArrowUpRight, Instagram } from 'lucide-react';
import { motion, useMotionPreference } from './motion';
import { useLanguage } from './i18n';
import { type ServiceKey } from './copy.ts';
import { INSTAGRAM_URL } from './shop.ts';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ServicesSection from './components/ServicesSection';
import EngineShowcase from './components/EngineShowcase';
import ProofLocation from './components/ProofLocation';
import BookingTerminal from './components/BookingTerminal';

gsap.registerPlugin(ScrollTrigger, Flip);
gsap.ticker.lagSmoothing(0);
gsap.ticker.fps(60);
// Collapsing mobile address bars must not re-run pin math mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

export default function App() {
  const { copy } = useLanguage();
  const reduced = useMotionPreference();
  const [service, setService] = useState<ServiceKey>('diagnostics');
  const logo = useRef<HTMLDivElement>(null), heroSlot = useRef<HTMLDivElement>(null), navSlot = useRef<HTMLSpanElement>(null);
  const heroBack = useRef<HTMLDivElement>(null), heroFront = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const openBooking = (key?: ServiceKey) => {
    if (key) setService(key);
    document.getElementById('book')?.scrollIntoView({ behavior: motion.reduced ? 'instant' : 'smooth', block: 'start' });
    firstField.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    let frame = 0, resizeFrame = 0, lastY = window.scrollY, lastTime = performance.now(), docked = false, alive = true;
    let heroHeight = window.innerHeight, scrollRange = 1;
    const coarse = matchMedia('(pointer: coarse)');
    const measure = () => {
      // Layout reads happen here (resize), never inside the per-frame scroll path.
      heroHeight = heroBack.current?.parentElement?.offsetHeight ?? window.innerHeight;
      scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      motion.mobile = window.innerWidth < 768;
      motion.coarse = coarse.matches;
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      motion.pointerX = event.clientX / window.innerWidth * 2 - 1;
      motion.pointerY = event.clientY / window.innerHeight * 2 - 1;
      motion.clientX = event.clientX; motion.clientY = event.clientY;
    };
    const orient = (event: DeviceOrientationEvent) => {
      if (!motion.gyroAllowed || motion.reduced) return;
      motion.pointerX = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 35));
      motion.pointerY = Math.max(-1, Math.min(1, ((event.beta ?? 45) - 45) / 45));
    };
    function dock(next: boolean) {
      const badge = logo.current;
      if (next === docked || !badge) return;
      docked = next;
      motion.docked = next;
      const state = Flip.getState(badge);
      (next ? navSlot : heroSlot).current?.appendChild(badge);
      badge.classList.toggle('docked', next);
      Flip.from(state, {
        duration: motion.reduced ? 0 : .85, ease: 'power3.inOut', scale: true, absolute: true, prune: true,
        onComplete: () => { if (logo.current) gsap.set(logo.current, { clearProps: 'all' }); },
      });
    }
    const update = () => {
      frame = 0;
      if (!alive) return;
      const now = performance.now(), y = window.scrollY;
      motion.velocity = (y - lastY) / Math.max(16, now - lastTime) * 1000;
      motion.scroll = y / scrollRange;
      lastY = y; lastTime = now;
      // Hero parallax planes: background 0.25×, foreground HUD 1.35× (compositor transforms only).
      if (y <= heroHeight * 1.1) {
        const depth = motion.reduced ? 0 : y;
        if (heroBack.current) heroBack.current.style.transform = `translate3d(0, ${(depth * .75).toFixed(1)}px, 0)`;
        if (heroFront.current) heroFront.current.style.transform = `translate3d(0, ${(depth * -.35).toFixed(1)}px, 0)`;
      }
      dock(motion.scroll >= .15);
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = () => {
      if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; measure(); ScrollTrigger.refresh(); scroll(); });
    };
    measure();
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('deviceorientation', orient, { passive: true });
    coarse.addEventListener('change', measure);
    // Fonts and lazy sections change document height after first paint.
    const heightWatch = new ResizeObserver(() => { scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); });
    heightWatch.observe(document.body);
    return () => {
      alive = false;
      cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('deviceorientation', orient);
      coarse.removeEventListener('change', measure);
      heightWatch.disconnect();
      if (logo.current && heroSlot.current) heroSlot.current.appendChild(logo.current);
    };
  }, []);

  useEffect(() => {
    if (!reduced) return;
    motion.pointerX = motion.pointerY = 0;
    heroBack.current?.style.removeProperty('transform');
    heroFront.current?.style.removeProperty('transform');
  }, [reduced]);

  return <>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <Navbar ref={navSlot} onBook={() => openBooking()} />
    <main id="main">
      <Hero reduced={reduced} onBook={() => openBooking()} logo={logo} logoSlot={heroSlot} back={heroBack} front={heroFront} />
      <ServicesSection service={service} onSelect={setService} onBook={openBooking} />
      <EngineShowcase reduced={reduced} onBook={openBooking} />
      <ProofLocation />
      <BookingTerminal ref={firstField} service={service} onService={setService} reduced={reduced} />
    </main>
    <footer>
      <a className="brand" href="#home">M&D <span className="brand-small">MULTI-SERVICE</span></a>
      <span className="mono">{copy.footer.tagline}</span>
      <span className="mono footer-name">{copy.hero.name}</span>
      <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="footer-email footer-instagram"><Instagram size={16} />{copy.footer.instagram}</a>
      <a href="mailto:md_multiservice@yahoo.com" className="footer-email">{copy.footer.email} <ArrowUpRight size={14} /></a>
      <span className="mono copyright">© {new Date().getFullYear()} M&D MULTI-SERVICE · 419 N BOYLE AVE, LOS ANGELES, CA 90033 · (323) 354-4795</span>
    </footer>
  </>;
}
