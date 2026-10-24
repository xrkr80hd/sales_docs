// Short-lived, account-scoped UI data only. Never stores data on disk.
type Entry = { value: unknown; expiresAt: number };
const values = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const keyFor = (scope: string, resource: string) => `${scope}\u0000${resource}`;
export function cachedResource<T>(scope: string, resource: string): T | undefined {
  const key = keyFor(scope, resource), entry = values.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) { values.delete(key); return undefined; }
  return entry.value as T;
}
export function primeResource<T>(scope: string, resource: string, value: T, ttlMs = 300000) {
  const key = keyFor(scope, resource);
  pending.delete(key); // An older read must not replace a successful write.
  if (values.size >= 40 && !values.has(key)) values.delete(values.keys().next().value!);
  values.set(key, { value, expiresAt: Date.now() + ttlMs });
}
export function invalidateResource(scope: string, resource: string) {
  const key = keyFor(scope, resource); values.delete(key); pending.delete(key);
}
export function invalidateResourceGroup(scope:string, prefix:string) {
  const start=keyFor(scope,prefix);
  for(const cache of [values,pending])for(const key of cache.keys())if(key.startsWith(start))cache.delete(key);
}
export function clearResourceCache() { values.clear(); pending.clear(); }
export function loadResource<T>(scope: string, resource: string, load: () => Promise<T>, ttlMs = 30000, force = false): Promise<T> {
  const key = keyFor(scope, resource);
  const flight = pending.get(key);
  if (flight) return flight as Promise<T>;
  const cached = !force ? cachedResource<T>(scope, resource) : undefined;
  if (cached !== undefined) return Promise.resolve(cached);
  const request = Promise.resolve().then(load).then(value => {
    if (pending.get(key) === request) {
      if (values.size >= 40) values.delete(values.keys().next().value!);
      values.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    return value;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request); return request;
}
