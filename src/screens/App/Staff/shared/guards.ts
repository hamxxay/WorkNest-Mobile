// Pure helpers behind the staff data hooks and forms (no React / React Native imports, unit-tested on their own).

/**
 * Whether coming back to a screen should reload its data: only when reloading on focus at all, after a first
 * load, and when the data is older than `staleAfterMs` (0 = always) or was marked stale (e.g. an edit form was
 * opened from the screen).
 */
export function shouldReloadOnFocus(state: {
  reloadOnFocus: boolean;
  loadedAt: number | null;
  stale: boolean;
  staleAfterMs: number;
  now: number;
}): boolean {
  if (!state.reloadOnFocus || state.loadedAt == null) return false;
  return state.stale || state.staleAfterMs <= 0 || state.now - state.loadedAt >= state.staleAfterMs;
}

/**
 * Wraps an async action so that calls made while it is still running are ignored (a button tap and the
 * keyboard's submit key, or two quick taps, must not send the same request twice). Resolves to undefined for an
 * ignored call.
 */
export function singleFlight<A extends unknown[], R>(action: (...args: A) => Promise<R>): (...args: A) => Promise<R | undefined> {
  let running = false;
  return async (...args: A) => {
    if (running) return undefined;
    running = true;
    try {
      return await action(...args);
    } finally {
      running = false;
    }
  };
}

/**
 * `items` without repeats of the same key (first one kept). Paged lists can return a row twice when rows are
 * added between page loads; duplicate React keys would then mix up the rows.
 */
export function uniqueBy<T>(items: readonly T[], key: (item: T, index: number) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  items.forEach((item, index) => {
    const k = key(item, index);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(item);
  });
  return out;
}

/** List key for a row with an int id and / or a public id (GUID); falls back to the row's position. */
export function rowKey(row: { id?: number | null; publicId?: string | null }, index: number): string {
  if (row.id != null && row.id > 0) return `id:${row.id}`;
  if (row.publicId) return `guid:${row.publicId}`;
  return `row:${index}`;
}
