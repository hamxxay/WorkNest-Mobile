import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { HBarList, type HBarItem } from "../../../components/charts";
import {
  BottomSheet,
  Card,
  Divider,
  EmptyState,
  ListRow,
  ListSkeleton,
  StatusPill,
  type StatCardProps,
} from "../../../components/ui";
import { count, money, moneyFull, pct, periodWordsOf, type CeoScope } from "../../../services/ceo";
import {
  bookingDetail,
  bookingSpeech,
  discountsErrorView,
  getCeoDiscountRecords,
  getCeoDiscounts,
  groupDetail,
  groupFilter,
  invoiceDetail,
  priceLine,
  recordsSummary,
  sellerText,
  type CeoDiscountBooking,
  type CeoDiscountFilter,
  type CeoDiscountGroup,
  type CeoDiscountRecordKind,
  type CeoDiscountRecords,
  type CeoDiscountReport,
  type CeoDiscounts,
} from "../../../services/ceo/discounts";
import { spacing } from "../../../theme";
import { KpiGrid } from "../Staff/Dashboard/parts";
import { CeoErrorState, CeoSection, ChartCard, ChartGrid, InlineEmpty, SectionEmpty, StaleBanner, useCeoQuery } from "./parts";

// The Discounts section of the CEO dashboard (GET api/ceo/discounts, database update DD_01), loaded on its own: an
// error stays in this section. The discount a month on the rooms' bookings running in the period (below the expected
// price as the Rooms section sees it: 24/7 against the room price, Morning / Evening against the shift price; plus
// fixed PKR discounts), by location, salesperson and shift, the biggest ones, and the discount on the invoices issued
// in the period. A tile, bar or row opens its records in a sheet (GET api/ceo/discounts/records/{kind}). Read-only;
// colours come from the light / dark theme tokens; no emojis.

/** Biggest discounts shown in the section (the sheet lists them all). */
export const BIGGEST_SHOWN = 5;

/** The dashboard reloaded within this long of the section's own answer: no second request (ms). */
const RELOAD_GRACE_MS = 15_000;

const NOTE = "24/7 is compared with the room price, Morning and Evening with the shift price";

/** A records list opened from the section. */
type SheetRequest = { kind: CeoDiscountRecordKind; filter: CeoDiscountFilter; title: string; highlight?: number | null };

/**
 * The whole section: heading, skeletons while loading, its own error with "Try again", the server's message when the
 * section is not set up yet (nothing else), an empty state, or the figures. `reloadKey` = when the dashboard last
 * loaded: a pull to refresh or the 5-minute refresh reloads this section quietly too.
 */
export function DiscountsBlock({ scope, reloadKey }: { scope: CeoScope; reloadKey?: number | null }) {
  const load = useCallback(() => getCeoDiscounts(scope), [scope]);
  const query = useCeoQuery<CeoDiscounts>(load);
  const { quietRefresh, loadedAt, loading } = query;
  const last = useRef(reloadKey);
  useEffect(() => {
    if (reloadKey === last.current) return;
    last.current = reloadKey;
    // A new scope reloads this section by itself; skip the dashboard's answer that follows it.
    if (!reloadKey || loading || (loadedAt && Date.now() - loadedAt < RELOAD_GRACE_MS)) return;
    quietRefresh();
  }, [reloadKey, loading, loadedAt, quietRefresh]);

  const words = periodWordsOf(scope.period, scope.range).thisP;
  const d = query.data;
  let body: ReactNode = null;
  if (d && !d.available) {
    body = <SectionEmpty title="Not available yet" message={d.message} />;
  } else if (d) {
    body =
      d.summary.bookings || d.summary.invoicesDiscounted ? (
        <DiscountsContent report={d} scope={scope} />
      ) : (
        <SectionEmpty title={`No bookings ${words}`} message="Confirmed bookings of private offices and shared spaces show up here with any discount they were given." />
      );
  } else if (query.error) {
    body = (
      <Card>
        <CeoErrorState compact error={query.error} onRetry={query.reload} describe={discountsErrorView} />
      </Card>
    );
  }
  return (
    <CeoSection
      title="Discounts"
      subtitle={`Rooms sold below their price ${words}`}
      note={d && !d.available ? undefined : NOTE}
      loading={query.loading}
      empty={false}
      emptyMessage=""
    >
      {d && query.error && !query.refreshing ? <StaleBanner error={query.error} describe={discountsErrorView} what="The discounts below are" /> : null}
      {body}
    </CeoSection>
  );
}

/** KPI tiles, the three breakdowns, the biggest discounts and the records sheet. */
export function DiscountsContent({ report, scope }: { report: CeoDiscountReport; scope: CeoScope }) {
  const s = report.summary;
  const words = periodWordsOf(scope.period, scope.range).thisP;
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const open = (kind: CeoDiscountRecordKind, filter: CeoDiscountFilter, title: string, highlight?: number | null) =>
    setSheet({ kind, filter, title, highlight });
  const many = report.byLocation.length > 1;

  const tiles: StatCardProps[] = [
    {
      label: "Discount a month",
      value: money(s.discountMonthly),
      sub: s.baseMonthly ? `${pct(s.discountPct)} of the expected rent` : "no bookings to compare",
      icon: "pricetag-outline",
      tone: s.discountMonthly > 0 ? "danger" : "success",
      onPress: s.discounted ? () => open("bookings", {}, "Discounted bookings") : undefined,
      accessibilityHint: "Opens the discounted bookings",
    },
    {
      label: "Bookings discounted",
      value: `${count(s.discounted)} of ${count(s.bookings)}`,
      sub: s.discounted ? `${pct(s.averageDiscountPct)} off on average` : `none ${words}`,
      icon: "people-outline",
      tone: s.discounted ? "warning" : "success",
      onPress: s.discounted ? () => open("bookings", {}, "Discounted bookings") : s.bookings ? () => open("bookings", { all: true }, "Bookings") : undefined,
      accessibilityHint: s.discounted ? "Opens the discounted bookings" : "Opens the bookings",
    },
    {
      label: "New deals discounted",
      value: `${count(s.newDiscounted)} of ${count(s.newBookings)}`,
      sub: s.newDiscounted ? `${money(s.newDiscountMonthly)} a month off` : s.newBookings ? "all at the price or above" : `no bookings started ${words}`,
      icon: "sparkles-outline",
      tone: s.newDiscounted ? "warning" : "neutral",
      onPress: s.newBookings ? () => open("bookings", { newOnly: true, all: true }, "New deals") : undefined,
      accessibilityHint: "Opens the new deals",
    },
    {
      label: "Discount on invoices",
      value: money(s.invoiceDiscount),
      sub: s.invoicesDiscounted ? `${count(s.invoicesDiscounted)} invoice${s.invoicesDiscounted === 1 ? "" : "s"}, ${money(s.invoiceDiscountPaid)} on paid` : `none issued ${words}`,
      icon: "receipt-outline",
      tone: "info",
      onPress: s.invoicesDiscounted ? () => open("invoices", {}, "Invoices with a discount") : undefined,
      accessibilityHint: "Opens the invoices with a discount",
    },
  ];

  const bars = (groups: CeoDiscountGroup[], withRole = false): HBarItem[] =>
    groups.map((g, i) => ({
      key: g.key ?? `none-${i}`,
      label: withRole && g.role ? `${g.name} (${g.role})` : g.name,
      value: g.discountMonthly,
      valueLabel: money(g.discountMonthly),
      detail: groupDetail(g),
      tone: "danger",
    }));
  const openGroup = (by: "location" | "seller" | "shift", groups: CeoDiscountGroup[]) => (_item: HBarItem, i: number) => {
    const g = groups[i];
    if (g) open("bookings", groupFilter(by, g), g.name);
  };
  const biggest = report.biggest.slice(0, BIGGEST_SHOWN);

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard title="By location" caption={`Discount a month ${words}. Tap a location for its bookings.`}>
          <HBarList
            label={`Discount a month by location ${words}`}
            items={bars(report.byLocation)}
            formatValue={money}
            emptyText="No locations."
            itemAccessibilityHint="Opens the discounted bookings"
            onPressItem={openGroup("location", report.byLocation)}
          />
        </ChartCard>
        <ChartCard title="By salesperson" caption="Who made the quotation, else the booking. Tap a person for their bookings.">
          <HBarList
            label={`Discount a month by salesperson ${words}`}
            items={bars(report.bySeller, true)}
            formatValue={money}
            emptyText={`No bookings ${words}.`}
            itemAccessibilityHint="Opens the discounted bookings"
            onPressItem={openGroup("seller", report.bySeller)}
          />
        </ChartCard>
        <ChartCard title="By shift" caption="Against the room price (24/7) or the shift price (Morning, Evening).">
          <HBarList
            label={`Discount a month by shift ${words}`}
            items={bars(report.byShift)}
            formatValue={money}
            itemAccessibilityHint="Opens the discounted bookings"
            onPressItem={openGroup("shift", report.byShift)}
          />
        </ChartCard>
        <ChartCard title="Biggest discounts" caption="A month, against the expected price. Tap a booking for its location's list." padding={0}>
          {biggest.length ? (
            biggest.map((b, i) => (
              <Fragment key={`${b.bookingId ?? b.customer}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <BookingRow booking={b} withLocation={many} onPress={() => open("bookings", b.locationId ? { locationId: b.locationId } : {}, b.location ?? "Discounted bookings", b.bookingId)} />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text={`No discounts ${words}: every booking was sold at its price or above.`} />
            </View>
          )}
          {s.discounted > biggest.length ? (
            <ListRow
              leftIcon="list-outline"
              title={`All ${count(s.discounted)} discounted bookings`}
              accessibilityHint="Opens the discounted bookings"
              onPress={() => open("bookings", {}, "Discounted bookings")}
            />
          ) : null}
        </ChartCard>
      </ChartGrid>
      <DiscountRecordsSheet request={sheet} scope={scope} onClose={() => setSheet(null)} />
    </>
  );
}

/** A discounted booking: customer, room / shift / seats, expected vs sold, who sold it; the discount on the right. */
export function BookingRow({ booking: b, withLocation = true, onPress, selected = false }: { booking: CeoDiscountBooking; withLocation?: boolean; onPress?: () => void; selected?: boolean }) {
  return (
    <ListRow
      title={b.customer}
      subtitle={`${bookingDetail(b, withLocation)}\n${priceLine(b)} · ${sellerText(b)}`}
      subtitleLines={3}
      meta={`${money(b.discountMonthly)} · ${pct(b.discountPct)}`}
      right={selected ? <StatusPill label="Selected" tone="primary" icon={false} /> : undefined}
      accessibilityLabel={bookingSpeech(b)}
      accessibilityHint={onPress ? "Opens the discounted bookings of this location" : undefined}
      onPress={onPress}
    />
  );
}

/**
 * The records behind a tile, bar or row, in a sheet: the discounted bookings (biggest first) or the invoices with a
 * discount, for the dashboard's period and location. Loads when opened; "Try again" on an error.
 */
export function DiscountRecordsSheet({ request, scope, onClose }: { request: SheetRequest | null; scope: CeoScope; onClose: () => void }) {
  const load = useCallback(
    () => (request ? getCeoDiscountRecords(request.kind, scope, request.filter) : Promise.resolve(null)),
    [request, scope],
  );
  const query = useCeoQuery<CeoDiscountRecords | null>(load);
  const r = query.data;
  let content: ReactNode;
  if (query.loading) content = <ListSkeleton rows={4} avatar={false} variant="rows" />;
  else if (!r && query.error) content = <CeoErrorState compact error={query.error} onRetry={query.reload} describe={discountsErrorView} />;
  else if (!r || (!r.bookings.length && !r.invoices.length)) {
    content = <EmptyState compact icon="document-text-outline" title="No records" message="Nothing matches this selection." />;
  } else if (r.kind === "invoices") {
    content = r.invoices.map((inv, i) => (
      <Fragment key={`${inv.invoiceId ?? inv.invoiceNumber}-${i}`}>
        {i > 0 ? <Divider /> : null}
        <ListRow
          title={`${inv.invoiceNumber || "Invoice"} · ${inv.customer}`}
          subtitle={invoiceDetail(inv)}
          meta={`${money(inv.discount)} off`}
          right={inv.status ? <StatusPill label={inv.status} tone={inv.paid ? "success" : "neutral"} icon={false} /> : undefined}
          accessibilityLabel={`${inv.invoiceNumber || "Invoice"}, ${inv.customer}. ${invoiceDetail(inv)}. ${moneyFull(inv.discount)} off ${moneyFull(inv.subTotal)}, total ${moneyFull(inv.total)}. ${inv.status}`}
        />
      </Fragment>
    ));
  } else {
    const places = new Set(r.bookings.map((b) => b.location)).size > 1;
    content = r.bookings.map((b, i) => (
      <Fragment key={`${b.bookingId ?? b.customer}-${i}`}>
        {i > 0 ? <Divider /> : null}
        <BookingRow booking={b} withLocation={places} selected={!!request?.highlight && b.bookingId === request.highlight} />
      </Fragment>
    ));
  }
  const subtitle = r ? [recordsSummary(r), r.kind === "bookings" && r.bookings.some((b) => b.fixedMonthly > 0) ? "includes fixed discounts" : null].filter(Boolean).join(" · ") : undefined;
  return (
    <BottomSheet visible={!!request} onClose={onClose} overline="Discounts" title={r?.title || request?.title} subtitle={subtitle} fullHeight>
      {content}
      {r && r.kind === "bookings" && r.bookings.length ? (
        <View style={styles.sheetNote}>
          <InlineEmpty text="Amounts a month. Expected: the room price x seats for 24/7, less the location's shift discount for Morning and Evening." />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sheetNote: { marginTop: spacing.sm },
});
