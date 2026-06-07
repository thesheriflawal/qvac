interface Entry<T> { data: T; expiresAt: number; }
const store = new Map<string, Entry<any>>();

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(...keys: string[]): void {
  keys.forEach(k => store.delete(k));
}

export function cacheDeletePrefix(prefix: string): void {
  store.forEach((_, k) => { if (k.startsWith(prefix)) store.delete(k); });
}
