/**
 * What each screen last saw, so returning to one shows it immediately.
 *
 * Every screen in this app is remounted on navigation -- the CRM because it lives under
 * a single dynamic segment, the consumer screens because they are separate routes -- so
 * without this each one starts blank and the reader waits out a round trip for a screen
 * they were just looking at. The remembered value is shown at once and a fetch still
 * runs behind it, replacing it when it answers: stale for a moment, never stale for long.
 *
 * Keys carry the workspace or person id, because the paths do, so nothing can read
 * another's data. This is module state: it dies with the page, and both sign-out paths
 * replace the document, so nothing here outlives a session.
 */
const store = new Map<string, unknown>();
const limit = 60;

export function remember(key: string | null, value: unknown): void {
  if (!key) return;
  // Bounded, oldest evicted first: a long session must not grow this without end.
  if (store.size >= limit && !store.has(key)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.delete(key);
  store.set(key, value);
}

export function recall<T>(key: string | null): T | undefined {
  return key ? store.get(key) as T | undefined : undefined;
}

/** Signing out must not leave one account's rows visible to the next. */
export function forgetAll(): void { store.clear(); }
