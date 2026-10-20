import { Fragment, useMemo, useState, type Ref } from "react";
import { StyleSheet, View } from "react-native";
import { BarChart, Donut, HBarList, type HBarItem } from "../../../components/charts";
import { AppText, Divider, ListRow, SegmentedControl, type StatCardProps } from "../../../components/ui";
import {
  activeBookingsRecords,
  agingTarget,
  billedInAdvanceTarget,
  categorySpacesRecords,
  clampPct,
  count,
  depositRecords,
  funnelStepText,
  inquiriesCountAllLocations,
  monthLabel,
  monthShort,
  money,
  occupancyCategoryTarget,
  occupancyTarget,
  pct,
  periodWords,
  receivedRecords,
  recordsForPersonBookings,
  recordsForPersonRevenue,
  salesBookingsRecords,
  revenueTarget,
  shareOf,
  trendForPeriod,
  type CeoAgingBucket,
  type CeoBreakdownQuery,
  type CeoCategoryOccupancy,
  type CeoDrillTarget,
  type CeoMoney,
  type CeoOccupancy,
  type CeoPeriod,
  type CeoPerson,
  type CeoRecordsQuery,
  type CeoSales,
  type CeoScope,
  type CeoTeam,
  type DashRange,
} from "../../../services/ceo";
import { dashboardTrend, type DashboardForecast, type ForecastMonth } from "../../../services/staff/dashboard";
import { spacing, useInquiryTypeColors, type Tone } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { Fact, KpiGrid } from "../Staff/Dashboard/parts";
import { ChartCard, ChartGrid, InlineEmpty } from "./parts";

// The CEO dashboard sections (Money, Occupancy, Sales, Team, 3-month outlook). Read-only: every tappable element
// drills down (breakdown or records); nothing changes data. Figures stay on screen as text next to every chart.

/** A breakdown request without the scope (the dashboard adds period, range and location). */
export type BreakdownTarget = Omit<CeoBreakdownQuery, "period" | "range" | "locationId"> & { locationId?: number | null };

/** Places on the dashboard a KPI card can scroll to. */
export type FocusTarget = "leases" | "roomList";

/** What the sections may do: open a drill screen or scroll to a chart. */
export type Drill = {
  period: CeoPeriod;
  /** The custom range (period custom); null or left out for a calendar period. */
  range?: DashRange | null;
  /** The dashboard's location filter (null = all locations). */
  locationId: number | null;
  breakdown: (target: BreakdownTarget, trail: string[]) => void;
  records: (query: CeoRecordsQuery | null, trail: string[], title?: string) => void;
  /** Opens what a KPI card leads to (a breakdown, a list built from the dashboard, or records). */
  open: (target: CeoDrillTarget, trail: string[]) => void;
  focus: (target: FocusTarget) => void;
  /** Ref callback that registers a scroll target. */
  target: (name: FocusTarget) => Ref<View>;
  /** Records queries the dashboard builds from its scope. */
  overdueRecords: () => CeoRecordsQuery;
  newBookingsRecords: () => CeoRecordsQuery;
  funnelRecords: (stage: string) => CeoRecordsQuery | null;
  customerRecords: (customerId: number | null) => CeoRecordsQuery | null;
  /** Every lease ending in the next 90 days (records/leases). */
  leasesRecords: () => CeoRecordsQuery;
};


const DONUT_SIZE = 112;

/** The dashboard's period (with a custom range) and location, as the drill helpers take them. */
const scopeOf = (drill: Drill): CeoScope =>
  drill.period === "custom" && drill.range
    ? { period: drill.period, locationId: drill.locationId, range: drill.range }
    : { period: drill.period, locationId: drill.locationId };

/** "Opens invoiced this month by location" / "Opens invoiced this quarter by month" / "Opens invoiced in this range by location". */
const revenueHint = (what: string, period: CeoPeriod) =>
  `Opens ${what} ${periodWords(period)} by ${period === "month" || period === "custom" ? "location" : "month"}`;

/**
 * "vs last period" change ("vs previous 15 days" for a custom range; `which` "ago": "vs 15 days earlier"), or
 * undefined when the previous figure was not sent.
 */
const trendOf = (drill: Drill) => (now: number, prev: number | null, unit: "pts" | "n" | "%", which: "last" | "ago" = "last") =>
  prev == null ? undefined : trendForPeriod(dashboardTrend(now, prev, unit), drill.period, drill.range, which);

// ─── Money ────────────────────────────────────────────────────────────────────────────────────────────────

const AGING_TONES: Record<string, Tone> = {
  not_due: "primary",
  "1_30": "warning",
  "31_60": "warning",
  "61_90": "danger",
  "90_plus": "danger",
};

export function MoneySection({ money: m, drill }: { money: CeoMoney; drill: Drill }) {
  const words = periodWords(drill.period);
  const trend = trendOf(drill);
  const recent = m.months.slice(-12);
  const rate = m.collectionRate ?? (m.invoiced > 0 ? (m.collected / m.invoiced) * 100 : null);
  // Database update CP_02 (it sends the security deposits): invoiced leaves the deposits out and collected is what was
  // paid so far on the period's invoices (part payments count). An older API: GrandTotal and the paid invoices.
  const noDeposits = m.securityDeposits != null;
  const tiles: StatCardProps[] = [
    {
      label: "Invoiced",
      value: money(m.invoiced),
      // An invoice counts in the month its billing period starts, not the month it was issued.
      sub: noDeposits ? `${words}, by billing period, without deposits` : `${words}, by billing period`,
      icon: "receipt-outline",
      trend: trend(m.invoiced, m.invoicedPrev, "%"),
      trendSeries: recent.map((x) => x.invoiced),
      onPress: () => drill.open(revenueTarget(m, "invoiced", scopeOf(drill)), ["Money", `Invoiced ${words}`]),
      accessibilityHint: revenueHint("invoiced", drill.period),
    },
    {
      label: "Collected",
      value: money(m.collected),
      // CP_02: the share of the period's billing paid so far (the collection rate).
      sub: rate != null ? `${pct(rate)} of invoiced${noDeposits ? ", paid so far" : ""}` : `${words}, by billing period`,
      icon: "cash-outline",
      trend: trend(m.collected, m.collectedPrev, "%"),
      trendSeries: recent.map((x) => x.collected),
      onPress: () => drill.open(revenueTarget(m, "collected", scopeOf(drill)), ["Money", `Collected ${words}`]),
      accessibilityHint: revenueHint("collected", drill.period),
    },
    {
      label: "Outstanding",
      value: money(m.outstanding),
      // Billed in advance is not inside it (the CMS hint "Not counting invoices billed in advance").
      sub: m.billedInAdvance != null ? `${count(m.outstandingCount)} open, not billed in advance` : `${count(m.outstandingCount)} open invoices`,
      icon: "wallet-outline",
      tone: m.outstanding ? "warning" : "success",
      onPress: () => drill.open(agingTarget(m, scopeOf(drill)), ["Money", "Outstanding"]),
      accessibilityHint: "Opens the outstanding invoices by age",
    },
    {
      label: "Overdue",
      value: money(m.overdue),
      sub: `${count(m.overdueCount)} invoices past due`,
      icon: "alert-circle-outline",
      tone: m.overdueCount ? "danger" : "success",
      onPress: () => drill.records(drill.overdueRecords(), ["Money", "Overdue invoices"], "Overdue invoices"),
      accessibilityHint: "Opens the overdue invoices",
    },
  ];
  // Money received in the period (CP_02: fee receipts and payments by the day they came in, whatever invoice), next to
  // Collected; then the security deposits billed (left out of Invoiced). Both hidden before CP_02; PKR 0 is shown.
  const extra: StatCardProps[] = [];
  if (m.received != null) {
    const n = m.receivedCount ?? 0;
    extra.push({
      label: "Received",
      value: money(m.received),
      sub: n === 1 ? "1 receipt or payment" : `${count(n)} receipts and payments`,
      icon: "arrow-down-circle-outline",
      trend: trend(m.received, m.receivedPrev, "%"),
      trendSeries: m.receivedSeries.length ? m.receivedSeries.slice(-12).map((x) => x.received) : undefined,
      onPress: () => drill.records(receivedRecords(scopeOf(drill)), ["Money", `Received ${words}`], "Money received"),
      accessibilityHint: "Opens the money taken in during the period (fee receipts and online payments), whatever invoice it was for",
    });
  }
  if (m.securityDeposits != null) {
    const n = m.securityDepositsCount ?? 0;
    extra.push({
      label: "Security deposits",
      value: money(m.securityDeposits),
      sub: n ? `${count(n)} ${n === 1 ? "invoice" : "invoices"}, not in Invoiced` : "No deposits billed",
      icon: "shield-checkmark-outline",
      tone: "neutral",
      trend: trend(m.securityDeposits, m.securityDepositsPrev ?? 0, "%"),
      onPress: () => drill.records(depositRecords(scopeOf(drill)), ["Money", `Security deposits ${words}`], "Security deposits"),
      accessibilityHint: "Opens the invoices with a refundable security deposit, by billing period",
    });
  }
  tiles.splice(2, 0, ...extra);
  // Unpaid invoices for billing periods not started yet (not inside Outstanding). Hidden when the server does not send it (an
  // API older than the database update CP_01); PKR 0 is shown. Under Outstanding in the two-column grid.
  if (m.billedInAdvance != null) {
    tiles.push({
      label: "Billed in advance",
      value: money(m.billedInAdvance),
      sub: `${count(m.billedInAdvanceCount)} unpaid, for billing periods not started yet`,
      icon: "calendar-outline",
      tone: "info",
      onPress: () => drill.open(billedInAdvanceTarget(scopeOf(drill)), ["Money", "Billed in advance"]),
      accessibilityHint: "Opens the unpaid invoices for billing periods not started yet",
    });
  }
  // The received series (CP_02) as a third column, by the day money came in; invoiced / collected by billing period.
  const receivedByMonth = new Map(m.receivedSeries.map((x) => [x.month, x.received]));
  const withReceived = m.received != null && m.receivedSeries.length > 0;
  const agingItems: HBarItem[] = m.aging.map((b: CeoAgingBucket) => ({
    key: b.bucket,
    label: b.label,
    value: b.amount,
    valueLabel: `${money(b.amount)} · ${count(b.count)} ${b.count === 1 ? "invoice" : "invoices"}`,
    tone: AGING_TONES[b.bucket] ?? "neutral",
  }));
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard
          title="Revenue and collections"
          caption={[
            `Last 12 months, by billing period${noDeposits ? ", without security deposits" : ""}.`,
            withReceived ? "Received: by the day the money came in." : null,
            "Tap a month to see it by location.",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {recent.length ? (
            <BarChart
              label={withReceived ? "Invoiced, collected and received by month" : "Invoiced and collected by month"}
              series={withReceived ? [{ label: "Invoiced" }, { label: "Collected" }, { label: "Received" }] : [{ label: "Invoiced" }, { label: "Collected" }]}
              data={recent.map((x) => ({
                label: monthShort(x.month),
                title: monthLabel(x.month),
                values: withReceived ? [x.invoiced, x.collected, receivedByMonth.get(x.month) ?? 0] : [x.invoiced, x.collected],
              }))}
              formatValue={money}
              emptyText="Nothing invoiced in these months."
              itemAccessibilityHint="Opens this month by location"
              onPressItem={(i) => drill.breakdown({ metric: "revenue", month: recent[i].month }, ["Revenue", monthLabel(recent[i].month)])}
            />
          ) : (
            <InlineEmpty text="No invoices in the last 12 months." />
          )}
        </ChartCard>
        <ChartCard title="Receivables aging" caption={`${money(m.outstanding)} outstanding. Tap a bucket to see it by location.`}>
          {agingItems.length ? (
            <HBarList
              label="Receivables by age"
              items={agingItems}
              formatValue={money}
              itemAccessibilityHint="Opens this bucket by location"
              onPressItem={(item) => {
                const bucket = m.aging.find((b) => b.bucket === item.key);
                if (bucket) drill.breakdown({ metric: "aging", bucket: bucket.bucket }, ["Receivables", bucket.label]);
              }}
            />
          ) : (
            <InlineEmpty text="No open invoices." />
          )}
        </ChartCard>
        <ChartCard
          title="Top customers"
          caption={noDeposits ? "Invoiced over the last 12 months, without security deposits" : "Invoiced over the last 12 months"}
          padding={0}
        >
          {m.topCustomers.length ? (
            m.topCustomers.map((c, i) => {
              const query = drill.customerRecords(c.customerId);
              return (
                <Fragment key={`${c.customerId ?? c.name}-${i}`}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    leftIcon="business-outline"
                    title={c.name}
                    subtitle={`${count(c.invoices)} ${c.invoices === 1 ? "invoice" : "invoices"}`}
                    meta={money(c.amount)}
                    metaVariant="amount"
                    accessibilityHint={query ? "Opens this customer's invoices" : undefined}
                    onPress={query ? () => drill.records(query, ["Top customers", c.name], `${c.name}: invoices`) : undefined}
                  />
                </Fragment>
              );
            })
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No customers invoiced in the last 12 months." />
            </View>
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── Occupancy ────────────────────────────────────────────────────────────────────────────────────────────

type TrendView = "occupancy" | "bookings";

const LEASES_SHOWN = 8;

/** "13 of 87 rooms in use now · 61 of 329 seats sold" (a room category, CP_02). */
export function categoryOccupancyText(c: Pick<CeoCategoryOccupancy, "occupied" | "rooms" | "seatsSold" | "seats">, now = true): string {
  return `${count(c.occupied)} of ${count(c.rooms)} rooms${now ? " in use now" : ""} · ${count(c.seatsSold)} of ${count(c.seats)} seats sold`;
}

const occupancyTone = (value: number): Tone => (value >= 70 ? "success" : value >= 40 ? "primary" : "warning");

export function OccupancySection({ occupancy: o, drill }: { occupancy: CeoOccupancy; drill: Drill }) {
  const words = periodWords(drill.period);
  const trend = trendOf(drill);
  const [view, setView] = useState<TrendView>("occupancy");
  const recent = o.months.slice(-12);
  // CP_02: occupancy apart for each room category (Private Office, Shared Space; confirmed bookings, rooms only, with
  // seats), never one mixed figure. Before the database update the API sends no categories: the old single figure.
  const categories = o.categories;
  const byCategory = categories.length > 0;
  // The true number when the server sent it (its list holds the first 50), else what the list holds.
  const expiringCount = o.leasesExpiringCount ?? o.leasesExpiring.length;
  const shownLeases = o.leasesExpiring.slice(0, LEASES_SHOWN);
  const moreLeases = expiringCount - shownLeases.length;
  // The full list can be opened once the server counts them all (records/leases comes with that update).
  const canOpenAllLeases = o.leasesExpiringCount != null;
  const openAllLeases = () => drill.records(drill.leasesRecords(), ["Occupancy", "Leases expiring"], "Leases expiring");
  const occupancyTile: StatCardProps = {
    label: "Occupancy",
    value: pct(o.occupancyPct),
    sub: `${count(o.occupiedSpaces)} of ${count(o.totalSpaces)} spaces in use now`,
    icon: "business-outline",
    tone: occupancyTone(o.occupancyPct),
    // Occupancy is taken at a moment: against the same moment one period (a range: as many days) earlier.
    trend: trend(o.occupancyPct, o.occupancyPctPrev, "pts", "ago"),
    trendSeries: recent.map((x) => x.occupancyPct),
    onPress: () => drill.open(occupancyTarget(o, scopeOf(drill)), ["Occupancy", "Spaces in use"]),
    accessibilityHint: drill.locationId ? "Opens the occupied rooms of this location by space type" : "Opens the occupied rooms by location",
  };
  const categoryTiles: StatCardProps[] = categories.map((c) => ({
    label: `${c.label} occupancy`,
    value: pct(c.occupancyPct),
    sub: categoryOccupancyText(c),
    icon: c.categoryCode === "SharedSpace" ? "people-outline" : "business-outline",
    tone: c.rooms ? occupancyTone(c.occupancyPct) : "neutral",
    // Against one period (a range: as many days) earlier, of the rooms that existed then.
    trend: trend(c.occupancyPct, c.occupancyPctPrev, "pts", "ago"),
    trendSeries: recent.map((x) => x.categories.find((m) => m.categoryCode === c.categoryCode)?.occupancyPct ?? 0),
    onPress: c.occupied > 0 ? () => drill.open(occupancyCategoryTarget(c.categoryCode, scopeOf(drill)), ["Occupancy", c.label]) : undefined,
    accessibilityHint: c.occupied > 0 ? `Opens the occupied ${c.label} rooms by location` : undefined,
  }));
  const newBookingsTile: StatCardProps = {
    label: "New bookings",
    value: count(o.newBookings),
    sub: words,
    icon: "calendar-outline",
    trend: trend(o.newBookings, o.newBookingsPrev, "n"),
    onPress: () => drill.records(drill.newBookingsRecords(), ["Occupancy", "New bookings"], "New bookings"),
    accessibilityHint: "Opens the new bookings",
  };
  const activeTile: StatCardProps = {
    label: "Active bookings",
    value: count(o.activeBookings),
    // CP_02: confirmed bookings only.
    sub: byCategory ? "confirmed, running today" : "running today",
    icon: "time-outline",
    onPress: () =>
      drill.open({ kind: "records", query: activeBookingsRecords(scopeOf(drill)), title: "Active bookings", keepTitle: true, timeless: true }, [
        "Occupancy",
        "Active bookings",
      ]),
    accessibilityHint: "Opens the bookings running today",
  };
  const leasesTile: StatCardProps = {
    label: "Leases expiring",
    value: count(expiringCount),
    sub: "in the next 90 days",
    icon: "hourglass-outline",
    tone: expiringCount ? "warning" : "success",
    // The full list once the server counts them all; before that, the list on this screen.
    onPress: canOpenAllLeases ? openAllLeases : () => drill.focus("leases"),
    accessibilityHint: canOpenAllLeases ? "Opens every lease ending in the next 90 days" : "Shows the leases ending soon",
  };
  const tiles: StatCardProps[] = byCategory
    ? [...categoryTiles, activeTile, newBookingsTile, leasesTile]
    : [occupancyTile, newBookingsTile, activeTile, leasesTile];
  const byType = o.byType.filter((t) => t.total > 0);
  const byLocation = o.byLocation.filter((l) => l.total > 0);
  // CP_02 by location: each location's room categories (rooms and occupied added up from them).
  const locationsByCategory = o.byLocation
    .map((l) => {
      const cats = l.categories ?? [];
      return { ...l, cats, rooms: cats.reduce((n, c) => n + c.rooms, 0), occupiedRooms: cats.reduce((n, c) => n + c.occupied, 0) };
    })
    .filter((l) => l.rooms > 0);
  const openMonth = (i: number) =>
    drill.breakdown({ metric: "bookings-month", month: recent[i].month }, ["New bookings", monthLabel(recent[i].month)]);
  const occupancySeries = byCategory ? categories.map((c) => ({ label: c.label })) : [{ label: "Occupancy" }];
  const occupancyValues = (x: (typeof recent)[number]) =>
    byCategory ? categories.map((c) => x.categories.find((m) => m.categoryCode === c.categoryCode)?.occupancyPct ?? 0) : [x.occupancyPct];
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard
          title="Occupancy trend"
          caption={
            byCategory
              ? "Last 12 months: occupancy at each month end (this month: now) of the rooms that existed then, new bookings in each month. Tap a month for its new bookings by location."
              : "Last 12 months: occupancy at each month end (this month: now), new bookings in each month. Tap a month for its new bookings by location."
          }
        >
          <SegmentedControl
            accessibilityLabel="Trend shows"
            options={[
              { label: "Occupancy", value: "occupancy" },
              { label: "New bookings", value: "bookings" },
            ]}
            value={view}
            onChange={setView}
          />
          {recent.length ? (
            <BarChart
              key={view}
              style={styles.gapTop}
              label={view === "occupancy" ? "Occupancy by month" : "New bookings by month"}
              series={view === "occupancy" ? occupancySeries : [{ label: "New bookings", tone: "indigo" }]}
              data={recent.map((x) => ({
                label: monthShort(x.month),
                title: monthLabel(x.month),
                values: view === "occupancy" ? occupancyValues(x) : [x.newBookings],
              }))}
              formatValue={view === "occupancy" ? pct : count}
              formatTick={view === "occupancy" ? (v) => `${Math.round(v)}%` : undefined}
              emptyText="Nothing to show for these months."
              itemAccessibilityHint="Opens this month's new bookings by location"
              onPressItem={openMonth}
            />
          ) : (
            <InlineEmpty text="No occupancy history yet." />
          )}
        </ChartCard>
        {byCategory ? (
          <ChartCard title="By room category" caption="Rooms with a confirmed booking now · seats sold. Tap a category to see it by location.">
            <HBarList
              label="Occupancy by room category"
              max={100}
              items={categories.map((c) => ({
                key: c.categoryCode || c.label,
                label: c.label,
                value: c.occupancyPct,
                valueLabel: `${pct(c.occupancyPct)} · ${c.occupied}/${c.rooms}`,
                detail: `${count(c.seatsSold)} of ${count(c.seats)} seats sold (${pct(c.seatOccupancyPct)})`,
              }))}
              itemAccessibilityHint="Opens this category by location"
              onPressItem={(_item, i) => {
                const c = categories[i];
                if (c?.categoryCode) drill.breakdown({ metric: "occupancy-category", category: c.categoryCode }, ["Occupancy", c.label]);
              }}
            />
          </ChartCard>
        ) : (
          <ChartCard title="By space type" caption="Spaces in use now. Tap a type to see it by location.">
            {byType.length ? (
              <HBarList
                label="Occupancy by space type"
                max={100}
                items={byType.map((t) => {
                  const share = shareOf(t.occupied, t.total);
                  return { key: t.spaceTypeId ?? t.name, label: t.name, value: share, valueLabel: `${pct(share)} · ${t.occupied}/${t.total}` };
                })}
                itemAccessibilityHint="Opens this space type by location"
                onPressItem={(_item, i) => {
                  const t = byType[i];
                  // "Other" (id 0, spaces without a type) opens too, as on the CMS.
                  if (t.spaceTypeId != null) drill.breakdown({ metric: "occupancy-type", spaceTypeId: t.spaceTypeId }, ["Occupancy", t.name]);
                }}
              />
            ) : (
              <InlineEmpty text="No spaces set up." />
            )}
          </ChartCard>
        )}
        {byCategory ? (
          <ChartCard title="By location" caption="Rooms with a confirmed booking now, per category. Tap a location for its categories, a bar for its rooms." padding={0}>
            {locationsByCategory.length ? (
              locationsByCategory.map((l, i) => (
                <Fragment key={`${l.locationId ?? l.name}-${i}`}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    leftIcon="location-outline"
                    title={l.name}
                    subtitle={`${count(l.occupiedRooms)} of ${count(l.rooms)} rooms in use now${
                      l.seats != null && l.seatsSold != null ? ` · ${count(l.seatsSold)} of ${count(l.seats)} seats sold` : ""
                    }`}
                    accessibilityHint={l.locationId ? "Opens this location by room category" : undefined}
                    onPress={
                      l.locationId ? () => drill.breakdown({ metric: "occupancy-location", locationId: l.locationId }, ["Occupancy", l.name]) : undefined
                    }
                  />
                  <View style={styles.padded}>
                    <HBarList
                      label={`Occupancy at ${l.name}`}
                      max={100}
                      items={l.cats.map((c) => ({
                        key: c.categoryCode || c.label,
                        label: c.label,
                        value: c.occupancyPct,
                        valueLabel: pct(c.occupancyPct),
                        detail: categoryOccupancyText(c, false),
                      }))}
                      itemAccessibilityHint="Opens these rooms"
                      onPressItem={(_item, j) => {
                        const c = l.cats[j];
                        const query = c ? categorySpacesRecords(l.locationId, c.categoryCode) : null;
                        if (c && query) drill.records(query, ["Occupancy", l.name, c.label], `${l.name}: ${c.label}`);
                      }}
                    />
                  </View>
                </Fragment>
              ))
            ) : (
              <View style={styles.padded}>
                <InlineEmpty text="No locations with rooms." />
              </View>
            )}
          </ChartCard>
        ) : (
          <ChartCard title="By location" caption="Spaces in use now. Tap a location to see it by space type.">
            {byLocation.length ? (
              <HBarList
                label="Occupancy by location"
                max={100}
                items={byLocation.map((l) => {
                  const share = shareOf(l.occupied, l.total);
                  return { key: l.locationId ?? l.name, label: l.name, value: share, valueLabel: `${pct(share)} · ${l.occupied}/${l.total}` };
                })}
                itemAccessibilityHint="Opens this location by space type"
                onPressItem={(_item, i) => {
                  const l = byLocation[i];
                  if (l.locationId) drill.breakdown({ metric: "occupancy-location", locationId: l.locationId }, ["Occupancy", l.name]);
                }}
              />
            ) : (
              <InlineEmpty text="No locations with spaces." />
            )}
          </ChartCard>
        )}
        <View ref={drill.target("leases")} collapsable={false}>
          <ChartCard
            title="Leases expiring"
            caption={[
              "Ending in the next 90 days",
              o.leasesExpiringMonthly ? `${money(o.leasesExpiringMonthly)} a month${byCategory ? ", after discounts" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            padding={0}
          >
            {o.leasesExpiring.length ? (
              <>
                {shownLeases.map((b, i) => (
                  <Fragment key={`${b.bookingId ?? b.customer}-${i}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      leftIcon="hourglass-outline"
                      leftIconTone="warning"
                      title={b.customer}
                      subtitle={[b.space, b.location, b.endOn ? `ends ${formatDate(b.endOn)}` : null].filter(Boolean).join(" · ")}
                      meta={b.monthlyAmount != null ? `${money(b.monthlyAmount)}/mo` : undefined}
                      metaVariant="amount"
                    />
                  </Fragment>
                ))}
                {moreLeases > 0 && canOpenAllLeases ? (
                  <>
                    <Divider inset={16} />
                    <ListRow
                      leftIcon="list-outline"
                      title={`All ${count(expiringCount)} leases expiring`}
                      subtitle={`and ${count(moreLeases)} more not shown here`}
                      accessibilityHint="Opens every lease ending in the next 90 days"
                      onPress={openAllLeases}
                    />
                  </>
                ) : moreLeases > 0 ? (
                  <View style={styles.padded}>
                    <AppText variant="caption" color="textMuted">
                      and {count(moreLeases)} more
                    </AppText>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.padded}>
                <InlineEmpty text="No leases end in the next 90 days." />
              </View>
            )}
          </ChartCard>
        </View>
      </ChartGrid>
    </>
  );
}

// ─── Sales ────────────────────────────────────────────────────────────────────────────────────────────────

export function SalesSection({ sales: s, drill }: { sales: CeoSales; drill: Drill }) {
  const words = periodWords(drill.period);
  // Before the server's update QA_07 the inquiry figures count every location even when one is chosen: say so.
  const inquiriesEverywhere = inquiriesCountAllLocations(s, drill.locationId);
  const inquiryWords = inquiriesEverywhere ? `${words}, all locations` : words;
  // CP_02, one location chosen: inquiries without a branch are not counted; say how many.
  const noBranch = s.inquiriesNoBranch && s.inquiriesNoBranch > 0 ? `+${count(s.inquiriesNoBranch)} without a branch (not included)` : null;
  // CP_02: Booked = the contract value of the period's new bookings (before it: their first invoices).
  const contract = s.bookingValueBasis === "contract";
  const bookingsQuery = () => (contract ? salesBookingsRecords(scopeOf(drill)) : drill.funnelRecords("bookings"));
  const colorOf = useInquiryTypeColors();
  const stage = (key: string) => s.funnel.find((f) => f.stage === key)?.count ?? 0;
  const inquiries = stage("inquiries");
  const quotations = stage("quotations");
  const bookings = stage("bookings");
  // Conversion: of this period's quotations, the ones booked (never above 100%; quotationsBooked <= quotations).
  const rate = s.conversionRate ?? (quotations > 0 ? (s.quotationsBooked / quotations) * 100 : null);
  const bookedText = `${count(s.quotationsBooked)} of ${count(quotations)} quotations booked`;
  const typeTotal = s.inquiriesByType.reduce((sum, t) => sum + t.count, 0);
  const tiles: StatCardProps[] = [
    {
      label: "Tour inquiries",
      value: count(inquiries),
      sub: noBranch ? `${inquiryWords}, ${noBranch}` : inquiryWords,
      icon: "walk-outline",
      onPress: () => drill.records(drill.funnelRecords("inquiries"), ["Sales", "Tour inquiries"], "Tour inquiries"),
      accessibilityHint: "Opens the tour inquiries",
    },
    {
      label: "Conversion",
      value: rate != null ? pct(rate) : "—",
      sub: quotations ? bookedText : "No quotations yet",
      icon: "trending-up-outline",
      tone: rate != null && rate >= 30 ? "success" : quotations ? "warning" : "neutral",
      onPress: () => drill.records(drill.funnelRecords("converted"), ["Sales", "Converted quotations"], "Converted quotations"),
      accessibilityHint: "Opens the quotations converted to bookings",
    },
    {
      label: "Quotation value",
      value: money(s.quotationValue),
      sub: `${count(quotations)} quotations ${words}`,
      icon: "document-text-outline",
      onPress: () => drill.records(drill.funnelRecords("quotations"), ["Sales", "Quotations"], "Quotations"),
      accessibilityHint: "Opens the quotations",
    },
    {
      label: contract ? "Booked (contract value)" : "Booking value",
      value: money(s.bookingValue),
      sub: `${count(bookings)} bookings ${words}`,
      icon: "calendar-outline",
      onPress: () => drill.records(bookingsQuery(), ["Sales", "Bookings"], "Bookings"),
      accessibilityHint: contract ? "Opens the bookings made in the period with their contract value" : "Opens the bookings",
    },
  ];
  const typeItems = useMemo(
    () =>
      s.inquiriesByType.map(
        (t): HBarItem => ({
          key: t.key,
          label: t.label,
          value: t.count,
          valueLabel: `${count(t.count)} · ${pct(shareOf(t.count, typeTotal))}`,
          color: colorOf(t.type),
        }),
      ),
    [s.inquiriesByType, typeTotal, colorOf],
  );
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard title="Sales funnel" caption={`Created ${words}. Tap a stage for the list.`}>
          {s.funnel.length ? (
            <>
              <View style={styles.donutRow}>
                <Donut
                  size={DONUT_SIZE}
                  segments={[{ label: "Converted", value: clampPct(rate) }]}
                  total={100}
                  centerLabel={rate != null ? pct(rate) : "—"}
                  centerCaption="converted"
                  accessibilityLabel={`Conversion ${words}: ${rate != null ? pct(rate) : "not available"}. ${bookedText}.`}
                />
                <View style={styles.facts}>
                  <Fact label="Quotations" value={`${count(quotations)} · ${money(s.quotationValue)}`} />
                  <Fact label={contract ? "Booked" : "Bookings"} value={`${count(bookings)} · ${money(s.bookingValue)}`} />
                </View>
              </View>
              <HBarList
                style={styles.gapTop}
                label={`Sales funnel ${words}`}
                items={s.funnel.map((f, i) => {
                  // Share of the stage before it, as the CMS (none for the first stage or above 100%); bookings: how
                  // many came from quotations.
                  const step = funnelStepText(s.funnel, i, s.bookingsFromQuotations);
                  return {
                    key: f.stage,
                    label: f.stage === "inquiries" && inquiriesEverywhere ? `${f.label} (all locations)` : f.label,
                    value: f.count,
                    valueLabel: step ? `${count(f.count)} · ${step}` : count(f.count),
                  };
                })}
                itemAccessibilityHint="Opens the list"
                onPressItem={(item) => {
                  const f = s.funnel.find((x) => x.stage === item.key);
                  if (f) drill.records(f.stage === "bookings" ? bookingsQuery() : drill.funnelRecords(f.stage), ["Sales", f.label], f.label);
                }}
              />
              {s.bookingValueBasis ? (
                <AppText variant="caption" color="textMuted" style={styles.gapTop}>
                  {`Conversion = quotations created ${words} that were booked (booking still live) / all quotations created ${words}. Booked = ${
                    contract ? `contract value of the bookings made ${words}` : "first invoices of those bookings"
                  }.`}
                </AppText>
              ) : null}
              {noBranch ? (
                <AppText variant="caption" color="textMuted" style={styles.gapTop}>
                  {`Tour inquiries: ${noBranch}.`}
                </AppText>
              ) : null}
            </>
          ) : (
            <InlineEmpty text={`No inquiries or quotations ${words}.`} />
          )}
        </ChartCard>
        <ChartCard
          title="Inquiries by type"
          caption={`How visitors found WorkNest, ${inquiryWords}${noBranch ? ` (${noBranch})` : ""}. Tap a type for the last 6 months.`}
        >
          {typeItems.length && typeTotal > 0 ? (
            <>
              <View style={styles.donutCenter}>
                <Donut
                  size={DONUT_SIZE}
                  segments={s.inquiriesByType.map((t) => ({ label: t.label, value: t.count, color: colorOf(t.type) }))}
                  legend={false}
                  centerLabel={count(typeTotal)}
                  centerCaption="inquiries"
                  label={`Inquiries by type ${inquiryWords}`}
                />
              </View>
              <HBarList
                style={styles.gapTop}
                label="Inquiries by type"
                items={typeItems}
                itemAccessibilityHint="Opens this type by month"
                onPressItem={(item) => {
                  const t = s.inquiriesByType.find((x) => x.key === item.key);
                  if (t) drill.breakdown({ metric: "inquiries-type", type: t.key }, ["Inquiries", t.label]);
                }}
              />
            </>
          ) : (
            <InlineEmpty text={`No tour inquiries ${words}.`} />
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

/** "I-8 · 6 quotes · 2 won (33.3%)", and "· 3 bookings sold" when revenue counts bookings (CP_02). */
function personSubtitle(p: CeoPerson): string {
  const rate = p.quotations > 0 ? ` (${pct((p.converted / p.quotations) * 100)})` : "";
  const sold = p.bookings != null ? plural(p.bookings, "booking sold", "bookings sold") : null;
  return [p.locations, `${count(p.quotations)} quotes · ${count(p.converted)} won${rate}`, sold].filter(Boolean).join(" · ");
}

/**
 * Team: the sales executives only (the API sends no other role), each with their revenue = the value of the
 * quotations they created in the period that were converted to bookings. A person opens their last 6 months; a
 * revenue bar opens the converted quotations behind it.
 */
export function TeamSection({ team: t, drill }: { team: CeoTeam; drill: Drill }) {
  const words = periodWords(drill.period);
  const scope = scopeOf(drill);
  const earners = t.people.filter((p) => p.revenue > 0);
  // CP_02: revenue = contract value of the new bookings each sold (their quotation, else the booking they made); before
  // it, the value of their converted quotations.
  const byBookings = t.revenueBasis === "bookings";
  const tiles: StatCardProps[] = [
    {
      label: "Sales executives",
      value: count(t.salesExecutives),
      sub: drill.locationId ? "At this location" : "All locations",
      icon: "people-outline",
    },
    {
      label: "Revenue",
      value: money(t.revenue),
      sub: byBookings ? `Bookings sold ${words}` : `Converted quotations ${words}`,
      icon: "cash-outline",
    },
  ];
  const openRevenue = (_item: HBarItem, i: number) => {
    const p = earners[i];
    if (!p) return;
    if (byBookings) drill.records(recordsForPersonBookings(p.userId, scope), ["Team", p.name, "Revenue"], `${p.name}: bookings sold`);
    else drill.records(recordsForPersonRevenue(p.userId, scope), ["Team", p.name, "Revenue"], `${p.name}: converted quotations`);
  };
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard
          title="Sales executives"
          caption={
            byBookings
              ? `Revenue ${words}: contract value of the new bookings they sold (their quotation, else the booking they made). Tap a person for the last 6 months.`
              : `Revenue ${words}: their quotations converted to bookings. Tap a person for the last 6 months.`
          }
          padding={0}
        >
          {t.people.length ? (
            t.people.map((p, i) => (
              <Fragment key={`${p.userId ?? p.name}-${i}`}>
                {i > 0 ? <Divider inset={68} /> : null}
                <ListRow
                  avatar={{ name: p.name }}
                  title={p.name}
                  subtitle={personSubtitle(p)}
                  meta={money(p.revenue)}
                  metaVariant="amount"
                  accessibilityLabel={`${p.name}. ${personSubtitle(p)}. Revenue ${money(p.revenue)}`}
                  accessibilityHint={p.userId ? "Opens this person's last 6 months" : undefined}
                  onPress={p.userId ? () => drill.breakdown({ metric: "staff", userId: p.userId as number }, ["Team", p.name]) : undefined}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No sales executives yet." />
            </View>
          )}
        </ChartCard>
        <ChartCard
          title="Revenue by sales executive"
          caption={byBookings ? `Contract value of the bookings they sold ${words}. Tap a bar for the bookings.` : `Converted quotations ${words}. Tap a bar for the quotations.`}
        >
          {earners.length ? (
            <HBarList
              label={`Revenue by sales executive ${words}`}
              items={earners.map((p, i): HBarItem => ({ key: p.userId ?? `${p.name}-${i}`, label: p.name, value: p.revenue, valueLabel: money(p.revenue) }))}
              formatValue={money}
              itemAccessibilityHint={byBookings ? "Opens the bookings they sold" : "Opens the converted quotations"}
              onPressItem={openRevenue}
            />
          ) : (
            <InlineEmpty text={byBookings ? `No bookings sold by sales executives ${words}.` : `No converted quotations by sales executives ${words}.`} />
          )}
        </ChartCard>
        <ChartCard
          title="Per location"
          caption={
            t.perLocation.some((l) => l.salesExecutivesOnly)
              ? `Sales executives and their quotations at each location ${words}`
              : `Sales executives and the quotations made at each location ${words}`
          }
          padding={0}
        >
          {t.perLocation.length ? (
            t.perLocation.map((l, i) => (
              <Fragment key={`${l.locationId ?? l.name}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <ListRow
                  leftIcon="location-outline"
                  title={l.name}
                  // CP_02: only the sales executives' quotations at this location (before it: anyone's).
                  subtitle={`${plural(l.salesExecutives, "sales executive", "sales executives")}${l.salesExecutivesOnly ? " · their quotations" : ""}`}
                  meta={`${count(l.quotations)} quotes · ${count(l.converted)} won`}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No locations with sales executives." />
            </View>
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── 3-month outlook (GET dashboard/forecast) ─────────────────────────────────────────────────────────────

/**
 * Rent of the bookings waiting for confirmation in a forecast month: as sent (CP_02), else expected - confirmed (an
 * older API). Never below 0.
 */
export const pendingRentOf = (r: Pick<ForecastMonth, "expectedRent" | "confirmedRent" | "pendingRent">): number =>
  Math.max(0, r.pendingRent ?? r.expectedRent - r.confirmedRent);

const OUTLOOK_CAPTION = "Rent the confirmed leases earn (after discounts) and occupancy at month end · no renewals assumed";

/**
 * The next 3 months: "Expected" = the rent of CONFIRMED leases (owner decision CP_02), with the rent of bookings
 * waiting for confirmation as a "+ PKR x pending confirmation" line under it.
 */
export function OutlookSection({ forecast }: { forecast: DashboardForecast }) {
  const rows = forecast.totals;
  if (!rows.length || !rows.some((r) => r.expectedRent > 0 || r.occupiedSpaces > 0)) {
    return (
      <ChartCard title="Expected rent" caption={OUTLOOK_CAPTION}>
        <InlineEmpty text="No current leases to forecast from." />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Expected rent" caption={OUTLOOK_CAPTION}>
      <BarChart
        height={130}
        label="Expected rent of confirmed leases by month"
        series={[{ label: "Expected (confirmed)" }]}
        data={rows.map((r) => ({ label: r.month ? monthShort(r.month) : r.label, title: r.label || monthLabel(r.month), values: [r.confirmedRent] }))}
        formatValue={money}
        selectable={false}
      />
      <View style={styles.monthList}>
        {rows.map((r, i) => {
          const title = r.label || monthLabel(r.month);
          const pending = pendingRentOf(r);
          const caption = `${pct(r.occupancyPct)} occupied · ${count(r.leasesEnding)} ending · ${count(r.leasesStarting)} starting${
            r.pendingStarting ? ` (${count(r.pendingStarting)} waiting)` : ""
          }`;
          const pendingText = pending > 0 ? `+ ${money(pending)} pending confirmation` : null;
          return (
            <Fragment key={`${r.month || r.label}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <View
                style={styles.monthRow}
                accessible
                accessibilityLabel={[`${title}: expected rent of confirmed leases ${money(r.confirmedRent)}`, pendingText, caption].filter(Boolean).join(". ")}
              >
                <View style={styles.rowBetween}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {title}
                  </AppText>
                  <AppText variant="amount" align="right">
                    {money(r.confirmedRent)}
                  </AppText>
                </View>
                {pendingText ? (
                  <AppText variant="caption" color="textSecondary" align="right">
                    {pendingText}
                  </AppText>
                ) : null}
                <AppText variant="caption" color="textMuted">
                  {caption}
                </AppText>
              </View>
            </Fragment>
          );
        })}
      </View>
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  gapTop: { marginTop: spacing.md },
  // Wraps: on a narrow window or with large text the figures go under the donut instead of being cut off.
  donutRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.lg },
  donutCenter: { alignItems: "center" },
  facts: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: spacing.sm },
  monthList: { marginTop: spacing.xs },
  monthRow: { gap: 2, paddingVertical: spacing.sm + 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
