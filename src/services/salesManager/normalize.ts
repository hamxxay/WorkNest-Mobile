import { INQUIRY_TYPES, type InquiryType } from "../../theme/inquiryTypes";
import { num, optNum, optStr, pick, str } from "../staff/normalize";
import {
  normalizeBreakdownWith,
  normalizeFunnel,
  normalizeInquiryTypes,
  normalizeLocations,
  normalizePeriod,
  recordsPayload,
  recordsTotal,
  toBookingRecord,
  toInquiryRecord,
  toQuotationRecord,
  type BreakdownDefaults,
} from "../ceo/normalize";
import { byMonth, list, optId, payload, section, type Row } from "../ceo/readers";
import type {
  SmBreakdown,
  SmBreakdownMetric,
  SmDashboard,
  SmFunnel,
  SmInquiries,
  SmInquiryMonth,
  SmInquiryRecord,
  SmLease,
  SmPeriod,
  SmPerson,
  SmRecordKind,
  SmRecords,
  SmRenewals,
  SmTeam,
} from "./types";

// Normalisers for the Sales Manager API (pure, unit-tested in __tests__/normalize.test.ts). Built on the CEO
// dashboard's readers and normalisers (same contract style). They never throw on a partial answer: unknown shapes
// become empty sections / lists, so the screens show their empty states instead of failing.

// ─── Dashboard ────────────────────────────────────────────────────────────────────────────────────────────

function normalizeFunnelSection(raw: Row | null): SmFunnel | null {
  if (!raw) return null;
  return {
    stages: normalizeFunnel(pick(raw, "stages")),
    conversionRate: optNum(raw, "conversionRate"),
    conversionRatePrev: optNum(raw, "conversionRatePrev"),
    quotedValue: num(raw, "quotedValue"),
    bookedValue: num(raw, "bookedValue"),
    bookedValuePrev: optNum(raw, "bookedValuePrev"),
    months: byMonth(
      list(raw, "months", (m) => ({
        month: str(m, "month"),
        quotations: num(m, "quotations"),
        accepted: num(m, "accepted"),
        bookings: num(m, "bookings"),
        bookedValue: num(m, "bookedValue"),
      })),
    ),
  };
}

const toPerson = (p: Row): SmPerson => {
  const quotations = num(p, "quotations");
  const converted = num(p, "converted");
  return {
    userId: optId(p, "userId"),
    name: optStr(p, "name") ?? "Team member",
    role: str(p, "role").replace(/_/g, " "),
    locations: optStr(p, "locations"),
    inquiriesHandled: num(p, "inquiriesHandled"),
    quotations,
    accepted: num(p, "accepted"),
    converted,
    convertedValue: num(p, "convertedValue"),
    conversionRate: optNum(p, "conversionRate") ?? (quotations > 0 ? (converted / quotations) * 100 : null),
    followUpsDue: num(p, "followUpsDue"),
  };
};

/** People ranked by converted value, highest first (ties keep the server's order). */
export function rankPeople(people: SmPerson[]): SmPerson[] {
  return people
    .map((person, index) => ({ person, index }))
    .sort((a, b) => b.person.convertedValue - a.person.convertedValue || a.index - b.index)
    .map((x) => x.person);
}

function normalizeTeamSection(raw: Row | null): SmTeam | null {
  if (!raw) return null;
  return {
    people: rankPeople(list(raw, "people", toPerson)),
    perLocation: list(raw, "perLocation", (l) => ({
      locationId: optId(l, "locationId"),
      name: optStr(l, "name") ?? "Location",
      salesExecutives: num(l, "salesExecutives"),
      quotations: num(l, "quotations"),
      converted: num(l, "converted"),
      convertedValue: num(l, "convertedValue"),
    })),
  };
}

/** Keys of each Type in a month row ({ website, whatsApp, walkIn, reference, notSet }), with other spellings. */
const MONTH_TYPE_KEYS: Record<InquiryType, string[]> = {
  Website: ["website"],
  WhatsApp: ["whatsApp", "whatsapp"],
  WalkIn: ["walkIn", "walkin", "walk_in"],
  Reference: ["reference"],
  NotSet: ["notSet", "notset", "not_set"],
};

const toInquiryMonth = (m: Row): SmInquiryMonth => {
  const counts = {} as Record<InquiryType, number>;
  for (const type of INQUIRY_TYPES) counts[type] = num(m, ...MONTH_TYPE_KEYS[type]);
  return { month: str(m, "month"), counts };
};

function normalizeInquiriesSection(raw: Row | null): SmInquiries | null {
  if (!raw) return null;
  return {
    total: num(raw, "total"),
    totalPrev: optNum(raw, "totalPrev"),
    followedUp: num(raw, "followedUp"),
    notInterested: num(raw, "notInterested"),
    converted: num(raw, "converted"),
    followUpsDue: num(raw, "followUpsDue"),
    byType: normalizeInquiryTypes(pick(raw, "byType")),
    notInterestedReasons: list(raw, "notInterestedReasons", (r) => ({
      reason: optStr(r, "reason", "label") ?? "No reason given",
      count: num(r, "count"),
    })),
    months: byMonth(list(raw, "months", toInquiryMonth)),
  };
}

export const toLease = (b: Row): SmLease => ({
  bookingId: optId(b, "bookingId", "id"),
  customer: optStr(b, "customer", "customerName") ?? "Customer",
  space: optStr(b, "space", "spaceName"),
  location: optStr(b, "location", "locationName"),
  endOn: optStr(b, "endOn", "endDate"),
  monthlyAmount: optNum(b, "monthlyAmount"),
  daysLeft: optNum(b, "daysLeft"),
});

function normalizeRenewalsSection(raw: Row | null): SmRenewals | null {
  if (!raw) return null;
  const expiring = list(raw, "expiring", toLease);
  return {
    expiring,
    // The full count / value when sent (the list may be cut short), else what the list holds.
    expiringCount: Math.max(expiring.length, num(raw, "expiringCount")),
    expiringMonthlyValue: optNum(raw, "expiringMonthlyValue") ?? expiring.reduce((sum, l) => sum + (l.monthlyAmount ?? 0), 0),
    newBookingRevenue: num(raw, "newBookingRevenue"),
    newBookingRevenuePrev: optNum(raw, "newBookingRevenuePrev"),
    months: byMonth(
      list(raw, "months", (m) => ({ month: str(m, "month"), newBookingRevenue: num(m, "newBookingRevenue"), expiring: num(m, "expiring") })),
    ),
  };
}

/** GET api/sales-manager/dashboard answer (envelope or bare object). */
export function normalizeSalesManagerDashboard(raw: unknown, requested: SmPeriod = "month"): SmDashboard {
  const d = payload(raw);
  const period = pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested;
  return {
    period,
    periodLabel: str(d, "periodLabel"),
    generatedAt: optStr(d, "generatedAt"),
    locations: normalizeLocations(pick(d, "locations")),
    funnel: normalizeFunnelSection(section(d, "funnel")),
    team: normalizeTeamSection(section(d, "team")),
    inquiries: normalizeInquiriesSection(section(d, "inquiries")),
    renewals: normalizeRenewalsSection(section(d, "renewals")),
  };
}

// ─── Breakdown ────────────────────────────────────────────────────────────────────────────────────────────

/** Title and value labels when the server sent none. */
const BREAKDOWN_DEFAULTS: Record<SmBreakdownMetric, BreakdownDefaults> = {
  "funnel-month": { title: "Bookings by location", valueLabel: "Bookings", value2Label: "Quotations" },
  staff: { title: "Quotations by month", valueLabel: "Quotations", value2Label: "Converted" },
  "inquiries-type": { title: "Inquiries by month", valueLabel: "Inquiries", value2Label: null },
  "renewals-month": { title: "Expiring leases by location", valueLabel: "Expiring leases", value2Label: "Monthly value" },
  "revenue-month": { title: "New-booking revenue by location", valueLabel: "New-booking revenue", value2Label: null },
};

/** Row keys of these metrics are months (labels default to "Oct 2026"); the others are location ids. */
const MONTH_ROWS: ReadonlySet<SmBreakdownMetric> = new Set<SmBreakdownMetric>(["staff", "inquiries-type"]);

/** GET api/sales-manager/breakdown answer. */
export function normalizeSalesManagerBreakdown(raw: unknown, metric: SmBreakdownMetric): SmBreakdown {
  const defaults = BREAKDOWN_DEFAULTS[metric] ?? { title: "Breakdown", valueLabel: "Value", value2Label: null };
  return normalizeBreakdownWith(raw, defaults, MONTH_ROWS.has(metric));
}

// ─── Records ──────────────────────────────────────────────────────────────────────────────────────────────

const RECORD_TITLES: Record<SmRecordKind, string> = {
  quotations: "Quotations",
  bookings: "Bookings",
  inquiries: "Tour inquiries",
  leases: "Expiring leases",
};

const toSmInquiry = (r: Row): SmInquiryRecord => ({ ...toInquiryRecord(r), followUpOn: optStr(r, "followUpOn", "followUpDate") });

/** GET api/sales-manager/records/{kind} answer. `total` is never below the number of rows. */
export function normalizeSalesManagerRecords(kind: SmRecordKind, raw: unknown): SmRecords {
  const d = recordsPayload(raw);
  const title = optStr(d, "title") ?? RECORD_TITLES[kind] ?? "Records";
  switch (kind) {
    case "bookings": {
      const rows = list(d, "rows", toBookingRecord);
      return { kind, title, total: recordsTotal(d, rows.length), rows };
    }
    case "inquiries": {
      const rows = list(d, "rows", toSmInquiry);
      return { kind, title, total: recordsTotal(d, rows.length), rows };
    }
    case "leases": {
      const rows = list(d, "rows", toLease);
      return { kind, title, total: recordsTotal(d, rows.length), rows };
    }
    case "quotations":
    default: {
      const rows = list(d, "rows", toQuotationRecord);
      return { kind: "quotations", title, total: recordsTotal(d, rows.length), rows };
    }
  }
}
