import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, BottomSheet, Button, Card, InfoRow, StatusPill } from "../../../../components/ui";
import { canOpenRoute } from "../../../../navigation/staff/access";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listPayments, type StaffPayment } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatDateTime, formatMoney } from "../../../../utils/format";
import { ActiveFilterChips, ListFilterSheet, filteredEmpty, useListFilters } from "../shared/ListFilters";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffRole } from "../shared/StaffSession";
import { useDebounced, usePagedList } from "../shared/hooks";
import { useStackedMeta } from "../shared/layout";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 20;

/**
 * Payments (GET payment?page=&limit=&search=&locationId=&status=&from=&to=; CMS Payments page, admins and super
 * admins): newest first, search by customer or transaction reference, filter by location, status and payment date
 * (on the server, ../shared/ListFilters). Read-only: a payment with an invoice opens that invoice, any other one a
 * detail sheet.
 */
export default function PaymentListScreen() {
  const navigation = useNavigation<Nav>();
  const role = useStaffRole();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<StaffPayment | null>(null);
  const search = useDebounced(query.trim());
  const filter = useListFilters("payments");
  const { filters } = filter;
  const fetchPage = useCallback((page: number) => listPayments({ page, limit: PAGE_SIZE, search, ...filters }), [search, filters]);
  const list = usePagedList(fetchPage);

  const open = (payment: StaffPayment) => {
    if (payment.invoiceId != null && canOpenRoute(role, "InvoiceDetail")) {
      navigation.navigate("InvoiceDetail", { invoiceId: payment.invoiceId });
    } else {
      setShown(payment);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title="Payments" subtitle={list.total ? `${list.total} payments` : undefined} actions={[filter.headerAction]} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer or reference" />
      <ActiveFilterChips state={filter} />
      <AsyncList
        data={list.items}
        keyExtractor={(p) => String(p.id || p.publicId)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={
          filteredEmpty(filter, "payments", search) ?? {
            illustration: search ? "search" : "receipt",
            title: search ? "No payments found" : "No payments yet",
            message: search ? `Nothing matches "${search}".` : undefined,
          }
        }
        renderItem={({ item }) => <PaymentCard payment={item} onPress={() => open(item)} />}
      />
      <ListFilterSheet state={filter} />
      {shown ? (
        <PaymentSheet
          payment={shown}
          onClose={() => setShown(null)}
          onOpenBooking={
            shown.bookingId != null && canOpenRoute(role, "BookingDetail")
              ? () => {
                  const bookingId = shown.bookingId as number;
                  setShown(null);
                  navigation.navigate("BookingDetail", { bookingId });
                }
              : undefined
          }
        />
      ) : null}
    </StaffScreen>
  );
}

/** Challan number, else the transaction reference (CMS "Challan / Ref"). */
const reference = (p: StaffPayment) => p.challanNumber || p.transactionRef;

function PaymentCard({ payment: p, onPress }: { payment: StaffPayment; onPress: () => void }) {
  // Large text on a narrow phone: the status and the amount go under the text beside them.
  const stacked = useStackedMeta();
  const name = p.customerName || "Customer";
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Payment of ${formatMoney(p.amount, { currency: p.currencyCode })}, ${name}, ${p.status}`}
      accessibilityHint={p.invoiceId != null ? "Opens the invoice" : "Shows the payment details"}
    >
      <View style={stacked ? styles.stack : styles.row}>
        <View style={stacked ? undefined : styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={stacked ? 2 : 1}>
            {name}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[p.bookingId != null ? `Booking #${p.bookingId}` : null, reference(p)].filter(Boolean).join(" · ") || `Payment #${p.id}`}
          </AppText>
        </View>
        <StatusPill status={p.status} />
      </View>
      <View style={[stacked ? styles.stack : styles.row, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={stacked ? undefined : styles.flex} numberOfLines={stacked ? 2 : 1}>
          {[p.methodLabel, formatDate(p.paymentDate)].filter(Boolean).join(" · ")}
        </AppText>
        <AppText variant="amount" numberOfLines={1} style={styles.shrink}>
          {formatMoney(p.amount, { currency: p.currencyCode })}
        </AppText>
      </View>
    </Card>
  );
}

/** A payment without an invoice: what the list row knows about it (read-only). */
function PaymentSheet({ payment: p, onClose, onOpenBooking }: { payment: StaffPayment; onClose: () => void; onOpenBooking?: () => void }) {
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title="Payment"
      subtitle={p.customerName || undefined}
      footer={
        onOpenBooking ? (
          <Button title="Open booking" variant="outline" leftIcon="calendar-outline" onPress={onOpenBooking} fullWidth />
        ) : undefined
      }
    >
      <View style={styles.sheet}>
        <InfoRow label="Amount" value={formatMoney(p.amount, { currency: p.currencyCode })} emphasize />
        <InfoRow label="Status" value={<StatusPill status={p.status} />} />
        <InfoRow label="Method" value={p.methodLabel} icon="card-outline" />
        <InfoRow label="Paid on" value={p.paidOn ? formatDateTime(p.paidOn) : null} icon="calendar-outline" />
        <InfoRow label="Created" value={p.createdOn ? formatDateTime(p.createdOn) : null} icon="time-outline" />
        {p.customerEmail ? <InfoRow label="Email" value={p.customerEmail} icon="mail-outline" /> : null}
        {p.bookingId != null ? <InfoRow label="Booking" value={`#${p.bookingId}`} icon="calendar-outline" /> : null}
        {p.spaceName ? <InfoRow label="Space" value={p.spaceName} icon="business-outline" /> : null}
        {p.challanNumber ? <InfoRow label="Challan" value={p.challanNumber} icon="receipt-outline" /> : null}
        {p.transactionRef ? <InfoRow label="Transaction ref" value={p.transactionRef} icon="document-text-outline" /> : null}
        {p.gatewayRef ? <InfoRow label="Gateway ref" value={p.gatewayRef} icon="document-text-outline" /> : null}
        {p.notes ? <InfoRow label="Notes" value={p.notes} layout="stacked" icon="chatbox-outline" /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stack: { alignItems: "flex-start", gap: spacing.xs },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  gapTop: { marginTop: spacing.sm },
  sheet: { gap: spacing.sm },
});
