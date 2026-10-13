import { STAFF_ENDPOINTS } from "./endpoints";
import { actionResult, staffGet, staffPost, type ActionResult } from "./http";
import { bool, idList, num, optNum, optStr, pick, str, withQuery } from "./normalize";

// Staff dashboard (mirrors WorkNest_FE admin.service.ts getRoleDashboard / getDashboardOverview /
// getDashboardForecast / getNavBadges and pages/admin/dashboard/**).
//
// Location scope (API DashboardController.Scope): `locationIds` = the locations to total; none = every location
// the user may see. Admins and sales executives only ever get their own locations (asked-for locations outside
// them are ignored); super admins get every location.
//
// What the CMS shows per role:
//   sales executive: role dashboard (sales section) + forecast + door access card
//   admin:           overview + forecast + role dashboard (team section) + door access card
//   super admin:     overview + forecast + role dashboard (team, locations, staff, system) + door access card

export type DashboardPeriod = "month" | "quarter" | "year";

export type DashboardScope = {
  period?: DashboardPeriod;
  /** Locations to total; empty / omitted = all the user may see. */
  locationIds?: readonly number[];
};

/** A row in a "needs attention" list (overdue invoice, lease ending, booking waiting for confirmation). */
export type AttentionItem = {
  bookingId: number | null;
  reference: string | null;
  customer: string | null;
  space: string | null;
  /** yyyy-MM-dd: due date / lease end / booking start. */
  date: string | null;
  amount: number | null;
};

const toAttention = (row: any): AttentionItem => ({
  bookingId: optNum(row, "bookingId"),
  reference: optStr(row, "reference"),
  customer: optStr(row, "customer"),
  space: optStr(row, "space"),
  date: optStr(row, "date"),
  amount: optNum(row, "amount"),
});

const list = <T>(value: unknown, map: (row: any) => T): T[] => (Array.isArray(value) ? value.map(map) : []);

// ─── GET dashboard/role ───────────────────────────────────────────────────────────────────────────────────

export type FollowUpItem = { contactId: number; name: string | null; phone: string | null; followUpOn: string | null; note: string | null };

export type SalesDashboard = {
  quotationsCreated: number;
  draft: number;
  sent: number;
  accepted: number;
  agreementStage: number;
  converted: number;
  lost: number;
  convertedValue: number;
  /** Converted / created, in percent. */
  conversionPct: number;
  awaitingSignature: AttentionItem[];
  pendingBookings: AttentionItem[];
  newInquiries: number;
  inquiriesInPeriod: number;
  followUpsDue: number;
  convertedInquiries: number;
  followUps: FollowUpItem[];
  renewalDays: number;
  renewalsDue: number;
  renewals: AttentionItem[];
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  overdueInvoices: AttentionItem[];
};

export type TeamDashboard = {
  openComplaints: number;
  unreadWhatsApp: number;
  newInquiries: number;
  kycPending: number;
  accessSuspended: number;
  machinesOffline: number;
  machines: number;
  offlineMachines: { name: string; lastSeen: string | null }[];
};

export type LocationComparison = {
  locationId: number;
  name: string;
  totalSpaces: number;
  occupiedSpaces: number;
  occupancyPct: number;
  activeBookings: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
};

export type StaffOverview = {
  perLocation: { locationId: number; name: string; admins: number; salesExecutives: number }[];
  people: {
    userId: number;
    name: string;
    role: string;
    locations: string | null;
    quotations: number;
    converted: number;
    convertedValue: number;
  }[];
};

export type SystemHealth = {
  hikSyncEnabled: boolean;
  hikJobs: { job: string; lastFinishedAt: string | null; lastOk: boolean | null; lastResult: string | null; running: boolean }[];
  machines: number;
  machinesOffline: number;
  lastMachineSeen: string | null;
  whatsAppConfigured: boolean;
  lastWhatsAppMessage: string | null;
  emailPending: number;
  emailFailed: number;
};

/** Only the sections for the caller's role are filled; the others are null (API RoleDashboardDto). */
export type RoleDashboard = {
  role: "sales_executive" | "admin" | "super_admin" | string;
  period: string;
  /** Sales executive. */
  sales: SalesDashboard | null;
  /** Admin and super admin. */
  team: TeamDashboard | null;
  /** Super admin: location comparison. */
  locations: LocationComparison[] | null;
  /** Super admin: staff overview. */
  staff: StaffOverview | null;
  /** Super admin: system health. */
  system: SystemHealth | null;
  generatedAt: string;
};

export function normalizeRoleDashboard(raw: any): RoleDashboard {
  const s = pick(raw, "sales");
  const t = pick(raw, "team");
  const l = pick(raw, "locations");
  const st = pick(raw, "staff");
  const sy = pick(raw, "system");
  return {
    role: str(raw, "role"),
    period: str(raw, "period") || "month",
    sales: s
      ? {
          quotationsCreated: num(s, "quotationsCreated"),
          draft: num(s, "draft"),
          sent: num(s, "sent"),
          accepted: num(s, "accepted"),
          agreementStage: num(s, "agreementStage"),
          converted: num(s, "converted"),
          lost: num(s, "lost"),
          convertedValue: num(s, "convertedValue"),
          conversionPct: num(s, "conversionPct"),
          awaitingSignature: list(pick(s, "awaitingSignature"), toAttention),
          pendingBookings: list(pick(s, "pendingBookings"), toAttention),
          newInquiries: num(s, "newInquiries"),
          inquiriesInPeriod: num(s, "inquiriesInPeriod"),
          followUpsDue: num(s, "followUpsDue"),
          convertedInquiries: num(s, "convertedInquiries"),
          followUps: list(pick(s, "followUps"), (f) => ({
            contactId: num(f, "contactId"),
            name: optStr(f, "name"),
            phone: optStr(f, "phone"),
            followUpOn: optStr(f, "followUpOn"),
            note: optStr(f, "note"),
          })),
          renewalDays: num(s, "renewalDays"),
          renewalsDue: num(s, "renewalsDue"),
          renewals: list(pick(s, "renewals"), toAttention),
          outstanding: num(s, "outstanding"),
          outstandingCount: num(s, "outstandingCount"),
          overdue: num(s, "overdue"),
          overdueCount: num(s, "overdueCount"),
          overdueInvoices: list(pick(s, "overdueInvoices"), toAttention),
        }
      : null,
    team: t
      ? {
          openComplaints: num(t, "openComplaints"),
          unreadWhatsApp: num(t, "unreadWhatsApp"),
          newInquiries: num(t, "newInquiries"),
          kycPending: num(t, "kycPending"),
          accessSuspended: num(t, "accessSuspended"),
          machinesOffline: num(t, "machinesOffline"),
          machines: num(t, "machines"),
          offlineMachines: list(pick(t, "offlineMachines"), (m) => ({ name: str(m, "name"), lastSeen: optStr(m, "lastSeen") })),
        }
      : null,
    locations: Array.isArray(l)
      ? l.map((x: any) => ({
          locationId: num(x, "locationId"),
          name: str(x, "name"),
          totalSpaces: num(x, "totalSpaces"),
          occupiedSpaces: num(x, "occupiedSpaces"),
          occupancyPct: num(x, "occupancyPct"),
          activeBookings: num(x, "activeBookings"),
          invoiced: num(x, "invoiced"),
          collected: num(x, "collected"),
          outstanding: num(x, "outstanding"),
          overdue: num(x, "overdue"),
        }))
      : null,
    staff: st
      ? {
          perLocation: list(pick(st, "perLocation"), (x) => ({
            locationId: num(x, "locationId"),
            name: str(x, "name"),
            admins: num(x, "admins"),
            salesExecutives: num(x, "salesExecutives"),
          })),
          people: list(pick(st, "people"), (x) => ({
            userId: num(x, "userId"),
            name: str(x, "name"),
            role: str(x, "role"),
            locations: optStr(x, "locations"),
            quotations: num(x, "quotations"),
            converted: num(x, "converted"),
            convertedValue: num(x, "convertedValue"),
          })),
        }
      : null,
    system: sy
      ? {
          hikSyncEnabled: bool(sy, "hikSyncEnabled"),
          hikJobs: list(pick(sy, "hikJobs"), (j) => ({
            job: str(j, "job"),
            lastFinishedAt: optStr(j, "lastFinishedAt"),
            lastOk: pick(j, "lastOk") == null ? null : bool(j, "lastOk"),
            lastResult: optStr(j, "lastResult"),
            running: bool(j, "running"),
          })),
          machines: num(sy, "machines"),
          machinesOffline: num(sy, "machinesOffline"),
          lastMachineSeen: optStr(sy, "lastMachineSeen"),
          whatsAppConfigured: bool(sy, "whatsAppConfigured"),
          lastWhatsAppMessage: optStr(sy, "lastWhatsAppMessage"),
          emailPending: num(sy, "emailPending"),
          emailFailed: num(sy, "emailFailed"),
        }
      : null,
    generatedAt: str(raw, "generatedAt"),
  };
}

/**
 * GET dashboard/role?period=&locationIds= — role sections (sales executive: pipeline, inquiries & follow-ups,
 * renewals, collections; admin: team & service; super admin: also location comparison, staff, system health).
 * Roles: sales executive, admin, super admin.
 */
export async function getRoleDashboard(scope: DashboardScope = {}): Promise<RoleDashboard> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.dashboard.role, { period: scope.period ?? "month", locationIds: idList(scope.locationIds) }),
  );
  return normalizeRoleDashboard(raw);
}

// ─── GET dashboard/overview ───────────────────────────────────────────────────────────────────────────────

export type DashboardOverview = {
  totalSpaces: number;
  occupiedSpaces: number;
  occupiedSpacesLastMonth: number;
  occupancyPct: number;
  occupancyPctLastMonth: number;
  activeBookings: number;
  activeBookingsLastMonth: number;
  pendingConfirmations: number;
  outstanding: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  period: string;
  invoicedThisPeriod: number;
  invoicedPrevPeriod: number;
  paidThisPeriod: number;
  leasesEndingSoon: number;
  endingSoonDays: number;
  /** month = yyyy-MM */
  months: { month: string; invoiced: number; paid: number; occupancyPct: number; newBookings: number }[];
  overdueInvoices: AttentionItem[];
  endingLeases: AttentionItem[];
  pendingBookings: AttentionItem[];
  aging: { label: string; amount: number; count: number }[];
  spaceTypes: { spaceType: string; total: number; occupied: number }[];
  topCustomers: { label: string; amount: number; count: number }[];
  leaseExpiries: { label: string; amount: number; count: number }[];
  generatedAt: string;
};

const toBucket = (b: any) => ({ label: str(b, "label"), amount: num(b, "amount"), count: num(b, "count") });

export function normalizeDashboardOverview(raw: any): DashboardOverview {
  return {
    totalSpaces: num(raw, "totalSpaces"),
    occupiedSpaces: num(raw, "occupiedSpaces"),
    occupiedSpacesLastMonth: num(raw, "occupiedSpacesLastMonth"),
    occupancyPct: num(raw, "occupancyPct"),
    occupancyPctLastMonth: num(raw, "occupancyPctLastMonth"),
    activeBookings: num(raw, "activeBookings"),
    activeBookingsLastMonth: num(raw, "activeBookingsLastMonth"),
    pendingConfirmations: num(raw, "pendingConfirmations"),
    outstanding: num(raw, "outstanding"),
    outstandingCount: num(raw, "outstandingCount"),
    overdueAmount: num(raw, "overdueAmount"),
    overdueCount: num(raw, "overdueCount"),
    period: str(raw, "period") || "month",
    invoicedThisPeriod: num(raw, "invoicedThisPeriod"),
    invoicedPrevPeriod: num(raw, "invoicedPrevPeriod"),
    paidThisPeriod: num(raw, "paidThisPeriod"),
    leasesEndingSoon: num(raw, "leasesEndingSoon"),
    endingSoonDays: num(raw, "endingSoonDays"),
    months: list(pick(raw, "months"), (m) => ({
      month: str(m, "month"),
      invoiced: num(m, "invoiced"),
      paid: num(m, "paid"),
      occupancyPct: num(m, "occupancyPct"),
      newBookings: num(m, "newBookings"),
    })),
    overdueInvoices: list(pick(raw, "overdueInvoices"), toAttention),
    endingLeases: list(pick(raw, "endingLeases"), toAttention),
    pendingBookings: list(pick(raw, "pendingBookings"), toAttention),
    aging: list(pick(raw, "aging"), toBucket),
    spaceTypes: list(pick(raw, "spaceTypes"), (x) => ({
      spaceType: str(x, "spaceType"),
      total: num(x, "total"),
      occupied: num(x, "occupied"),
    })),
    topCustomers: list(pick(raw, "topCustomers"), toBucket),
    leaseExpiries: list(pick(raw, "leaseExpiries"), toBucket),
    generatedAt: str(raw, "generatedAt"),
  };
}

/**
 * GET dashboard/overview?period=&locationIds= — headline numbers, 6/12/24-month trend and "needs attention"
 * lists. Roles: sales executive, admin, super admin (the CMS shows it to admins and super admins).
 */
export async function getDashboardOverview(scope: DashboardScope = {}): Promise<DashboardOverview> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.dashboard.overview, { period: scope.period ?? "month", locationIds: idList(scope.locationIds) }),
  );
  return normalizeDashboardOverview(raw);
}

// ─── GET dashboard/forecast ───────────────────────────────────────────────────────────────────────────────

export type ForecastMonth = {
  /** yyyy-MM */
  month: string;
  /** e.g. "Nov 2026" */
  label: string;
  expectedRent: number;
  confirmedRent: number;
  totalSpaces: number;
  occupiedSpaces: number;
  occupancyPct: number;
  leasesEnding: number;
  leasesStarting: number;
  pendingStarting: number;
};

export type DashboardForecast = {
  months: number;
  fromMonth: string;
  totals: ForecastMonth[];
  /** Filled only when more than one location is in scope. */
  locations: { locationId: number; name: string; months: ForecastMonth[] }[];
  generatedAt: string;
};

const toForecastMonth = (m: any): ForecastMonth => ({
  month: str(m, "month"),
  label: str(m, "label"),
  expectedRent: num(m, "expectedRent"),
  confirmedRent: num(m, "confirmedRent"),
  totalSpaces: num(m, "totalSpaces"),
  occupiedSpaces: num(m, "occupiedSpaces"),
  occupancyPct: num(m, "occupancyPct"),
  leasesEnding: num(m, "leasesEnding"),
  leasesStarting: num(m, "leasesStarting"),
  pendingStarting: num(m, "pendingStarting"),
});

export function normalizeDashboardForecast(raw: any): DashboardForecast {
  return {
    months: num(raw, "months"),
    fromMonth: str(raw, "fromMonth"),
    totals: list(pick(raw, "totals"), toForecastMonth),
    locations: list(pick(raw, "locations"), (l) => ({
      locationId: num(l, "locationId"),
      name: str(l, "name"),
      months: list(pick(l, "months"), toForecastMonth),
    })),
    generatedAt: str(raw, "generatedAt"),
  };
}

/**
 * The forecast rows for the chosen location chip (0 = all): that location's months, or the totals when the
 * choice is 0 or no longer in the forecast (the dashboard's location changed under it). `locationId` is the
 * choice actually shown.
 */
export function forecastRowsFor(forecast: DashboardForecast, locationId: number): { locationId: number; rows: ForecastMonth[] } {
  const location = locationId ? forecast.locations.find((l) => l.locationId === locationId) : undefined;
  return location ? { locationId, rows: location.months } : { locationId: 0, rows: forecast.totals };
}

/**
 * GET dashboard/forecast?months=&locationIds= — revenue & occupancy forecast for the next N months (default 3,
 * at most 12) from current leases. Roles: sales executive, admin, super admin.
 */
export async function getDashboardForecast(
  options: { locationIds?: readonly number[]; months?: number } = {},
): Promise<DashboardForecast> {
  const raw = await staffGet(
    withQuery(STAFF_ENDPOINTS.dashboard.forecast, { months: options.months ?? 3, locationIds: idList(options.locationIds) }),
  );
  return normalizeDashboardForecast(raw);
}

// ─── Nav badges ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Items waiting on staff, keyed by CMS sidebar route ({ "/admin/bookings": 2, "/admin/contacts": 1, ... }).
 * Only positive whole counts are kept (CMS admin-layout loadBadges).
 */
export type NavBadges = Record<string, number>;

export function normalizeNavBadges(raw: unknown): NavBadges {
  const out: NavBadges = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [route, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) out[route] = Math.floor(n);
    }
  }
  return out;
}

/**
 * GET admin/nav-badges. Role- and location-scoped by the API; only routes the user can open are returned
 * (admins also get pending capacity requests on "/admin/attendants"). Roles: sales executive, admin, super admin.
 */
export async function getNavBadges(): Promise<NavBadges> {
  return normalizeNavBadges(await staffGet(STAFF_ENDPOINTS.dashboard.navBadges));
}

/** POST admin/nav-badges/read { routes } — "mark as read"; no routes = every badge the user can see. */
export async function markNavBadgesRead(routes?: string[]): Promise<ActionResult> {
  const raw = await staffPost(STAFF_ENDPOINTS.dashboard.navBadgesRead, { routes: routes ?? [] });
  return actionResult(raw, "Marked as read.");
}

// ─── Door access card ─────────────────────────────────────────────────────────────────────────────────────

/**
 * GET access-suspensions/overview — the dashboard "Door access" card: machines online / offline, queued
 * operations, suspended bookings. Roles: sales executive, admin, super admin (bookings limited to the user's
 * locations). Shape is passed through (stage 2 types it with the access screens).
 */
export async function getAccessOverview(): Promise<Record<string, any>> {
  const raw = await staffGet<Record<string, any>>(STAFF_ENDPOINTS.dashboard.accessOverview);
  return raw && typeof raw === "object" ? raw : {};
}

// ─── Trends (CMS dashboard-overview trend()) ─────────────────────────────────────────────────────────────

export type DashboardTrend = { direction: "up" | "down" | "flat"; label: string; upIsGood: boolean };

/**
 * Change vs the previous period: "pts" (percentage points), "n" (count) or "%" (relative change).
 * undefined when both are zero; "new" when there was nothing before (relative change).
 */
export function dashboardTrend(now: number, prev: number, unit: "pts" | "n" | "%", upIsGood = true): DashboardTrend | undefined {
  if (!now && !prev) return undefined;
  let diff: number;
  let label: string;
  if (unit === "%") {
    if (!prev) return { direction: "up", label: "new", upIsGood };
    diff = ((now - prev) / prev) * 100;
    label = `${Math.abs(diff).toFixed(0)}%`;
  } else {
    diff = now - prev;
    label = unit === "pts" ? `${Math.abs(diff).toFixed(1)} pts` : `${Math.abs(diff)}`;
  }
  if (Math.abs(diff) < 0.05) return { direction: "flat", label: "no change", upIsGood };
  return { direction: diff > 0 ? "up" : "down", label: `${label} vs last period`, upIsGood };
}
