import test from 'node:test';
import assert from 'node:assert/strict';
import { publish, subscribeProgress, progressSnapshot } from './lib/loadProgress.ts';

test('loading a Suspense resource defers and coalesces subscriber notifications', async () => {
  let calls=0;
  const unsubscribe=subscribeProgress(()=>calls++);
  publish({stage:'download',engineBytes:.1});publish({engineBytes:.2});
  assert.equal(calls,0,'Loading must not update another React component during render');
  await Promise.resolve();
  assert.equal(calls,1);assert.equal(progressSnapshot().engineBytes,.2);
  unsubscribe();
});
