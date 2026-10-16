import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncResourceCache } from './lib/asyncResource.ts';

test('Suspense reads share one download even after failure instead of flooding retries', async () => {
  const cache = createAsyncResourceCache();
  let downloads = 0;
  const failure = new Error('Network interrupted');
  const download = async () => { downloads++; throw failure; };
  const resource = cache('engine', download);
  assert.equal(cache('engine', download), resource);
  await assert.rejects(resource, error => error === failure);
  for (let read = 0; read < 100; read++) assert.equal(cache('engine', download), resource);
  await Promise.resolve();
  assert.equal(downloads, 1);
  const freshPage = createAsyncResourceCache();
  await assert.rejects(freshPage('engine', download), error => error === failure);
  assert.equal(downloads, 2, 'A fresh page may retry');
});

test('successful resources stay stable and different assets load independently', async () => {
  const cache = createAsyncResourceCache();
  const logo = cache('logo', async () => 'badge');
  assert.equal(await logo, 'badge');
  assert.equal(cache('logo', async () => 'duplicate'), logo);
  assert.equal(await cache('engine', async () => 'motor'), 'motor');
});
