import { forwardRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useLanguage } from '../i18n';
import LanguageToggle from './LanguageToggle';

/** Sticky navigation. The live 3D badge Flip-docks into `logoSlot` past 15% scroll. */
const Navbar = forwardRef<HTMLSpanElement, { onBook: () => void }>(function Navbar({ onBook }, logoSlot) {
  const { copy } = useLanguage();
  const [menu, setMenu] = useState(false);
  const close = () => setMenu(false);
  return <header className="site-header">
    <a className="brand" href="#home" aria-label={copy.nav.home}><span className="nav-logo-slot" ref={logoSlot} /><span>M&D <span className="brand-small">MULTI-SERVICE</span></span></a>
    <nav aria-label={copy.nav.main} className={menu ? 'nav-links mobile-open' : 'nav-links'}>
      <a href="#services" onClick={close}>{copy.nav.services}</a>
      <a href="#difference" onClick={close}>{copy.nav.tour}</a>
      <a href="#location" onClick={close}>{copy.nav.location}</a>
    </nav>
    <div className="header-actions">
      <LanguageToggle />
      <button className="button primary header-book" onClick={() => { close(); onBook(); }}>{copy.nav.book} <ArrowUpRight size={17} /></button>
      <button className="menu-toggle icon-button" aria-label={menu ? copy.nav.menuClose : copy.nav.menuOpen} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
    </div>
  </header>;
});
export default Navbar;
