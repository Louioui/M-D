import { useEffect, useState } from 'react';
import { formatMinutes, shopStatus } from '../shop.ts';
import { useLanguage } from '../i18n';

/** Live America/Los_Angeles open/closed indicator; re-evaluated every 30 s. */
export default function ShopStatus() {
  const { lang, copy } = useLanguage();
  const [status, setStatus] = useState(() => shopStatus());
  useEffect(() => { const timer = setInterval(() => setStatus(shopStatus()), 30000); return () => clearInterval(timer); }, []);
  const detail = status.open && status.closesAt !== undefined
    ? copy.status.until(formatMinutes(status.closesAt, lang))
    : status.opensAt ? copy.status.opens(copy.status.days[status.opensAt.day], formatMinutes(status.opensAt.minute, lang), status.opensAt.today) : '';
  return <span className="shop-status mono" role="status">
    <i className={status.open ? 'open' : ''} aria-hidden="true" />{status.open ? copy.status.open : copy.status.closed}
    {detail && <span className="status-detail"> · {detail}</span>}
  </span>;
}
