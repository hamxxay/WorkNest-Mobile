import { count } from "../ceo/format";
import type { DashboardTrend } from "../staff/dashboard";

// Display helpers for the Sales Manager screens (pure, unit-tested in __tests__/format.test.ts). The dashboard shows
// desks, never money: whole numbers with a unit word ("91 desks", "1 desk").

/** A whole number, or 0 for anything that is not a finite number. */
const whole = (value: number | null | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** 91 -> "91 desks", 1 -> "1 desk", 1250 -> "1,250 desks"; a missing figure reads "0 desks". */
export function desks(value: number | null | undefined): string {
  const n = whole(value);
  return `${count(n)} ${Math.abs(n) === 1 ? "desk" : "desks"}`;
}

/** 1 -> "1 lease", 4 -> "4 leases" (and the like for any unit). */
export function countOf(value: number | null | undefined, one: string, many: string): string {
  const n = whole(value);
  return `${count(n)} ${Math.abs(n) === 1 ? one : many}`;
}

/** A net change with its sign: 85 -> "+85", -3 -> "-3", 0 -> "0". */
export function signedCount(value: number | null | undefined): string {
  const n = whole(value);
  return n > 0 ? `+${count(n)}` : count(n);
}

/**
 * Change in desks against the previous period ("6 vs last period", up or down; "no change"), or undefined when the
 * previous figure was not sent or both are 0. An absolute change (as the staff dashboard's counts): desk numbers
 * are small, and net desks can be negative, where a percentage would mislead.
 */
export function deskTrend(now: number | null | undefined, prev: number | null | undefined): DashboardTrend | undefined {
  if (prev == null || !Number.isFinite(prev)) return undefined;
  const a = whole(now);
  const b = whole(prev);
  if (!a && !b) return undefined;
  const diff = a - b;
  if (diff === 0) return { direction: "flat", label: "no change", upIsGood: true };
  return { direction: diff > 0 ? "up" : "down", label: `${count(Math.abs(diff))} vs last period`, upIsGood: true };
}
