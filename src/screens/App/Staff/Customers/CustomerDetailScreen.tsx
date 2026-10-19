import { useCallback, useRef, useState } from "react";
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
  FilterChips,
  InfoRow,
  ListRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
  useToast,
} from "../../../../components/ui";
import { useReduceMotion } from "../../../../hooks/useReduceMotion";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  findAgreement,
  getCustomer,
  getCustomerOverview,
  listCustomerInvoices,
  listCustomerQuotations,
  loadSection,
  paymentsCount,
  type CustomerOverview,
  type Page,
  type SectionResult,
  type StaffInvoice,
  type StaffQuotation,
  type TimelineEvent,
  type TimelineTarget,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { useRefreshColors } from "../shared/refresh";
import {
  AgreementRow,
  BookingRow,
  DepositRow,
  PaymentRow,
  ReceiptRow,
  RowsCard,
  SHORT_LIST,
  SectionBody,
  ShowAllFooter,
  SubList,
  SummarySection,
  TimelineRow,
  type SectionState,
} from "./CustomerDetailSections";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "CustomerDetail">;

type TabKey = "bookings" | "quotations" | "invoices" | "payments" | "agreements" | "activity";

/** Rows of the quotation / invoice lists (their first page); coming back reloads only data older than STALE_MS (or after an edit). */
const LIST_SIZE = 10;
const STALE_MS = 30_000;
/** Events in the "Recent activity" card. */
const RECENT_EVENTS = 5;
const FOCUS_RELOAD = { reloadOnFocus: true, staleAfterMs: STALE_MS } as const;

/** The state of one section for SectionBody: loading until the customer id is known and the first answer is in. */
function sectionState<T>(id: number | null, s: { loading: boolean; data: SectionResult<T> | null }): SectionState<T> {
  return { loading: !id || (s.loading && !s.data), result: s.data };
}

/** Count shown on a section's chip once its list is in. */
function countOf<T>(result: SectionResult<T> | null, count: (data: T) => number): number | undefined {
  return result?.ok ? count(result.data) : undefined;
}

/**
 * One customer, as the CMS customer detail page (/admin/customers/:id): profile (GET customer/{id}), summary figures,
 * recent activity, and the sections Bookings, Quotations (GET quotation/by-customer/{id}), Invoices (GET
 * customer/{id}/invoices), Payments (fee receipts, payments, security deposits), Agreements and Activity. The overview
 * parts come from GET customer/{id}/overview. Every part loads and fails on its own: until the database script CD_01
 * has run the overview answers 503 and only its sections say so. Visibility is the API's (404 = not found, or a
 * customer of another location for location-bound staff). Read-only apart from the shortcuts; rows open the existing
 * booking, quotation, invoice and agreement screens.
 */
export default function CustomerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const refreshColors = useRefreshColors();
  const toast = useToast();
  const reduceMotion = useReduceMotion();
  const listRow = params.customer;
  const scrollRef = useRef<ScrollView>(null);
  const tabsY = useRef(0);
  const [tab, setTab] = useState<TabKey>("bookings");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [openingAgreement, setOpeningAgreement] = useState<number | null>(null);

  const profileFetcher = useCallback(
    () => loadSection(() => getCustomer(params.customerId, { listRow, taxIds: true })),
    [params.customerId, listRow],
  );
  const profile = useAsyncData(profileFetcher, FOCUS_RELOAD);
  const c = profile.data?.ok ? profile.data.data : null;
  // An int id is known up front: every section loads together with the profile. A GUID waits for the profile.
  const id = typeof params.customerId === "number" ? params.customerId : c?.id ?? null;

  const overviewFetcher = useCallback(async () => (id ? loadSection(() => getCustomerOverview(id)) : null), [id]);
  const quotationsFetcher = useCallback(
    async () => (id ? loadSection<Page<StaffQuotation>>(() => listCustomerQuotations(id, { page: 1, limit: LIST_SIZE })) : null),
    [id],
  );
  const invoicesFetcher = useCallback(
    async () => (id ? loadSection<Page<StaffInvoice>>(() => listCustomerInvoices(id, { page: 1, limit: LIST_SIZE })) : null),
    [id],
  );
  const overview = useAsyncData(overviewFetcher, FOCUS_RELOAD);
  const quotations = useAsyncData(quotationsFetcher, FOCUS_RELOAD);
  const invoices = useAsyncData(invoicesFetcher, FOCUS_RELOAD);

  const overviewState = sectionState<CustomerOverview>(id, overview);
  const quotationState = sectionState<Page<StaffQuotation>>(id, quotations);
  const invoiceState = sectionState<Page<StaffInvoice>>(id, invoices);
  const o = overview.data?.ok ? overview.data.data : null;

  const refreshing = profile.refreshing || overview.refreshing || quotations.refreshing || invoices.refreshing;
  const refreshAll = () => {
    profile.refresh();
    overview.refresh();
    quotations.refresh();
    invoices.refresh();
  };
  /** Opens a screen that can change this customer's data: reload when coming back, however recent. */
  const openForChange = (go: () => void) => {
    profile.markStale();
    overview.markStale();
    quotations.markStale();
    invoices.markStale();
    go();
  };
  const isExpanded = (key: string) => expanded.has(key);
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const visible = <T,>(rows: readonly T[], key: string) => (isExpanded(key) ? rows : rows.slice(0, SHORT_LIST));

  const openBooking = (bookingId: number) => openForChange(() => navigation.navigate("BookingDetail", { bookingId }));
  const openInvoice = (invoiceId: number, invoice?: StaffInvoice) =>
    openForChange(() => navigation.navigate("InvoiceDetail", { invoiceId, invoice }));
  const openQuotation = (quotationId: number) => openForChange(() => navigation.navigate("QuotationDetail", { quotationId }));
  /** The agreement screen needs the agreements-list row (the API has no GET agreement/{id}): find it, then open it. */
  const openAgreement = async (agreementId: number, quotationNumber: string | null) => {
    if (openingAgreement) return;
    setOpeningAgreement(agreementId);
    try {
      const agreement = await findAgreement(agreementId, [quotationNumber, c?.fullName, c?.cnicOrPassport]);
      if (agreement) openForChange(() => navigation.navigate("AgreementDetail", { agreement }));
      else toast.error("This agreement is not in your agreements list.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not open this agreement."));
    } finally {
      setOpeningAgreement(null);
    }
  };
  const openTarget = (target: TimelineTarget, event: TimelineEvent) => {
    if (target.kind === "booking") openBooking(target.bookingId);
    else if (target.kind === "invoice") openInvoice(target.invoiceId);
    else if (target.kind === "quotation") openQuotation(target.quotationId);
    else {
      // An agreement event's reference is its quotation number.
      const row = o?.agreements.find((a) => a.id === target.agreementId);
      openAgreement(target.agreementId, row?.quotationNumber || event.reference || null);
    }
  };
  const showAllActivity = () => {
    setTab("activity");
    setExpanded((prev) => new Set(prev).add("activity"));
    scrollRef.current?.scrollTo({ y: tabsY.current, animated: !reduceMotion });
  };

  const tabOptions: { label: string; value: TabKey; count?: number }[] = [
    { label: "Bookings", value: "bookings", count: countOf(overview.data, (d) => d.bookings.length) },
    { label: "Quotations", value: "quotations", count: countOf(quotations.data, (d) => d.total) },
    { label: "Invoices", value: "invoices", count: countOf(invoices.data, (d) => d.total) },
    { label: "Payments", value: "payments", count: countOf(overview.data, paymentsCount) },
    { label: "Agreements", value: "agreements", count: countOf(overview.data, (d) => d.agreements.length) },
    { label: "Activity", value: "activity", count: countOf(overview.data, (d) => d.timeline.length) },
  ];

  const profileError = profile.data && !profile.data.ok ? profile.data.error : null;

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
      {profile.loading && !profile.data ? (
        <ListSkeleton rows={4} />
      ) : profileError?.notFound ? (
        <EmptyState
          illustration="search"
          title="Customer not found"
          message="This customer does not exist, or belongs to a location you are not assigned to."
          actionLabel="Back"
          onAction={() => navigation.goBack()}
        />
      ) : profileError ? (
        <ErrorState message={profileError.message} onRetry={profile.reload} />
      ) : c ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} {...refreshColors} />}
        >
          <SummarySection state={overviewState} onRetry={overview.reload} />

          <SectionHeader title="Profile" variant="overline" />
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
            {o?.summary.locations ? <InfoRow label="Location" value={o.summary.locations} icon="navigate-outline" /> : null}
            {c.notes ? <InfoRow label="Notes" value={c.notes} layout="stacked" /> : null}
            {c.createdAt ? <InfoRow label="Customer since" value={formatDate(c.createdAt)} /> : null}
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

          <SectionHeader
            title="Recent activity"
            variant="overline"
            actionLabel={o?.timeline.length ? "See all" : undefined}
            onAction={o?.timeline.length ? showAllActivity : undefined}
          />
          <SectionBody
            state={overviewState}
            what="Activity"
            onRetry={overview.reload}
            isEmpty={(d) => !d.timeline.length}
            empty={{ illustration: "chart", title: "No activity yet", message: "Quotations, bookings, invoices and payments will show here." }}
          >
            {(d) => (
              <RowsCard
                rows={d.timeline.slice(0, RECENT_EVENTS)}
                keyOf={(e, i) => `${e.kind}-${e.action}-${e.refId ?? ""}-${e.at ?? ""}-${i}`}
                render={(e) => <TimelineRow event={e} onOpen={openTarget} />}
              />
            )}
          </SectionBody>

          <View
            style={styles.tabs}
            onLayout={(event) => {
              tabsY.current = event.nativeEvent.layout.y;
            }}
          >
            <SectionHeader title="Customer records" variant="overline" />
            <FilterChips value={tab} onChange={setTab} options={tabOptions} accessibilityLabel="Customer records" />
          </View>

          {tab === "bookings" ? (
            <SectionBody
              state={overviewState}
              what="Bookings"
              onRetry={overview.reload}
              isEmpty={(d) => !d.bookings.length}
              empty={{ illustration: "calendar", title: "No bookings yet", message: "Bookings made for this customer will show here." }}
            >
              {(d) => (
                <>
                  <RowsCard rows={visible(d.bookings, "bookings")} keyOf={(b) => String(b.bookingId)} render={(b) => <BookingRow booking={b} onPress={() => openBooking(b.bookingId)} />} />
                  <ShowAllFooter total={d.bookings.length} expanded={isExpanded("bookings")} onToggle={() => toggle("bookings")} />
                </>
              )}
            </SectionBody>
          ) : tab === "quotations" ? (
            <SectionBody
              state={quotationState}
              what="Quotations"
              onRetry={quotations.reload}
              isEmpty={(d) => !d.items.length}
              empty={{ illustration: "document", title: "No quotations yet", message: "Quotations sent to this customer will show here." }}
            >
              {(d) => (
                <>
                  <RowsCard
                    rows={d.items.slice(0, LIST_SIZE)}
                    keyOf={(q) => String(q.id)}
                    render={(q) => (
                      <ListRow
                        title={`${q.quotationNumber} · v${q.version}`}
                        subtitle={[q.spaceName, formatMoney(q.totalAmount)].filter(Boolean).join(" · ")}
                        right={<StatusPill status={q.status} />}
                        onPress={() => openQuotation(q.id)}
                      />
                    )}
                  />
                  <LatestNote shown={Math.min(d.items.length, LIST_SIZE)} total={d.total} />
                </>
              )}
            </SectionBody>
          ) : tab === "invoices" ? (
            <SectionBody
              state={invoiceState}
              what="Invoices"
              onRetry={invoices.reload}
              isEmpty={(d) => !d.items.length}
              empty={{ illustration: "receipt", title: "No invoices yet", message: "Invoices issued to this customer will show here." }}
            >
              {(d) => (
                <>
                  <RowsCard
                    rows={d.items}
                    keyOf={(inv) => String(inv.id)}
                    render={(inv) => (
                      <ListRow
                        title={inv.invoiceNumber}
                        subtitle={`${formatMoney(inv.grandTotal)} · due ${formatDate(inv.dueOn)}`}
                        right={<StatusPill status={inv.status} />}
                        onPress={() => openInvoice(inv.id, inv)}
                      />
                    )}
                  />
                  <LatestNote shown={d.items.length} total={d.total} />
                </>
              )}
            </SectionBody>
          ) : tab === "payments" ? (
            <SectionBody
              state={overviewState}
              what="Payments"
              onRetry={overview.reload}
              isEmpty={(d) => paymentsCount(d) === 0}
              empty={{ illustration: "receipt", title: "No payments yet", message: "Fee receipts, payments and security deposits will show here." }}
            >
              {(d) => (
                <>
                  <SubList
                    title="Fee receipts"
                    rows={d.receipts}
                    emptyText="No fee receipts yet."
                    expanded={isExpanded("receipts")}
                    onToggle={() => toggle("receipts")}
                    keyOf={(r) => String(r.id)}
                    render={(r) => <ReceiptRow receipt={r} onPress={r.invoiceId ? () => openInvoice(r.invoiceId as number) : undefined} />}
                  />
                  <SubList
                    title="Payments"
                    rows={d.payments}
                    emptyText="No payments yet."
                    expanded={isExpanded("payments")}
                    onToggle={() => toggle("payments")}
                    keyOf={(p) => String(p.id)}
                    render={(p) => (
                      <PaymentRow
                        payment={p}
                        onPress={p.invoiceId ? () => openInvoice(p.invoiceId as number) : p.bookingId ? () => openBooking(p.bookingId as number) : undefined}
                      />
                    )}
                  />
                  <SubList
                    title="Security deposits"
                    rows={d.deposits}
                    emptyText="No security deposits recorded."
                    expanded={isExpanded("deposits")}
                    onToggle={() => toggle("deposits")}
                    keyOf={(dep) => String(dep.id)}
                    render={(dep) => <DepositRow deposit={dep} onPress={dep.bookingId ? () => openBooking(dep.bookingId as number) : undefined} />}
                  />
                </>
              )}
            </SectionBody>
          ) : tab === "agreements" ? (
            <SectionBody
              state={overviewState}
              what="Agreements"
              onRetry={overview.reload}
              isEmpty={(d) => !d.agreements.length}
              empty={{ illustration: "document", title: "No agreements yet", message: "Lease agreements sent to this customer will show here." }}
            >
              {(d) => (
                <>
                  <RowsCard
                    rows={visible(d.agreements, "agreements")}
                    keyOf={(a) => String(a.id)}
                    render={(a) => (
                      <AgreementRow agreement={a} opening={openingAgreement === a.id} onPress={() => openAgreement(a.id, a.quotationNumber || null)} />
                    )}
                  />
                  <ShowAllFooter total={d.agreements.length} expanded={isExpanded("agreements")} onToggle={() => toggle("agreements")} />
                </>
              )}
            </SectionBody>
          ) : (
            <SectionBody
              state={overviewState}
              what="Activity"
              onRetry={overview.reload}
              isEmpty={(d) => !d.timeline.length}
              empty={{ illustration: "chart", title: "No activity yet", message: "Quotations, bookings, invoices and payments will show here." }}
            >
              {(d) => (
                <>
                  <RowsCard
                    rows={visible(d.timeline, "activity")}
                    keyOf={(e, i) => `${e.kind}-${e.action}-${e.refId ?? ""}-${e.at ?? ""}-${i}`}
                    render={(e) => <TimelineRow event={e} onOpen={openTarget} />}
                  />
                  <ShowAllFooter total={d.timeline.length} expanded={isExpanded("activity")} onToggle={() => toggle("activity")} />
                </>
              )}
            </SectionBody>
          )}
        </ScrollView>
      ) : null}
    </StaffScreen>
  );
}

/** "Showing the latest 10 of 24." under a list that shows its first page only. */
function LatestNote({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return (
    <AppText variant="caption" color="textMuted" style={styles.note}>
      Showing the latest {shown} of {total}.
    </AppText>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  tabs: { gap: spacing.sm },
  note: { textAlign: "center" },
});
