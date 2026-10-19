import { INQUIRY_TYPES, type InquiryType } from "../../theme/inquiryTypes";
import { bool, num, optNum, optStr, pick, str } from "../staff/normalize";
import {
  conversionRateOf,
  normalizeBreakdownWith,
  normalizeFunnel,
  normalizeInquiryTypes,
  normalizeLocations,
  normalizePeriod,
  normalizeRanges,
  quotationsBookedOf,
  recordsPayload,
  recordsTotal,
  stageCount,
  toBookingRecord,
  toInquiryRecord,
  toQuotationRecord,
  type BreakdownDefaults,
} from "../ceo/normalize";
import { byMonth, list, optId, payload, section, type Row } from "../ceo/readers";
import type {
  SmActiveComplaint,
  SmBookingRecord,
  SmBreakdown,
  SmBreakdownMetric,
  SmComplaintRecord,
  SmComplaints,
  SmComplaintStatus,
  SmDashboard,
  SmFunnel,
  SmInquiries,
  SmInquiryMonth,
  SmInquiryRecord,
  SmLease,
  SmPeriod,
  SmPerson,
  SmQuotationRecord,
  SmRecordKind,
  SmRecords,
  SmRenewals,
  SmTeam,
} from "./types";

// Normalisers for the Sales Manager API (pure, unit-tested in __tests__/normalize.test.ts). Built on the CEO
// dashboard's readers and normalisers (same contract style). They never throw on a partial answer: unknown shapes
// become empty sections / lists and a missing desk figure is 0, so the screens show their empty states instead of
// failing. Money fields an older API may still send (quotedValue, convertedValue, totals...) are ignored.

// ─── Dashboard ────────────────────────────────────────────────────────────────────────────────────────────

function normalizeFunnelSection(raw: Row | null): SmFunnel | null {
  if (!raw) return null;
  const stages = normalizeFunnel(pick(raw, "stages"));
  const prevBooked = optNum(raw, "quotationsBookedPrev");
  return {
    stages,
    // Conversion = quotations of the period that were booked / quotations of the period: never above 100%.
    conversionRate: conversionRateOf(optNum(raw, "conversionRate")),
    conversionRatePrev: conversionRateOf(optNum(raw, "conversionRatePrev")),
    quotationsBooked: quotationsBookedOf(optNum(raw, "quotationsBooked"), stageCount(stages, "bookings"), stageCount(stages, "quotations")),
    quotationsBookedPrev: prevBooked == null ? null : Math.max(0, prevBooked),
    quotedDesks: num(raw, "quotedDesks"),
    bookedDesks: num(raw, "bookedDesks"),
    bookedDesksPrev: optNum(raw, "bookedDesksPrev"),
    months: byMonth(
      list(raw, "months", (m) => {
        const quotations = num(m, "quotations");
        const bookings = num(m, "bookings");
        return {
          month: str(m, "month"),
          quotations,
          accepted: num(m, "accepted"),
          bookings,
          bookedDesks: num(m, "bookedDesks"),
          quotationsBooked: quotationsBookedOf(optNum(m, "quotationsBooked"), bookings, quotations),
        };
      }),
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
    desksSold: num(p, "desksSold"),
    conversionRate: optNum(p, "conversionRate") ?? (quotations > 0 ? (converted / quotations) * 100 : null),
    followUpsDue: num(p, "followUpsDue"),
  };
};

/** People ranked by desks sold, then converted, then quotations (highest first), then by name (full ties keep the server's order). */
export function rankPeople(people: SmPerson[]): SmPerson[] {
  return people
    .map((person, index) => ({ person, index }))
    .sort(
      (a, b) =>
        b.person.desksSold - a.person.desksSold ||
        b.person.converted - a.person.converted ||
        b.person.quotations - a.person.quotations ||
        a.person.name.localeCompare(b.person.name) ||
        a.index - b.index,
    )
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
      desksSold: num(l, "desksSold"),
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
  desks: num(b, "desks"),
  daysLeft: optNum(b, "daysLeft"),
});

/** Leases ending within this many days count as "ending within 30 days". */
const SOON_DAYS = 30;

const sumDesks = (leases: SmLease[]) => leases.reduce((sum, l) => sum + l.desks, 0);

/**
 * The renewals section. `funnelBookedDesks` (the funnel's desks booked) fills `bookedDesks` when the section does
 * not repeat it; net desks = desks booked - desks ended (worked out when not sent).
 */
function normalizeRenewalsSection(raw: Row | null, funnelBookedDesks: number | null): SmRenewals | null {
  if (!raw) return null;
  const expiring = list(raw, "expiring", toLease);
  const soon = expiring.filter((l) => l.daysLeft != null && l.daysLeft <= SOON_DAYS);
  const endedDesks = num(raw, "endedDesks");
  const sentNet = optNum(raw, "netDesks");
  const bookedDesks = optNum(raw, "bookedDesks") ?? funnelBookedDesks ?? (sentNet != null ? sentNet + endedDesks : 0);
  return {
    expiring,
    // The full counts / desks when sent (the list may be cut short), else what the list holds.
    expiringCount: Math.max(expiring.length, num(raw, "expiringCount")),
    expiringDesks: optNum(raw, "expiringDesks") ?? sumDesks(expiring),
    expiring30Count: Math.max(soon.length, num(raw, "expiring30Count")),
    expiring30Desks: optNum(raw, "expiring30Desks") ?? sumDesks(soon),
    bookedDesks,
    endedDesks,
    netDesks: sentNet ?? bookedDesks - endedDesks,
    netDesksPrev: optNum(raw, "netDesksPrev"),
    months: byMonth(
      list(raw, "months", (m) => ({
        month: str(m, "month"),
        bookedDesks: num(m, "bookedDesks"),
        endingDesks: num(m, "endingDesks"),
        expiring: num(m, "expiring"),
      })),
    ),
  };
}

/** GET api/sales-manager/dashboard answer (envelope or bare object). */
export function normalizeSalesManagerDashboard(raw: unknown, requested: SmPeriod = "month"): SmDashboard {
  const d = payload(raw);
  const period = pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested;
  const funnel = normalizeFunnelSection(section(d, "funnel"));
  return {
    period,
    periodLabel: str(d, "periodLabel"),
    generatedAt: optStr(d, "generatedAt"),
    ...normalizeRanges(d, true),
    locations: normalizeLocations(pick(d, "locations")),
    inquiriesAllBranches: bool(d, "inquiriesAllBranches"),
    funnel,
    team: normalizeTeamSection(section(d, "team")),
    inquiries: normalizeInquiriesSection(section(d, "inquiries")),
    renewals: normalizeRenewalsSection(section(d, "renewals"), funnel?.bookedDesks ?? null),
  };
}

// ─── Complaints ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A complaint status as the API normalises it (trimmed, lower-case, spaces to "_"), with "new" read as open and
 * "inprogress" / "in-progress" as in_progress; null for anything else.
 */
export function normalizeSmComplaintStatus(value: unknown): SmComplaintStatus | null {
  if (value == null) return null;
  const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  switch (key) {
    case "open":
    case "new":
      return "open";
    case "in_progress":
    case "inprogress":
      return "in_progress";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return null;
  }
}

/** A category name; none (a NULL category) is "Other", as the API groups it. */
const categoryOf = (row: Row) => optStr(row, "category") ?? "Other";

const toActiveComplaint = (c: Row): SmActiveComplaint => ({
  complaintId: optId(c, "complaintId", "id"),
  complaintNo: optStr(c, "complaintNo"),
  customerName: optStr(c, "customerName", "customer"),
  category: categoryOf(c),
  branch: optStr(c, "branch"),
  status: normalizeSmComplaintStatus(pick(c, "status")),
  createdOn: optStr(c, "createdOn"),
  ageDays: optNum(c, "ageDays"),
});

/** Average days to resolve, one decimal; null when not sent (or not a usable figure). */
const avgDays = (raw: Row): number | null => {
  const n = optNum(raw, "avgResolutionDays");
  return n != null && n >= 0 ? Math.round(n * 10) / 10 : null;
};

/** GET api/sales-manager/complaints answer (envelope or bare object). Missing counts are 0, missing lists []. */
export function normalizeSalesManagerComplaints(raw: unknown, requested: SmPeriod = "month"): SmComplaints {
  const d = payload(raw);
  const s = section(d, "status") ?? {};
  const status = {
    open: num(s, "open", "new"),
    inProgress: num(s, "inProgress", "in_progress"),
    resolved: num(s, "resolved"),
    closed: num(s, "closed"),
  };
  return {
    period: pick(d, "period") != null ? normalizePeriod(pick(d, "period")) : requested,
    periodLabel: str(d, "periodLabel"),
    ...normalizeRanges(d),
    status,
    activeTotal: optNum(d, "activeTotal") ?? status.open + status.inProgress,
    newInPeriod: num(d, "newInPeriod"),
    newInPeriodPrev: optNum(d, "newInPeriodPrev"),
    resolvedInPeriod: num(d, "resolvedInPeriod"),
    reopenedInPeriod: num(d, "reopenedInPeriod"),
    avgResolutionDays: avgDays(d),
    byCategory: list(d, "byCategory", (c) => ({
      category: categoryOf(c),
      open: num(c, "open"),
      inProgress: num(c, "inProgress"),
      total: num(c, "total"),
    })),
    byBranch: list(d, "byBranch", (b) => {
      const branch = str(b, "branch").trim();
      return {
        branch,
        label: optStr(b, "label") ?? (branch || "No branch"),
        open: num(b, "open"),
        inProgress: num(b, "inProgress"),
        total: num(b, "total"),
      };
    }),
    months: byMonth(list(d, "months", (m) => ({ month: str(m, "month"), created: num(m, "created"), resolved: num(m, "resolved") }))),
    oldestActive: list(d, "oldestActive", toActiveComplaint),
  };
}

/** A records/complaints row. */
export const toComplaintRecord = (r: Row): SmComplaintRecord => ({
  complaintId: optId(r, "complaintId", "id"),
  complaintNo: optStr(r, "complaintNo"),
  customerName: optStr(r, "customerName", "customer"),
  phone: optStr(r, "phone", "phoneNumber"),
  category: categoryOf(r),
  branch: optStr(r, "branch"),
  status: normalizeSmComplaintStatus(pick(r, "status")),
  statusText: optStr(r, "status"),
  source: optStr(r, "source"),
  isFollowUp: bool(r, "isFollowUp"),
  createdOn: optStr(r, "createdOn"),
  updatedOn: optStr(r, "updatedOn"),
  ageDays: optNum(r, "ageDays"),
  description: optStr(r, "description"),
});

// ─── Breakdown ────────────────────────────────────────────────────────────────────────────────────────────

/** Title and value labels when the server sent none. */
const BREAKDOWN_DEFAULTS: Record<SmBreakdownMetric, BreakdownDefaults> = {
  "funnel-month": { title: "Desks booked by location", valueLabel: "Desks booked", value2Label: "Bookings" },
  staff: { title: "Quotations by month", valueLabel: "Quotations", value2Label: "Desks sold" },
  "inquiries-type": { title: "Inquiries by month", valueLabel: "Inquiries", value2Label: null },
  "renewals-month": { title: "Leases ending by location", valueLabel: "Leases ending", value2Label: "Desks" },
  "desks-month": { title: "Desks booked and ending by location", valueLabel: "Desks booked", value2Label: "Desks ending" },
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
  complaints: "Complaints",
};

const toSmInquiry = (r: Row): SmInquiryRecord => ({ ...toInquiryRecord(r), followUpOn: optStr(r, "followUpOn", "followUpDate") });

/** A quotation row as the CEO's reader reads it, without the amount (an older API's `total` is dropped), plus its desks. */
export const toSmQuotation = (r: Row): SmQuotationRecord => {
  const q = toQuotationRecord(r);
  return {
    quotationId: q.quotationId,
    quotationNumber: q.quotationNumber,
    customer: q.customer,
    location: q.location,
    createdBy: q.createdBy,
    status: q.status,
    desks: num(r, "desks"),
    createdOn: q.createdOn,
  };
};

/** A booking row as the CEO's reader reads it, without the amount (an older API's `totalAmount` is dropped), plus its desks. */
export const toSmBooking = (r: Row): SmBookingRecord => {
  const b = toBookingRecord(r);
  return {
    bookingId: b.bookingId,
    customer: b.customer,
    space: b.space,
    location: b.location,
    startOn: b.startOn,
    endOn: b.endOn,
    status: b.status,
    desks: num(r, "desks"),
  };
};

/** GET api/sales-manager/records/{kind} answer. `total` is never below the number of rows. */
export function normalizeSalesManagerRecords(kind: SmRecordKind, raw: unknown): SmRecords {
  const d = recordsPayload(raw);
  const title = optStr(d, "title") ?? RECORD_TITLES[kind] ?? "Records";
  switch (kind) {
    case "bookings": {
      const rows = list(d, "rows", toSmBooking);
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
    case "complaints": {
      const rows = list(d, "rows", toComplaintRecord);
      return { kind, title, total: recordsTotal(d, rows.length), rows };
    }
    case "quotations":
    default: {
      const rows = list(d, "rows", toSmQuotation);
      return { kind: "quotations", title, total: recordsTotal(d, rows.length), rows };
    }
  }
}
