import test from 'node:test';
import assert from 'node:assert/strict';
import { shopStatus, bookingLink, bookingMessage, formatMinutes, shopVCard, SHOP, HOURS } from './shop.ts';

test('Los Angeles weekday boundaries and daylight saving', () => {
  assert.equal(shopStatus(new Date('2026-10-16T15:29:00Z')).open, false);
  assert.equal(shopStatus(new Date('2026-10-16T15:30:00Z')).open, true);
  assert.equal(shopStatus(new Date('2026-10-17T01:00:00Z')).open, false);
  assert.equal(shopStatus(new Date('2026-12-04T16:30:00Z')).open, true);
});

test('Saturday and Sunday schedule', () => {
  assert.equal(shopStatus(new Date('2026-10-17T15:00:00Z')).open, true);
  assert.equal(shopStatus(new Date('2026-10-17T23:00:00Z')).open, false);
  assert.equal(shopStatus(new Date('2026-10-18T18:00:00Z')).open, false);
});

test('status reports closing time and the next opening', () => {
  assert.deepEqual(shopStatus(new Date('2026-10-16T20:00:00Z')), { open: true, closesAt: 1080 }); // Fri 1 PM PDT
  // Saturday 5 PM PDT → Monday 8:30.
  assert.deepEqual(shopStatus(new Date('2026-10-18T00:00:00Z')).opensAt, { day: 1, minute: 510, today: false });
  // Friday 7 AM PDT → today 8:30.
  assert.deepEqual(shopStatus(new Date('2026-10-16T14:00:00Z')).opensAt, { day: 5, minute: 510, today: true });
  assert.equal(HOURS[0], null, 'Sunday closed');
  assert.equal(formatMinutes(510, 'en'), '8:30 AM');
  assert.equal(formatMinutes(1080, 'es'), '6 p.m.');
});

test('booking handoff encodes customer supplied vehicle and message', () => {
  const f = { name: 'A & B', service: 'Diagnostics', year: '2020', make: 'Toyota', model: 'RAV4', message: 'Noise & vibration?' };
  for (const c of ['sms', 'email']) {
    const l = bookingLink(c, f);
    assert.ok(decodeURIComponent(l).includes('Noise & vibration?'));
    assert.ok(l.includes('body='));
  }
  assert.ok(bookingLink('sms', f).startsWith('sms:+13233544795?'));
  assert.ok(bookingLink('email', f).startsWith('mailto:md_multiservice@yahoo.com?subject='));
  assert.match(bookingMessage(f, 'es'), /^¡Hola David y Edith! Soy A & B\. Quisiera solicitar Diagnostics para mi 2020 Toyota RAV4\./);
});

test('vCard carries the verified contact details with CRLF lines', () => {
  const card = shopVCard();
  assert.ok(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
  assert.ok(card.endsWith('END:VCARD\r\n'));
  assert.ok(card.includes('TEL;TYPE=WORK,VOICE,TEXT:+13233544795'));
  assert.ok(card.includes('EMAIL;TYPE=INTERNET:md_multiservice@yahoo.com'));
  assert.ok(card.includes('ADR;TYPE=WORK:;;419 N Boyle Ave;Los Angeles;CA;90033;USA'));
  assert.equal(SHOP.phoneDisplay, '(323) 354-4795');
  assert.ok(!/[^\r]\n/.test(card), 'Every line break is CRLF');
});
