import { useCallback } from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { CeoStackParamList } from "../../../navigation/ceoTypes";
import { getCeoRecords, recordCards } from "../../../services/ceo";
import { RecordsView, type RecordCardList } from "./RecordsView";

type Route = RouteProp<CeoStackParamList, "CeoRecords">;

/**
 * Drill level 3 (GET api/ceo/records/*): the invoices, spaces, bookings, tour inquiries or quotations behind a
 * figure, newest first (the API sends at most 200, "Showing x of total"). Read-only cards, no actions (./RecordsView).
 */
export default function CeoRecordsScreen() {
  const { params } = useRoute<Route>();
  const { query, trail, scopeLabel, title } = params;
  const load = useCallback(
    () => getCeoRecords(query).then((r): RecordCardList => ({ title: r.title, total: r.total, cards: recordCards(r) })),
    [query],
  );
  return <RecordsView fallbackTitle={title ?? "Records"} trail={trail} scopeLabel={scopeLabel} load={load} />;
}
