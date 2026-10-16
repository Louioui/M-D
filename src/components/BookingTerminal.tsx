import { forwardRef, useEffect, useRef, useState, type MouseEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Contact, Mail, MessageSquare, Phone } from 'lucide-react';
import { useLanguage } from '../i18n';
import { SERVICE_KEYS, type ServiceKey } from '../copy.ts';
import PixelDrive from './PixelDrive';
import { SHOP, VCARD_HREF, bookingLink, bookingMessage, type BookingFields } from '../shop.ts';

gsap.registerPlugin(ScrollTrigger);

interface BookingTerminalProps { service: ServiceKey; onService: (key: ServiceKey) => void; reduced: boolean }

/** Stage 5 — slide-over vault conversion dock with one-tap SMS / email / vCard handoff. */
const BookingTerminal = forwardRef<HTMLInputElement, BookingTerminalProps>(function BookingTerminal({ service, onService, reduced }, firstField) {
  const { lang, copy } = useLanguage();
  const text = copy.booking;
  const dock = useRef<HTMLElement>(null), form = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState({ name: '', year: '', make: '', model: '', message: '' });
  const [invalid, setInvalid] = useState(false);
  const booking: BookingFields = { ...fields, service: copy.services.items[service].label };
  const set = (key: keyof typeof fields) => (value: string) => { setFields(current => ({ ...current, [key]: value })); setInvalid(false); };

  // The terminal slides up over the section above it; transform-only, scrubbed by scroll.
  useEffect(() => {
    if (reduced || !dock.current) return;
    const tween = gsap.fromTo(dock.current, { y: 140 }, {
      y: 0, ease: 'none', force3D: true,
      scrollTrigger: { trigger: dock.current, start: 'top bottom', end: 'top 55%', scrub: .4 },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced]);

  /** Handoff links work only once the essentials are filled in; otherwise show native validation. */
  const guard = (event: MouseEvent<HTMLAnchorElement>) => {
    if (form.current?.checkValidity()) return;
    event.preventDefault();
    setInvalid(true);
    form.current?.reportValidity();
  };

  return <section id="book" ref={dock} className="booking-dock" aria-labelledby="booking-title">
    <div className="booking-inner">
      <div className="section-topline mono"><span><span className="red">M&D</span> {text.topline[0]}</span><span>{text.topline[1]}</span></div>
      <div className="booking-layout">
        <div className="booking-intro">
          <h2 id="booking-title">{text.title[0]}<br /><span>{text.title[1]}</span></h2>
          <p>{text.text}</p>
          <a className="booking-call" href={`tel:${SHOP.phone}`}><Phone size={16} />{text.call} {SHOP.phoneDisplay}</a>
          <PixelDrive reduced={reduced} />
        </div>
        <form ref={form} className="booking-form" onSubmit={event => event.preventDefault()} noValidate={false}>
          <label>{text.name} <span className="sr-only">({text.required})</span>
            <input ref={firstField} autoComplete="name" required maxLength={80} value={fields.name} onChange={e => set('name')(e.target.value)} placeholder={text.namePlaceholder} />
          </label>
          <div className="vehicle-fields">
            <label>{text.year}<input inputMode="numeric" required pattern="(19|20)[0-9]{2}" maxLength={4} value={fields.year} onChange={e => set('year')(e.target.value)} placeholder="2018" /></label>
            <label>{text.make}<input required maxLength={60} value={fields.make} onChange={e => set('make')(e.target.value)} placeholder="Toyota" /></label>
            <label>{text.model}<input required maxLength={60} value={fields.model} onChange={e => set('model')(e.target.value)} placeholder="Camry" /></label>
          </div>
          <fieldset className="booking-services">
            <legend>{text.service}</legend>
            <div className="service-pills compact">
              {SERVICE_KEYS.map(key => <button key={key} type="button" className={'service-pill' + (service === key ? ' is-active' : '')}
                aria-pressed={service === key} onClick={() => onService(key)}>{copy.services.items[key].label}</button>)}
            </div>
          </fieldset>
          <label>{text.message}<textarea rows={3} maxLength={1500} value={fields.message} onChange={e => set('message')(e.target.value)} placeholder={text.messagePlaceholder} /></label>
          <div className="message-preview">
            <span className="mono">{text.preview}</span>
            <p>{bookingMessage(booking, lang)}</p>
          </div>
          {invalid && <p className="form-error" role="alert">{text.invalid}</p>}
          <div className="handoff-actions">
            <a className="button primary" href={bookingLink('sms', booking, lang)} onClick={guard}><MessageSquare size={17} />{text.sms}<ArrowUpRight size={16} /></a>
            <a className="button secondary" href={bookingLink('email', booking, lang)} onClick={guard}><Mail size={17} />{text.email}</a>
            <a className="button secondary" href={VCARD_HREF} download="MD-Multi-Service.vcf"><Contact size={17} />{text.vcard}</a>
          </div>
          <p className="form-note">{text.note}</p>
        </form>
      </div>
    </div>
  </section>;
});
export default BookingTerminal;
