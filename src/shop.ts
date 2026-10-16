// Single source of truth for verified business details, hours and handoff links.
export type Lang = 'en' | 'es';

export const SHOP = {
  name: 'M&D Multi-Service',
  legalName: 'M&D Auto Mechanic Service',
  owners: 'David & Edith',
  phone: '+13233544795',
  phoneDisplay: '(323) 354-4795',
  email: 'md_multiservice@yahoo.com',
  street: '419 N Boyle Ave',
  city: 'Los Angeles',
  region: 'CA',
  postalCode: '90033',
  neighborhood: 'Boyle Heights',
  timezone: 'America/Los_Angeles',
  rating: 4.6,
  reviewCount: '90+',
} as const;

export const SHOP_ADDRESS = `${SHOP.street}, ${SHOP.city}, ${SHOP.region} ${SHOP.postalCode}`;
export const DIRECTIONS_URL = 'https://www.google.com/maps/dir/?api=1&destination=419+N+Boyle+Ave+Los+Angeles+CA+90033';
export const REVIEWS_URL = 'https://www.google.com/maps/search/?api=1&query=M%26D+Multi-Service+419+N+Boyle+Ave+Los+Angeles+CA+90033';
export const MAP_EMBED_URL = 'https://maps.google.com/maps?q=419%20N%20Boyle%20Ave%20Los%20Angeles%20CA%2090033&t=&z=15&ie=UTF8&iwloc=&output=embed';

/** Opening minutes after local midnight, Sunday first. `null` is closed. */
export const HOURS: readonly (readonly [open: number, close: number] | null)[] = [
  null, [510, 1080], [510, 1080], [510, 1080], [510, 1080], [510, 1080], [480, 960],
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface ShopStatus {
  open: boolean;
  /** Minutes after midnight when the shop closes today (open only). */
  closesAt?: number;
  /** Next opening: weekday index (0 = Sunday) and minutes after midnight (closed only). */
  opensAt?: { day: number; minute: number; today: boolean };
}

/** Los Angeles wall-clock time, including daylight saving, independent of the visitor's zone. */
export function shopStatus(date = new Date()): ShopStatus {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
  const day = WEEKDAYS.indexOf(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const today = HOURS[day];
  if (today && minutes >= today[0] && minutes < today[1]) return { open: true, closesAt: today[1] };
  if (today && minutes < today[0]) return { open: false, opensAt: { day, minute: today[0], today: true } };
  for (let offset = 1; offset <= 7; offset++) {
    const next = (day + offset) % 7, hours = HOURS[next];
    if (hours) return { open: false, opensAt: { day: next, minute: hours[0], today: false } };
  }
  return { open: false };
}

export function formatMinutes(minutes: number, lang: Lang) {
  const hour = Math.floor(minutes / 60), minute = minutes % 60;
  const display = `${hour % 12 || 12}${minute ? ':' + String(minute).padStart(2, '0') : ''}`;
  return lang === 'es' ? `${display} ${hour < 12 ? 'a.m.' : 'p.m.'}` : `${display} ${hour < 12 ? 'AM' : 'PM'}`;
}

export interface BookingFields {
  name: string;
  year: string;
  make: string;
  model: string;
  /** Human-readable service label in the visitor's language. */
  service: string;
  message: string;
}

export function bookingMessage(fields: BookingFields, lang: Lang = 'en') {
  const vehicle = `${fields.year} ${fields.make} ${fields.model}`.trim();
  const detail = fields.message.trim() ? `\n\n${fields.message.trim()}` : '';
  return lang === 'es'
    ? `¡Hola David y Edith! Soy ${fields.name}. Quisiera solicitar ${fields.service} para mi ${vehicle}.${detail}\n\n¿Me pueden decir cuándo tienen disponibilidad? ¡Gracias!`
    : `Hi David & Edith! I'm ${fields.name}. I'd like to request ${fields.service} for my ${vehicle}.${detail}\n\nPlease let me know your availability. Thank you!`;
}

export function bookingLink(channel: 'sms' | 'email', fields: BookingFields, lang: Lang = 'en') {
  const body = encodeURIComponent(bookingMessage(fields, lang));
  if (channel === 'sms') return `sms:${SHOP.phone}?body=${body}`;
  const subject = (lang === 'es' ? 'Solicitud de servicio — ' : 'Service request — ') + `${fields.year} ${fields.make} ${fields.model}`;
  return `mailto:${SHOP.email}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

/** vCard 3.0 values escape backslash, comma and semicolon; lines end in CRLF. */
const vcardEscape = (value: string) => value.replace(/[\\,;]/g, match => '\\' + match);

export function shopVCard() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:;${vcardEscape(SHOP.owners)};;;`,
    `FN:${vcardEscape(`${SHOP.owners} — ${SHOP.name}`)}`,
    `ORG:${vcardEscape(SHOP.name)}`,
    `TEL;TYPE=WORK,VOICE,TEXT:${SHOP.phone}`,
    `EMAIL;TYPE=INTERNET:${SHOP.email}`,
    `ADR;TYPE=WORK:;;${vcardEscape(SHOP.street)};${SHOP.city};${SHOP.region};${SHOP.postalCode};USA`,
    `NOTE:${vcardEscape('Mon–Fri 8:30 AM–6:00 PM. Sat 8:00 AM–4:00 PM. Sun closed.')}`,
    'END:VCARD',
    '',
  ].join('\r\n');
}

export const VCARD_HREF = 'data:text/vcard;charset=utf-8,' + encodeURIComponent(shopVCard());
