import { useCallback, useMemo } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import { drillListFormat, drillListRowDetail, type CeoBreakdown, type CeoDrillStep } from "../../../services/ceo";
import { BreakdownView } from "./BreakdownView";

type Nav = NativeStackNavigationProp<CeoStackParamList, "CeoList">;
type Route = RouteProp<CeoStackParamList, "CeoList">;

/**
 * Drill level 2 built from the dashboard's own figures (no API call): the months of the period behind Invoiced /
 * Collected, the aging buckets behind Outstanding, the locations behind Occupancy. Shown like a breakdown (a small
 * column chart and a list, ./BreakdownView); a row opens its breakdown or records. Read-only.
 */
export default function CeoListScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { list, trail, scopeLabel } = params;
  const breakdown = useMemo<CeoBreakdown>(
    () => ({ title: list.title, subtitle: list.subtitle, valueLabel: list.valueLabel, value2Label: list.value2Label, rows: list.rows }),
    [list],
  );
  const load = useCallback(() => Promise.resolve(breakdown), [breakdown]);
  const steps = useMemo(() => new Map(list.rows.map((r) => [r.key, r.open])), [list]);
  const format = drillListFormat(list);

  const open = (label: string, step: CeoDrillStep) => {
    const next = [...trail, label];
    if (step.kind === "breakdown") {
      navigation.push("CeoBreakdown", { query: step.query, recordsParams: step.recordsParams, trail: next, scopeLabel });
    } else {
      navigation.push("CeoRecords", { query: step.query, title: step.title, keepTitle: step.keepTitle, trail: next, scopeLabel });
    }
  };

  return (
    <BreakdownView<CeoDrillStep>
      fallbackTitle={list.title}
      trail={trail}
      scopeLabel={scopeLabel}
      load={load}
      format={format}
      rowDetail={(_b, row) => drillListRowDetail(list, row)}
      rowMeta={list.unit === "occupancy" ? () => undefined : (row) => format(row.value)}
      recordsFor={(row) => steps.get(row.key) ?? null}
      onOpenRecords={(row, step) => open(row.label, step)}
      rowAccessibilityHint={list.rowHint}
    />
  );
}
