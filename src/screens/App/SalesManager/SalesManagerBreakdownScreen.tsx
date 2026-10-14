import { useCallback } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { count, money, type CeoBreakdown, type CeoBreakdownRow } from "../../../services/ceo";
import {
  SM_BREAKDOWN_ROOTS,
  getSalesManagerBreakdown,
  salesManagerErrorView,
  smMetricUnits,
  smRecordsForBreakdownRow,
  type SmUnit,
} from "../../../services/salesManager";
import { BreakdownView } from "../Ceo/BreakdownView";

type Nav = NativeStackNavigationProp<SalesManagerStackParamList, "SalesManagerBreakdown">;
type Route = RouteProp<SalesManagerStackParamList, "SalesManagerBreakdown">;

const formatter = (unit: SmUnit) => (unit === "money" ? money : (v: number) => count(v));

/**
 * Drill level 2 (GET api/sales-manager/breakdown): a dashboard element split by location or month, as a small
 * column chart and a list (the CEO's BreakdownView). Tapping a column or a row opens its records. Read-only.
 */
export default function SalesManagerBreakdownScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel } = params;
  const load = useCallback(() => getSalesManagerBreakdown(query), [query]);
  const units = smMetricUnits(query.metric);
  const format = formatter(units.value);
  const format2 = formatter(units.value2 ?? units.value);

  /** "Bookings 3 · Quotations 10" (renewals: "Expiring leases 2 · Monthly value PKR 180K"). */
  const rowDetail = (b: CeoBreakdown, row: CeoBreakdownRow) => {
    const parts = [`${b.valueLabel} ${format(row.value)}`];
    if (row.value2 != null && b.value2Label) parts.push(`${b.value2Label} ${format2(row.value2)}`);
    if (row.count != null) parts.push(`${count(row.count)} in total`);
    return parts.join(" · ");
  };

  return (
    <BreakdownView
      fallbackTitle={SM_BREAKDOWN_ROOTS[query.metric]}
      trail={trail}
      scopeLabel={scopeLabel}
      load={load}
      format={format}
      // Leases and their monthly PKR value are not drawn on one axis (the list shows both).
      plotValue2={units.value2 === units.value}
      rowDetail={rowDetail}
      // Mixed units (renewals): the monthly value on the right, the lease count in the line under the name.
      rowMeta={units.value2 && units.value2 !== units.value ? (row) => (row.value2 != null ? format2(row.value2) : format(row.value)) : undefined}
      recordsFor={(row) => smRecordsForBreakdownRow(query, row)}
      onOpenRecords={(row, records) => navigation.push("SalesManagerRecords", { query: records, trail: [...trail, row.label], scopeLabel })}
      describeError={salesManagerErrorView}
    />
  );
}
