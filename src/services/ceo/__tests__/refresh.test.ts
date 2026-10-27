// The dashboards' quiet auto refresh: every 5 minutes, only on screen and in the foreground, never while a load
// runs or the range editor is open; the "Updated x ago" line.

import { AUTO_REFRESH_MS, REFRESH_TICK_MS, isStale, latest, shouldAutoRefresh, updatedAgo } from "../refresh";

const MIN = 60 * 1000;
const T0 = new Date(2026, 9, 19, 10, 0, 0).getTime();

describe("timing", () => {
  it("reloads every 5 minutes and checks every 30 seconds", () => {
    expect(AUTO_REFRESH_MS).toBe(5 * MIN);
    expect(REFRESH_TICK_MS).toBe(30 * 1000);
  });

  it("figures are stale once they are 5 minutes old, never before the first answer", () => {
    expect(isStale(T0, T0 + 5 * MIN - 1)).toBe(false);
    expect(isStale(T0, T0 + 5 * MIN)).toBe(true);
    expect(isStale(T0, T0 + 12 * MIN)).toBe(true);
    expect(isStale(null, T0 + 60 * MIN)).toBe(false);
    expect(isStale(T0, T0 + 2 * MIN, 2 * MIN)).toBe(true);
  });

  it("the clock runs from the latest of the last answer, the last attempt and the screen opening", () => {
    expect(latest(T0, null, T0 + MIN)).toBe(T0 + MIN);
    expect(latest(null, undefined)).toBeNull();
    expect(latest(T0 + 3 * MIN, T0)).toBe(T0 + 3 * MIN);
    expect(latest(Number.NaN, T0)).toBe(T0);
  });
});

describe("shouldAutoRefresh", () => {
  const due = { since: T0, now: T0 + 5 * MIN, focused: true, foreground: true, paused: false };

  it("reloads when due, on screen and in the foreground", () => {
    expect(shouldAutoRefresh(due)).toBe(true);
  });

  it("not before 5 minutes", () => {
    expect(shouldAutoRefresh({ ...due, now: T0 + 4 * MIN })).toBe(false);
  });

  it("not while another screen (a drill-down) is on top, nor while the app is in the background", () => {
    expect(shouldAutoRefresh({ ...due, focused: false })).toBe(false);
    expect(shouldAutoRefresh({ ...due, foreground: false })).toBe(false);
  });

  it("not while a load runs or the range editor is open (it waits and runs when that ends)", () => {
    expect(shouldAutoRefresh({ ...due, paused: true })).toBe(false);
  });

  it("back on the screen or in the app after a while: at once when the figures are older than 5 minutes", () => {
    // Left at T0 + 1 min with figures from T0, back 20 minutes later.
    expect(shouldAutoRefresh({ ...due, now: T0 + 21 * MIN })).toBe(true);
    // Back after 2 minutes: nothing yet.
    expect(shouldAutoRefresh({ ...due, now: T0 + 3 * MIN })).toBe(false);
  });

  it("a first load that has not answered yet is not reloaded", () => {
    expect(shouldAutoRefresh({ ...due, since: null, now: T0 + 60 * MIN })).toBe(false);
  });
});

describe("updatedAgo", () => {
  it("just now, minutes ago, then the time", () => {
    expect(updatedAgo(null, T0)).toBe("");
    expect(updatedAgo(T0, T0 + 20 * 1000)).toBe("Updated just now");
    expect(updatedAgo(T0, T0 + 61 * 1000)).toBe("Updated 1 min ago");
    expect(updatedAgo(T0, T0 + 12 * MIN + 30 * 1000)).toBe("Updated 12 min ago");
    expect(updatedAgo(T0, T0 + 59 * MIN)).toBe("Updated 59 min ago");
    expect(updatedAgo(T0, T0 + 60 * MIN)).toBe("Updated at 10:00 AM");
  });

  it("another day names the day; a clock running behind never shows a negative time", () => {
    expect(updatedAgo(T0, T0 + 24 * 60 * MIN)).toBe("Updated 19 Oct 2026, 10:00 AM");
    expect(updatedAgo(T0 + MIN, T0)).toBe("Updated just now");
  });
});
