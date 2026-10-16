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

test('the four tour hooks match the brief, and Spanish is translated', () => {
  assert.deepEqual(COPY.en.tour.chapters.map(c => c.hook.join(' ')), [
    'No Guessing. Master-Level Diagnostics.',
    'All Makes. All Models. Zero Shortcuts.',
    'Real Hard Work. No Dealership Rip-Offs.',
    'Built on Family & Word-of-Mouth (4.6★ on Google).',
  ]);
  for (const [i, chapter] of COPY.es.tour.chapters.entries()) assert.notEqual(chapter.text, COPY.en.tour.chapters[i].text);
  for (const key of SERVICE_KEYS) assert.ok(COPY.es.services.items[key].label && COPY.en.services.items[key].label);
});
