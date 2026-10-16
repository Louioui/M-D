import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../i18n';
import { SERVICE_KEYS, type ServiceKey } from '../copy.ts';

/** Click-to-select service filter. The choice carries straight into the booking terminal. */
export default function ServicesSection({ service, onSelect, onBook }: { service: ServiceKey; onSelect: (key: ServiceKey) => void; onBook: (key: ServiceKey) => void }) {
  const { copy } = useLanguage();
  const items = copy.services.items;
  return <section id="services" className="services-section">
    <div className="section-topline mono"><span>{copy.services.topline[0]}</span><span>{copy.services.topline[1]}</span></div>
    <div className="services-layout">
      <div>
        <h2>{copy.services.title[0]}<br /><span className="muted">{copy.services.title[1]}</span></h2>
        <p>{copy.services.text}</p>
      </div>
      <div className="service-picker">
        <p className="section-label" id="service-pick-label">{copy.services.pick}</p>
        <div className="service-pills" role="group" aria-labelledby="service-pick-label">
          {SERVICE_KEYS.map((key, i) => <button key={key} type="button" className={'service-pill' + (service === key ? ' is-active' : '')}
            aria-pressed={service === key} aria-controls="service-detail" onClick={() => onSelect(key)}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>{items[key].label}
          </button>)}
        </div>
        <div className="service-detail" id="service-detail" aria-live="polite">
          <h3>{items[service].label}</h3>
          <p>{items[service].text}</p>
          <button className="button primary" onClick={() => onBook(service)}>{copy.services.request} <ArrowUpRight size={17} /></button>
        </div>
      </div>
    </div>
  </section>;
}
