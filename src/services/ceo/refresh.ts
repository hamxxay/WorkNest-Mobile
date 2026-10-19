import { formatDate, formatTime } from "../../utils/format";

// Quiet auto refresh of the CEO and Sales Manager dashboards (pure timing rules, unit-tested in
// __tests__/refresh.test.ts; the hook is screens/App/Ceo/useAutoRefresh.ts), as the CMS does it:
//   - every 5 minutes, only while the dashboard is the screen on top (React Navigation focus) and the app is in the
//     foreground (AppState "active");
//   - coming back (to the screen or to the app) with figures older than 5 minutes reloads them at once;
//   - never while a load is already running or while something on screen must not be disturbed (the range editor);
//   - quiet: the figures stay on screen (no skeletons, no pull-to-refresh spinner) until the new ones arrive.
// The clock counts from the last fresh figures (first load, pull to refresh, auto refresh) or the last attempt, so a
// failing server is asked again only after the next interval.

/** How often the figures reload: every 5 minutes. */
export const AUTO_REFRESH_MS = 5 * 60 * 1000;

/** How often the screen checks whether a reload is due, and the "Updated x ago" line moves on: every 30 seconds. */
export const REFRESH_TICK_MS = 30 * 1000;

export type AutoRefreshCheck = {
  /** When the clock last started (ms): fresh figures arrived or a refresh was attempted; null = not yet. */
  since: number | null;
  now: number;
  /** The dashboard is the screen on top. */
  focused: boolean;
  /** The app is in the foreground. */
  foreground: boolean;
  /** A load is running, or something on screen must not be disturbed. */
  paused: boolean;
  everyMs?: number;
};

/** True when figures from `since` are older than the interval (never before the first answer). */
export function isStale(since: number | null, now: number, everyMs: number = AUTO_REFRESH_MS): boolean {
  return since != null && now - since >= everyMs;
}

/** Whether the auto refresh should reload now. */
export function shouldAutoRefresh(check: AutoRefreshCheck): boolean {
  if (!check.focused || !check.foreground || check.paused) return false;
  return isStale(check.since, check.now, check.everyMs ?? AUTO_REFRESH_MS);
}

/** The later of two times (ms), ignoring missing ones. */
export function latest(...times: (number | null | undefined)[]): number | null {
  let out: number | null = null;
  for (const t of times) if (typeof t === "number" && Number.isFinite(t) && (out == null || t > out)) out = t;
  return out;
}

/**
 * The "Updated ..." line: "Updated just now", "Updated 1 min ago", "Updated 12 min ago"; an hour or more: "Updated at
 * 3:45 PM" (another day: "Updated 12 Oct 2026, 3:45 PM"). "" before the first answer.
 */
export function updatedAgo(at: number | null | undefined, now: number): string {
  if (at == null || !Number.isFinite(at)) return "";
  const mins = Math.floor(Math.max(0, now - at) / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const then = new Date(at);
  const sameDay = new Date(now).toDateString() === then.toDateString();
  return sameDay ? `Updated at ${formatTime(then)}` : `Updated ${formatDate(then)}, ${formatTime(then)}`;
}
