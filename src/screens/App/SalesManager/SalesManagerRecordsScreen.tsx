import { useCallback } from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { SalesManagerStackParamList } from "../../../navigation/salesManagerTypes";
import { getSalesManagerRecords, salesManagerErrorView, smRecordCards } from "../../../services/salesManager";
import { RecordsView, type RecordCardList } from "../Ceo/RecordsView";

type Route = RouteProp<SalesManagerStackParamList, "SalesManagerRecords">;

/**
 * Drill level 3 (GET api/sales-manager/records/*): the quotations, bookings, tour inquiries or expiring leases
 * behind a figure, newest first (at most 200, "Showing x of total"). Read-only cards, no actions (the CEO's
 * RecordsView).
 */
export default function SalesManagerRecordsScreen() {
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel, title } = params;
  const load = useCallback(
    () => getSalesManagerRecords(query).then((r): RecordCardList => ({ title: r.title, total: r.total, cards: smRecordCards(r) })),
    [query],
  );
  return (
    <RecordsView fallbackTitle={title ?? "Records"} trail={trail} scopeLabel={scopeLabel} load={load} describeError={salesManagerErrorView} />
  );
}
