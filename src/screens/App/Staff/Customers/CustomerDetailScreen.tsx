import { Fragment, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  InfoRow,
  ListRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  getCustomer,
  listCustomerInvoices,
  listCustomerQuotations,
  type StaffCustomer,
  type StaffInvoice,
  type StaffQuotation,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { useRefreshColors } from "../shared/refresh";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "CustomerDetail">;

type CustomerBundle = {
  customer: StaffCustomer;
  quotations: StaffQuotation[] | null;
  invoices: StaffInvoice[] | null;
  quotationsError: string | null;
  invoicesError: string | null;
};

/** Rows shown per list; coming back to the screen reloads only data older than STALE_MS (or after an edit). */
const LIST_SIZE = 10;
const STALE_MS = 30_000;

/**
 * One customer (GET customer/{id}) with shortcuts (KYC, quotation, booking, attendants), their latest quotations
 * (GET quotation/by-customer/{id}?page=1&limit=10) and invoices (GET customer/{id}/invoices).
 */
export default function CustomerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const refreshColors = useRefreshColors();
  const listRow = params.customer;

  const fetcher = useCallback(async (): Promise<CustomerBundle> => {
    // The id is known up front for int ids: load the customer and both lists together.
    const knownId = typeof params.customerId === "number" ? params.customerId : null;
    const lists = (id: number) =>
      Promise.allSettled([
        listCustomerQuotations(id, { page: 1, limit: LIST_SIZE }),
        listCustomerInvoices(id, { page: 1, limit: LIST_SIZE }),
      ]);
    const early = knownId ? lists(knownId) : null;
    const customer = await getCustomer(params.customerId, { listRow, taxIds: true });
    const [quotations, invoices] = await (early ?? lists(customer.id));
    const reason = (r: PromiseSettledResult<unknown>) =>
      r.status === "rejected" ? errorMessage(r.reason, "Could not load this list.") : null;
    return {
      customer,
      quotations: quotations.status === "fulfilled" ? quotations.value.items.slice(0, LIST_SIZE) : null,
      invoices: invoices.status === "fulfilled" ? invoices.value.items : null,
      quotationsError: reason(quotations),
      invoicesError: reason(invoices),
    };
  }, [params.customerId, listRow]);
  const { data, loading, refreshing, error, reload, refresh, markStale } = useAsyncData(fetcher, {
    reloadOnFocus: true,
    staleAfterMs: STALE_MS,
  });
  const c = data?.customer;
  /** Opens a screen that can change this customer's data: reload when coming back, however recent. */
  const openForChange = (go: () => void) => {
    markStale();
    go();
  };

  return (
    <StaffScreen>
      <AppHeader
        title={c?.fullName || "Customer"}
        subtitle={c?.code || undefined}
        actions={
          c
            ? [{ icon: "create-outline", accessibilityLabel: "Edit customer", onPress: () => openForChange(() => navigation.navigate("CustomerForm", { customerId: c.id, customer: c })) }]
            : undefined
        }
      />
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : c && data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />}
        >
          <Card>
            <View style={styles.titleRow}>
              <AppText variant="subheading" style={styles.flex}>
                {c.customerType === "Individual" ? "Individual" : c.customerType === "AOP" ? "AOP" : "Company"}
              </AppText>
              <StatusPill status={c.isActive ? "Active" : "Inactive"} />
            </View>
            <Divider spacing={8} />
            {c.company ? <InfoRow label="Company" value={c.company} icon="business-outline" /> : null}
            <InfoRow label="Email" value={c.email || "—"} icon="mail-outline" />
            <InfoRow label="Phone" value={c.phoneNumber || "—"} icon="call-outline" />
            <InfoRow label="CNIC" value={c.cnicOrPassport || "—"} icon="card-outline" />
            {c.ntn ? <InfoRow label="NTN" value={c.ntn} icon="document-outline" /> : null}
            {c.secpRegistrationNo ? <InfoRow label="SECP reg. no." value={c.secpRegistrationNo} /> : null}
            <InfoRow label="Address" value={c.address || "—"} icon="location-outline" layout="stacked" />
            {c.cityName ? <InfoRow label="City" value={c.cityName} /> : null}
            {c.notes ? <InfoRow label="Notes" value={c.notes} layout="stacked" /> : null}
            {c.createdAt ? <InfoRow label="Added" value={formatDate(c.createdAt)} /> : null}
          </Card>

          <Card padding={0}>
            <ListRow leftIcon="id-card-outline" title="KYC documents" onPress={() => navigation.navigate("KycCustomer", { customerId: c.id, customerName: c.fullName })} />
            <Divider inset={68} />
            <ListRow leftIcon="document-text-outline" title="New quotation" onPress={() => openForChange(() => navigation.navigate("QuotationForm", { customerId: c.id }))} />
            <Divider inset={68} />
            <ListRow leftIcon="calendar-outline" title="New booking" onPress={() => openForChange(() => navigation.navigate("BookingForm", { customerId: c.id }))} />
            <Divider inset={68} />
            <ListRow leftIcon="people-circle-outline" title="Attendants & access" onPress={() => navigation.navigate("Attendants", { customerId: c.id })} />
          </Card>

          <SectionHeader title="Quotations" variant="overline" />
          {data.quotationsError ? (
            <ErrorState compact message={data.quotationsError} onRetry={refresh} />
          ) : !data.quotations?.length ? (
            <EmptyState compact illustration="document" title="No quotations yet" />
          ) : (
            <Card padding={0}>
              {data.quotations.map((q, i) => (
                <Fragment key={q.id}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    title={`${q.quotationNumber} · v${q.version}`}
                    subtitle={[q.spaceName, formatMoney(q.totalAmount)].filter(Boolean).join(" · ")}
                    right={<StatusPill status={q.status} />}
                    onPress={() => openForChange(() => navigation.navigate("QuotationDetail", { quotationId: q.id }))}
                  />
                </Fragment>
              ))}
            </Card>
          )}

          <SectionHeader title="Invoices" variant="overline" />
          {data.invoicesError ? (
            <ErrorState compact message={data.invoicesError} onRetry={refresh} />
          ) : !data.invoices?.length ? (
            <EmptyState compact illustration="receipt" title="No invoices yet" />
          ) : (
            <Card padding={0}>
              {data.invoices.map((inv, i) => (
                <Fragment key={inv.id}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    title={inv.invoiceNumber}
                    subtitle={`${formatMoney(inv.grandTotal)} · due ${formatDate(inv.dueOn)}`}
                    right={<StatusPill status={inv.status} />}
                    onPress={() => navigation.navigate("InvoiceDetail", { invoiceId: inv.id, invoice: inv })}
                  />
                </Fragment>
              ))}
            </Card>
          )}
        </ScrollView>
      ) : null}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
