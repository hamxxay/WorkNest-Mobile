import type { CeoBreakdownQuery, CeoRecordsQuery } from "../services/ceo";

// Routes of the CEO app (role "ceo"): one stack, nothing else. The CEO never gets the customer (./types.ts) or staff
// (./staffTypes.ts) routes: its navigator (./ceo/CeoNavigator.tsx) registers only these four screens.
//
//   CeoDashboard  (root) Money, Occupancy, Sales, Team, 3-month outlook; period and location filters
//   CeoBreakdown  drill level 2: a chart element's breakdown (GET api/ceo/breakdown)
//   CeoRecords    drill level 3: a read-only list (GET api/ceo/records/*)
//   CeoProfile    name, role, appearance, sign out

/** Shown under each drill screen's title: where the CEO came from and the scope. */
export type CeoDrillContext = {
  /** Breadcrumb, e.g. ["Revenue", "Oct 2026", "I-8"]. */
  trail: string[];
  /** Period and location, e.g. "October 2026 · All locations". */
  scopeLabel?: string;
};

export type CeoStackParamList = {
  CeoDashboard: undefined;
  CeoBreakdown: CeoDrillContext & { query: CeoBreakdownQuery };
  CeoRecords: CeoDrillContext & { query: CeoRecordsQuery; title?: string };
  CeoProfile: undefined;
};

export type CeoRouteName = keyof CeoStackParamList;
