/**
 * Which list rows play the entrance animation (pure; used by AsyncList).
 *
 * Only the rows that appear when the list first shows data animate: the first `maxRows` rows mounted within
 * `windowMs` of the first one, each at most once. Rows mounted later (next pages, scrolling far down, a cell
 * recycled back into view) appear at once, so long lists stay fast. `reset()` when the list is empty again
 * (new search / filter / reload) so the next data animates in.
 */
export type EntranceTracker = {
  /** true if the row with this key, at this index, should animate now. */
  claim: (key: string, index: number, now?: number) => boolean;
  reset: () => void;
};

export const ENTRANCE_MAX_ROWS = 10;
export const ENTRANCE_WINDOW_MS = 1000;

export function createEntranceTracker(maxRows = ENTRANCE_MAX_ROWS, windowMs = ENTRANCE_WINDOW_MS): EntranceTracker {
  let start = 0;
  const seen = new Set<string>();
  return {
    claim(key, index, now = Date.now()) {
      if (index < 0 || index >= maxRows) return false;
      if (!start) start = now;
      if (now - start > windowMs || seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    reset() {
      start = 0;
      seen.clear();
    },
  };
}
