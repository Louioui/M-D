/**
 * React's use(promise) must observe the same promise after it rejects. Evicting
 * on rejection makes each Suspense retry issue another request forever. Keep
 * both successful and failed results for this page lifetime; reload retries.
 */
export function createAsyncResourceCache<Key, Value>() {
  const resources = new Map<Key, Promise<Value>>();
  return (key: Key, load: () => Promise<Value>): Promise<Value> => {
    let resource = resources.get(key);
    if (!resource) {
      resource = Promise.resolve().then(load);
      resources.set(key, resource);
    }
    return resource;
  };
}
