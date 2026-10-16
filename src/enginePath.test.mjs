import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { sampleEnginePath, chapterAt } from './enginePath.ts';

test('guided engine path is continuous, stays outside the model, and changes inspection angles', () => {
  const point = new Vector3(), target = new Vector3(), previous = new Vector3();
  let minAngle = Infinity, maxAngle = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    sampleEnginePath(i / 1000, point, target);
    assert.ok(point.length() > 3.3, 'Camera must stay outside the engine');
    assert.ok([...point, ...target].every(Number.isFinite));
    if (i) assert.ok(previous.distanceTo(point) < .05, 'Camera path cannot jump');
    const angle = Math.atan2(point.x, point.z);
    minAngle = Math.min(minAngle, angle); maxAngle = Math.max(maxAngle, angle);
    previous.copy(point);
  }
  assert.ok(maxAngle - minAngle > 1.5, 'Tour must inspect both sides of the front assembly');
  sampleEnginePath(0, point, target); const high = point.y;
  sampleEnginePath(.875, point, target);
  assert.ok(high - point.y > 1.5, 'Tour must descend from cover to lower block');
});
test('chapter endpoints and mobile camera remain valid', () => {
  assert.deepEqual([0,.249,.25,.5,.75,1].map(chapterAt),[0,0,1,2,3,3]);
  const point = new Vector3(), target = new Vector3();
  for (const p of [0,.25,.5,.75,1]) {sampleEnginePath(p,point,target,true);assert.ok(point.length()>2.8);}
});
