import type { Tone } from "../../theme/colors";
import { formatNumber } from "../../utils/format";
import { count } from "../ceo/format";
import type { DashboardTrend } from "../staff/dashboard";
import type { SmComplaintStatus } from "./types";

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

// ─── Complaints ───────────────────────────────────────────────────────────────────────────────────────────

/** Display order of the complaint statuses (status bar, legends). */
export const SM_COMPLAINT_STATUSES: readonly SmComplaintStatus[] = ["open", "in_progress", "resolved", "closed"];

export const SM_COMPLAINT_STATUS_LABELS: Record<SmComplaintStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

/**
 * Chip tone of a complaint status, in the status bar's colour families: open amber, in progress blue, resolved
 * green, closed (or unknown) slate.
 */
export function complaintStatusTone(status: SmComplaintStatus | null | undefined): Tone {
  switch (status) {
    case "open":
      return "warning";
    case "in_progress":
      return "info";
    case "resolved":
      return "success";
    default:
      return "neutral";
  }
}

/** How old a complaint is: 0 -> "Today", 1 -> "1 day", 12 -> "12 days"; null when not sent. */
export function complaintAgeText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const n = Math.max(0, Math.round(days));
  return n === 0 ? "Today" : countOf(n, "day", "days");
}

/** Age chip tone: red from 7 days, amber from 3 days, otherwise neutral. */
export function complaintAgeTone(days: number | null | undefined): Tone {
  if (days == null || !Number.isFinite(days)) return "neutral";
  if (days >= 7) return "danger";
  if (days >= 3) return "warning";
  return "neutral";
}

/** "avg 1.5 days to resolve", "avg 1 day to resolve"; null when there is no average. */
export function avgResolutionText(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  const rounded = Math.round(days * 10) / 10;
  const text = formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1);
  return `avg ${text} ${rounded === 1 ? "day" : "days"} to resolve`;
}

/** "whatsapp" -> "WhatsApp", "manual" / "staff" -> "Staff", anything else as sent (first letter upper-case). */
export function complaintSourceLabel(source: string | null | undefined): string | null {
  const s = (source ?? "").trim();
  if (!s) return null;
  const key = s.toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "whatsapp") return "WhatsApp";
  if (key === "manual" || key === "staff") return "Staff";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
