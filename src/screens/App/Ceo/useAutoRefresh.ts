import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { AUTO_REFRESH_MS, REFRESH_TICK_MS, latest, shouldAutoRefresh } from "../../../services/ceo";

// Quiet auto refresh of a read-only dashboard (CEO, Sales Manager): `run` reloads the figures without skeletons or
// the pull-to-refresh spinner, every 5 minutes, only while the dashboard is the screen on top and the app is in the
// foreground. Coming back to it (from a drill-down screen, or from another app) with figures older than 5 minutes
// reloads them at once. A drill-down screen is never touched: the dashboard is not focused while one is open. The
// timing rules are services/ceo/refresh.ts (unit-tested).

export type AutoRefreshOptions = {
  /** Reload quietly (the figures on screen stay until the new ones arrive). */
  run: () => void;
  /** When the figures on screen arrived (ms), from the dashboard's query; null before the first answer. */
  loadedAt: number | null;
  /** True while a load runs or something on screen must not be disturbed (e.g. the date range editor). */
  paused: boolean;
  everyMs?: number;
  tickMs?: number;
};

/** Runs the auto refresh; returns the current time (ms), which moves on every 30 seconds for "Updated x ago". */
export function useAutoRefresh({ run, loadedAt, paused, everyMs = AUTO_REFRESH_MS, tickMs = REFRESH_TICK_MS }: AutoRefreshOptions): number {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(() => (AppState.currentState ?? "active") === "active");
  const [now, setNow] = useState(() => Date.now());

  // The latest values, read by the timer without restarting it.
  const latestRef = useRef({ run, loadedAt, paused, focused, foreground });
  latestRef.current = { run, loadedAt, paused, focused, foreground };
  /** The clock starts when the screen opens (a first load that failed is tried again after the interval too). */
  const openedAt = useRef(Date.now());
  const lastRunAt = useRef<number | null>(null);

  const check = useCallback(() => {
    const t = Date.now();
    setNow(t);
    const s = latestRef.current;
    const since = latest(s.loadedAt, lastRunAt.current, openedAt.current);
    if (shouldAutoRefresh({ since, now: t, focused: s.focused, foreground: s.foreground, paused: s.paused, everyMs })) {
      // Counted from now, so a failing server is asked again only after the next interval.
      lastRunAt.current = t;
      s.run();
    }
  }, [everyMs]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);

  // On the screen and in the foreground: check now (back after a while: reload if stale), then every tick.
  useEffect(() => {
    if (!focused || !foreground) return;
    check();
    const timer = setInterval(check, tickMs);
    return () => clearInterval(timer);
  }, [focused, foreground, check, tickMs]);

  // A refresh that had to wait (the range editor was open, a load was running) runs as soon as it may.
  useEffect(() => {
    if (!paused && latestRef.current.focused && latestRef.current.foreground) check();
  }, [paused, check]);

  return now;
}
