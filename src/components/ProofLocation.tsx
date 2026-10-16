import { ArrowUpRight, Clock, MapPin, Navigation, Phone, Star } from 'lucide-react';
import { useLanguage } from '../i18n';
import { DIRECTIONS_URL, MAP_EMBED_URL, REVIEWS_URL, SHOP } from '../shop.ts';
import ShopStatus from './ShopStatus';

/** Stage 4 — social proof and the Boyle Heights route card. */
export default function ProofLocation() {
  const { copy } = useLanguage();
  const proof = copy.proof;
  return <section id="location" className="location-section">
    <div className="section-topline mono"><span>{proof.topline[0]}</span><ShopStatus /></div>
    <div className="location-layout">
      <div className="location-copy">
        <h2>{proof.title[0]}<br />{proof.title[1]}</h2>
        <p>{proof.text}</p>
        <a className="rating-card" href={REVIEWS_URL} target="_blank" rel="noreferrer">
          <span className="rating-score">{SHOP.rating.toFixed(1)}</span>
          <span className="rating-meta">
            <span className="rating-stars" role="img" aria-label={`${SHOP.rating} / 5 — ${proof.ratingLabel}`}>
              <span className="rating-stars-base">{[0, 1, 2, 3, 4].map(i => <Star key={i} size={18} />)}</span>
              <span className="rating-stars-fill" style={{ width: `${SHOP.rating / 5 * 100}%` }}>{[0, 1, 2, 3, 4].map(i => <Star key={i} size={18} fill="currentColor" />)}</span>
            </span>
            <span className="mono">{proof.reviews(SHOP.reviewCount)}</span>
            <span className="rating-link">{proof.readReviews} <ArrowUpRight size={14} /></span>
          </span>
        </a>
        <div className="route-card">
          <p className="mono route-label">{proof.route}</p>
          <address><MapPin size={22} /><span>{SHOP.street}<br />{SHOP.city}, {SHOP.region} {SHOP.postalCode}</span></address>
          <p className="route-text">{proof.routeText}</p>
          <div className="location-buttons">
            <a className="button primary" href={DIRECTIONS_URL} target="_blank" rel="noreferrer">{proof.directions} <Navigation size={17} /></a>
            <a className="button secondary" href={`tel:${SHOP.phone}`}><Phone size={16} />{SHOP.phoneDisplay}</a>
          </div>
        </div>
        <div className="hours"><Clock size={17} /><div><span className="mono">{proof.hoursTitle}</span>
          <dl>{proof.hours.map(([day, time]) => <div key={day}><dt>{day}</dt><dd>{time}</dd></div>)}</dl></div></div>
      </div>
      <div className="location-map">
        <iframe title={proof.mapTitle} src={MAP_EMBED_URL} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <a className="map-caption mono" href={DIRECTIONS_URL} target="_blank" rel="noreferrer"><MapPin size={14} /> {SHOP.street.toUpperCase()} · BOYLE HEIGHTS <ArrowUpRight size={15} /></a>
      </div>
    </div>
  </section>;
}
