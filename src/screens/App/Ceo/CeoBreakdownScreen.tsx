import { useCallback } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import {
  BREAKDOWN_ROOTS,
  count,
  getCeoBreakdown,
  isOccupiedOnly,
  metricUnit,
  occupiedRowsOnly,
  money,
  pct,
  recordsForBreakdownRow,
  shareOf,
  type CeoBreakdown,
  type CeoBreakdownQuery,
  type CeoBreakdownRow,
} from "../../../services/ceo";
import { BreakdownView } from "./BreakdownView";

type Nav = NativeStackNavigationProp<CeoStackParamList, "CeoBreakdown">;
type Route = RouteProp<CeoStackParamList, "CeoBreakdown">;

/** Occupancy breakdowns show occupied of total spaces. */
const isOccupancy = (query: CeoBreakdownQuery) => query.metric === "occupancy-type" || query.metric === "occupancy-location";

/** "Invoiced PKR 1.2M · Collected PKR 900K · 4 invoices" (occupancy: "72% · 18 of 25 spaces"). */
function rowDetail(query: CeoBreakdownQuery, b: CeoBreakdown, row: CeoBreakdownRow, format: (v: number) => string): string {
  if (isOccupancy(query) && row.value2 != null) {
    return `${pct(shareOf(row.value, row.value2))} · ${count(row.value)} of ${count(row.value2)} spaces in use`;
  }
  const parts = [`${b.valueLabel} ${format(row.value)}`];
  if (row.value2 != null && b.value2Label) parts.push(`${b.value2Label} ${format(row.value2)}`);
  if (row.count != null) parts.push(`${count(row.count)} ${metricUnit(query.metric) === "money" ? (row.count === 1 ? "invoice" : "invoices") : "in total"}`);
  return parts.join(" · ");
}

/**
 * Drill level 2 (GET api/ceo/breakdown): one dashboard element split by location, space type or month, as a small
 * column chart and a list (./BreakdownView). Tapping a column or a row opens its records (level 3). Read-only.
 */
export default function CeoBreakdownScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel, recordsParams } = params;
  // From the Occupancy tile: only the space types with an occupied room (their records: the occupied rooms).
  const occupiedOnly = isOccupiedOnly(recordsParams);
  const load = useCallback(
    () => getCeoBreakdown(query).then((b) => (occupiedOnly ? occupiedRowsOnly(b) : b)),
    [query, occupiedOnly],
  );
  const format = metricUnit(query.metric) === "money" ? money : (v: number) => count(v);

  return (
    <BreakdownView
      fallbackTitle={BREAKDOWN_ROOTS[query.metric]}
      trail={trail}
      scopeLabel={scopeLabel}
      load={load}
      format={format}
      rowDetail={(b, row) => rowDetail(query, b, row, format)}
      rowMeta={isOccupancy(query) ? () => undefined : (row) => format(row.value)}
      recordsFor={(row) => recordsForBreakdownRow(query, row, recordsParams)}
      onOpenRecords={(row, records) => navigation.push("CeoRecords", { query: records, trail: [...trail, row.label], scopeLabel })}
    />
  );
}
