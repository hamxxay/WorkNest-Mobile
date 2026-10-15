import type { SmBreakdownQuery, SmRecordsQuery } from "../services/salesManager";
import type { CeoDrillContext } from "./ceoTypes";

// Routes of the Sales Manager app (role "sales_manager"): one stack, nothing else. The Sales Manager never gets the
// customer (./types.ts), staff (./staffTypes.ts) or CEO (./ceoTypes.ts) routes: its navigator
// (./salesManager/SalesManagerNavigator.tsx) registers only these four screens.
//
//   SalesManagerDashboard  (root) Sales funnel, Team performance, Tour inquiries, Renewals & desks;
//                          period and location (the manager's own) filters
//   SalesManagerBreakdown  drill level 2: a chart element's breakdown (GET api/sales-manager/breakdown)
//   SalesManagerRecords    drill level 3: a read-only list (GET api/sales-manager/records/*)
//   SalesManagerProfile    name, role, locations, appearance, sign out

/** Shown under each drill screen's title: where the manager came from and the scope (as on the CEO screens). */
export type SalesManagerDrillContext = CeoDrillContext;

export type SalesManagerStackParamList = {
  SalesManagerDashboard: undefined;
  SalesManagerBreakdown: SalesManagerDrillContext & { query: SmBreakdownQuery };
  SalesManagerRecords: SalesManagerDrillContext & { query: SmRecordsQuery; title?: string };
  /** `locations`: the names of the manager's locations, when the dashboard has loaded them. */
  SalesManagerProfile: { locations?: string[] } | undefined;
};

export type SalesManagerRouteName = keyof SalesManagerStackParamList;
