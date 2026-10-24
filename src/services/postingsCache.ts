// Public posting data only; memory-only and reset when session credentials change.
const TTL = 45_000, MAX_ENTRIES = 40;
interface Entry { promise: Promise<unknown>; expires: number; data?: unknown }
const entries = new Map<string, Entry>();

export function clearPostingsCache() { entries.clear(); }
export function peekPostingsCache<T>(key: string): T | undefined {
  const entry = entries.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T | undefined;
  entries.delete(key);
}
export function readPostingsCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const previous = entries.get(key);
  if (previous && previous.expires > Date.now()) {
    entries.delete(key); entries.set(key, previous);
    return previous.promise as Promise<T>;
  }
  const entry: Entry = { promise: Promise.resolve(), expires: Date.now() + TTL };
  entry.promise = Promise.resolve().then(load).then(data => {
    if (entries.get(key) === entry) { entry.data = data; entry.expires = Date.now() + TTL; }
    return data;
  }, error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
  entries.delete(key); entries.set(key, entry);
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  return entry.promise as Promise<T>;
}
