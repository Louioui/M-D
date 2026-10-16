import test from 'node:test';
import assert from 'node:assert/strict';
import { COPY, SERVICE_KEYS } from './copy.ts';

/** Every string path in English must exist in Spanish with the same shape. */
function shape(value, path = '') {
  if (typeof value === 'function') return [`${path}()`];
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((item, i) => shape(item, `${path}[${i}]`))];
  if (value && typeof value === 'object') return Object.keys(value).sort().flatMap(key => shape(value[key], `${path}.${key}`));
  return [path];
}

test('Spanish copy mirrors the English structure', () => {
  assert.deepEqual(shape(COPY.es), shape(COPY.en));
});

test('tour stops speak to the customer’s situation and book the matching service', () => {
  assert.deepEqual(COPY.en.tour.chapters.map(c => c.hook[0]), [
    'Check-engine light on?', 'Need your car for work?', 'Worried about the bill?', 'Done with dealerships?',
  ]);
  for (const lang of ['en', 'es']) {
    for (const chapter of COPY[lang].tour.chapters) assert.ok(SERVICE_KEYS.includes(chapter.service), `${lang}: ${chapter.short}`);
    assert.ok(COPY[lang].tour.chapters[3].text.includes('4.6★'), 'rating stays on the trust stop');
  }
  assert.deepEqual(COPY.es.tour.chapters.map(c => c.service), COPY.en.tour.chapters.map(c => c.service));
  for (const [i, chapter] of COPY.es.tour.chapters.entries()) assert.notEqual(chapter.text, COPY.en.tour.chapters[i].text);
  for (const key of SERVICE_KEYS) assert.ok(COPY.es.services.items[key].label && COPY.en.services.items[key].label);
});
