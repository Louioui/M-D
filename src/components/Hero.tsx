import { Fragment, Suspense, lazy, useState, type RefObject } from 'react';
import { ArrowDown, ArrowUpRight, MapPin, MoveUpRight } from 'lucide-react';
import { motion } from '../motion';
import { useLanguage } from '../i18n';
import { SHOP } from '../shop.ts';
import ShopStatus from './ShopStatus';
import LanguageToggle from './LanguageToggle';
import { BadgeFallback } from './BadgeFallback';

const BadgeStage = lazy(() => import('./BadgeStage'));

interface HeroProps {
  reduced: boolean;
  onBook: () => void;
  logo: RefObject<HTMLDivElement | null>;
  logoSlot: RefObject<HTMLDivElement | null>;
  back: RefObject<HTMLDivElement | null>;
  front: RefObject<HTMLDivElement | null>;
}

/** Stage 1 — vault & ignition: forged badge dead-centre, tilt on pointer/gyro. */
export default function Hero({ reduced, onBook, logo, logoSlot, back, front }: HeroProps) {
  const { copy } = useLanguage();
  const [gyro, setGyro] = useState(false);
  async function enableGyro() {
    try {
      const api = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      motion.gyroAllowed = api.requestPermission ? (await api.requestPermission()) === 'granted' : true;
    } catch { motion.gyroAllowed = false; }
    setGyro(motion.gyroAllowed);
  }
  return <section id="home" className="hero">
    {/* Background plane (z-0, 0.25×): garage plate, carbon grid, spotlight, watermark. */}
    <div className="hero-back" ref={back} aria-hidden="true">
      <div className="garage-background" />
      <div className="hero-grid" />
      <div className="hero-spot" />
      <span className="hero-watermark">{copy.hero.watermark}</span>
    </div>
    <div className="hero-content">
      <p className="hero-kicker mono">{copy.hero.kicker}</p>
      <h1 className="hero-title">{copy.hero.title.map((line, i) => <Fragment key={i}>{i > 0 && ' '}<span>{line}</span></Fragment>)}</h1>
      {/* Midground WebGL plane (z-10, 1×). */}
      <div className="hero-logo-slot" ref={logoSlot}>
        <div className="hero-logo" ref={logo}>
          <Suspense fallback={<BadgeFallback />}><BadgeStage reduced={reduced} /></Suspense>
        </div>
      </div>
      {/* Foreground HUD plane (z-20, 1.35×). */}
      <div className="hero-front" ref={front}>
        <div className="hero-bottom">
          <div className="hero-intro">
            <p className="mono">{copy.hero.intro.map((line, i) => <span key={i}>{line}</span>)}</p>
            <button className="button primary hero-cta" onClick={onBook}>{copy.hero.cta} <ArrowUpRight size={19} /></button>
          </div>
          <a href="#location" className="hero-location"><MapPin size={22} /><span className="mono">{SHOP.street.toUpperCase()}<br /><span>LOS ANGELES, CA {SHOP.postalCode}</span></span></a>
        </div>
        <div className="hero-baseline">
          <ShopStatus />
          <LanguageToggle className="hero-lang" />
          <a className="scroll-invite mono" href="#services">{copy.hero.scroll} <ArrowDown size={14} /></a>
          {typeof DeviceOrientationEvent !== 'undefined' && !reduced &&
            <button className="tilt-button mono" onClick={enableGyro}>{gyro ? copy.hero.tiltOn : copy.hero.tiltOff} <MoveUpRight size={12} /></button>}
        </div>
      </div>
    </div>
  </section>;
}
