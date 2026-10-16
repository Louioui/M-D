import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_PALETTE, DAVID_PALETTE, SPRITES } from './components/pixelSprites.ts';

test('pixel sprites are rectangular and every pixel has a palette colour', () => {
  for (const [name, rows, palette] of [['car', SPRITES.CAR, CAR_PALETTE], ['wheels A', SPRITES.WHEELS_A, CAR_PALETTE],
    ['wheels B', SPRITES.WHEELS_B, CAR_PALETTE], ['David', SPRITES.DAVID, DAVID_PALETTE]]) {
    assert.ok(rows.every(row => row.length === rows[0].length), `${name} rows share one width`);
    for (const c of rows.join('')) assert.ok(c === '.' || c in palette, `${name} uses unknown pixel "${c}"`);
  }
  assert.equal(SPRITES.CAR.length, SPRITES.WHEELS_A.length);
  assert.notDeepEqual(SPRITES.WHEELS_A, SPRITES.WHEELS_B, 'two wheel frames make the spokes turn');
});
