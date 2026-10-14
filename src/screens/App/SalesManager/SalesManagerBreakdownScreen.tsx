import { useCallback } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { count } from "../../../services/ceo";
import {
  SM_BREAKDOWN_ROOTS,
  getSalesManagerBreakdown,
  salesManagerErrorView,
  smBreakdownRowDetail,
  smBreakdownRowFigure,
  smRecordsForBreakdownRow,
} from "../../../services/salesManager";
import { BreakdownView } from "../Ceo/BreakdownView";

type Nav = NativeStackNavigationProp<SalesManagerStackParamList, "SalesManagerBreakdown">;
type Route = RouteProp<SalesManagerStackParamList, "SalesManagerBreakdown">;

/** Chart values as plain whole numbers (the series labels carry the words: "Desks booked 91, Bookings 17"). */
const plain = (v: number) => count(v);

/**
 * Drill level 2 (GET api/sales-manager/breakdown): a dashboard element split by location or month, as a small
 * column chart and a list (the CEO's BreakdownView). Tapping a column or a row opens its records. Read-only, and
 * no money: every figure is a desk count or a plain count (both values share the chart's axis).
 */
export default function SalesManagerBreakdownScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel } = params;
  const load = useCallback(() => getSalesManagerBreakdown(query), [query]);

  return (
    <BreakdownView
      fallbackTitle={SM_BREAKDOWN_ROOTS[query.metric]}
      trail={trail}
      scopeLabel={scopeLabel}
      load={load}
      format={plain}
      // Both values are whole counts (desks, bookings, leases...), so they share the chart's axis.
      plotValue2
      rowDetail={smBreakdownRowDetail}
      rowMeta={(row) => smBreakdownRowFigure(query.metric, row)}
      recordsFor={(row) => smRecordsForBreakdownRow(query, row)}
      onOpenRecords={(row, records) => navigation.push("SalesManagerRecords", { query: records, trail: [...trail, row.label], scopeLabel })}
      describeError={salesManagerErrorView}
    />
  );
}
