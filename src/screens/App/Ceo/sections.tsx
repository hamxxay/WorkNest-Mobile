import { Fragment, useMemo, useState, type Ref } from "react";
import { StyleSheet, View } from "react-native";
import { BarChart, Donut, HBarList, type HBarItem } from "../../../components/charts";
import { AppText, Divider, ListRow, SegmentedControl, type StatCardProps } from "../../../components/ui";
import {
  clampPct,
  count,
  inquiriesCountAllLocations,
  monthLabel,
  monthShort,
  money,
  pct,
  periodWords,
  shareOf,
  type CeoAgingBucket,
  type CeoBreakdownQuery,
  type CeoMoney,
  type CeoOccupancy,
  type CeoPeriod,
  type CeoRecordsQuery,
  type CeoSales,
  type CeoTeam,
} from "../../../services/ceo";
import { dashboardTrend, type DashboardForecast } from "../../../services/staff/dashboard";
import { spacing, useInquiryTypeColors, type Tone } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { Fact, KpiGrid } from "../Staff/Dashboard/parts";
import { ChartCard, ChartGrid, InlineEmpty } from "./parts";

// The CEO dashboard sections (Money, Occupancy, Sales, Team, 3-month outlook). Read-only: every tappable element
// drills down (breakdown or records); nothing changes data. Figures stay on screen as text next to every chart.

/** A breakdown request without the scope (the dashboard adds period and location). */
export type BreakdownTarget = Omit<CeoBreakdownQuery, "period" | "locationId"> & { locationId?: number | null };

/** Places on the dashboard a KPI card can scroll to. */
export type FocusTarget = "revenue" | "aging" | "byLocation" | "leases" | "roomList";

/** What the sections may do: open a drill screen or scroll to a chart. */
export type Drill = {
  period: CeoPeriod;
  /** The dashboard's location filter (null = all locations). */
  locationId: number | null;
  breakdown: (target: BreakdownTarget, trail: string[]) => void;
  records: (query: CeoRecordsQuery | null, trail: string[], title?: string) => void;
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

/** "vs last period" change, or undefined when the previous figure was not sent. */
const trend = (now: number, prev: number | null, unit: "pts" | "n" | "%", upIsGood = true) =>
  prev == null ? undefined : dashboardTrend(now, prev, unit, upIsGood);

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
  const recent = m.months.slice(-12);
  const rate = m.collectionRate ?? (m.invoiced > 0 ? (m.collected / m.invoiced) * 100 : null);
  const tiles: StatCardProps[] = [
    {
      label: "Invoiced",
      value: money(m.invoiced),
      sub: words,
      icon: "receipt-outline",
      trend: trend(m.invoiced, m.invoicedPrev, "%"),
      trendSeries: recent.map((x) => x.invoiced),
      onPress: () => drill.focus("revenue"),
    },
    {
      label: "Collected",
      value: money(m.collected),
      sub: rate != null ? `${pct(rate)} of invoiced` : words,
      icon: "cash-outline",
      tone: "success",
      trend: trend(m.collected, m.collectedPrev, "%"),
      trendSeries: recent.map((x) => x.collected),
      onPress: () => drill.focus("revenue"),
    },
    {
      label: "Outstanding",
      value: money(m.outstanding),
      sub: `${count(m.outstandingCount)} open invoices`,
      icon: "wallet-outline",
      tone: m.outstanding ? "warning" : "success",
      onPress: () => drill.focus("aging"),
    },
    {
      label: "Overdue",
      value: money(m.overdue),
      sub: `${count(m.overdueCount)} invoices past due`,
      icon: "alert-circle-outline",
      tone: m.overdueCount ? "danger" : "success",
      onPress: () => drill.records(drill.overdueRecords(), ["Money", "Overdue invoices"], "Overdue invoices"),
    },
  ];
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
        <View ref={drill.target("revenue")} collapsable={false}>
          <ChartCard title="Revenue and collections" caption="Last 12 months. Tap a month to see it by location.">
            {recent.length ? (
              <BarChart
                label="Invoiced and collected by month"
                series={[{ label: "Invoiced" }, { label: "Collected" }]}
                data={recent.map((x) => ({ label: monthShort(x.month), title: monthLabel(x.month), values: [x.invoiced, x.collected] }))}
                formatValue={money}
                emptyText="Nothing invoiced in these months."
                itemAccessibilityHint="Opens this month by location"
                onPressItem={(i) => drill.breakdown({ metric: "revenue", month: recent[i].month }, ["Revenue", monthLabel(recent[i].month)])}
              />
            ) : (
              <InlineEmpty text="No invoices in the last 12 months." />
            )}
          </ChartCard>
        </View>
        <View ref={drill.target("aging")} collapsable={false}>
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
        </View>
        <ChartCard title="Top customers" caption="Invoiced over the last 12 months" padding={0}>
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

export function OccupancySection({ occupancy: o, drill }: { occupancy: CeoOccupancy; drill: Drill }) {
  const words = periodWords(drill.period);
  const [view, setView] = useState<TrendView>("occupancy");
  const recent = o.months.slice(-12);
  // The true number when the server sent it (its list holds the first 50), else what the list holds.
  const expiringCount = o.leasesExpiringCount ?? o.leasesExpiring.length;
  const shownLeases = o.leasesExpiring.slice(0, LEASES_SHOWN);
  const moreLeases = expiringCount - shownLeases.length;
  // The full list can be opened once the server counts them all (records/leases comes with that update).
  const canOpenAllLeases = o.leasesExpiringCount != null;
  const openAllLeases = () => drill.records(drill.leasesRecords(), ["Occupancy", "Leases expiring"], "Leases expiring");
  const tiles: StatCardProps[] = [
    {
      label: "Occupancy",
      value: pct(o.occupancyPct),
      sub: `${count(o.occupiedSpaces)} of ${count(o.totalSpaces)} spaces in use`,
      icon: "business-outline",
      tone: o.occupancyPct >= 70 ? "success" : o.occupancyPct >= 40 ? "primary" : "warning",
      trend: trend(o.occupancyPct, o.occupancyPctPrev, "pts"),
      trendSeries: recent.map((x) => x.occupancyPct),
      onPress: () => drill.focus("byLocation"),
    },
    {
      label: "New bookings",
      value: count(o.newBookings),
      sub: words,
      icon: "calendar-outline",
      trend: trend(o.newBookings, o.newBookingsPrev, "n"),
      onPress: () => drill.records(drill.newBookingsRecords(), ["Occupancy", "New bookings"], "New bookings"),
    },
    { label: "Active bookings", value: count(o.activeBookings), sub: "running today", icon: "time-outline", tone: "info" },
    {
      label: "Leases expiring",
      value: count(expiringCount),
      sub: "in the next 90 days",
      icon: "hourglass-outline",
      tone: expiringCount ? "warning" : "success",
      onPress: () => drill.focus("leases"),
    },
  ];
  const byType = o.byType.filter((t) => t.total > 0);
  const byLocation = o.byLocation.filter((l) => l.total > 0);
  const openMonth = (i: number) =>
    drill.breakdown({ metric: "bookings-month", month: recent[i].month }, ["New bookings", monthLabel(recent[i].month)]);
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard title="Occupancy trend" caption="Last 12 months. Tap a month for its new bookings by location.">
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
              series={[{ label: view === "occupancy" ? "Occupancy" : "New bookings", tone: view === "occupancy" ? undefined : "indigo" }]}
              data={recent.map((x) => ({
                label: monthShort(x.month),
                title: monthLabel(x.month),
                values: [view === "occupancy" ? x.occupancyPct : x.newBookings],
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
        <ChartCard title="By space type" caption="Spaces in use today. Tap a type to see it by location.">
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
                if (t.spaceTypeId) drill.breakdown({ metric: "occupancy-type", spaceTypeId: t.spaceTypeId }, ["Occupancy", t.name]);
              }}
            />
          ) : (
            <InlineEmpty text="No spaces set up." />
          )}
        </ChartCard>
        <View ref={drill.target("byLocation")} collapsable={false}>
          <ChartCard title="By location" caption="Spaces in use today. Tap a location to see it by space type.">
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
        </View>
        <View ref={drill.target("leases")} collapsable={false}>
          <ChartCard
            title="Leases expiring"
            caption={["Ending in the next 90 days", o.leasesExpiringMonthly ? `${money(o.leasesExpiringMonthly)} a month` : null].filter(Boolean).join(" · ")}
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
  const colorOf = useInquiryTypeColors();
  const stage = (key: string) => s.funnel.find((f) => f.stage === key)?.count ?? 0;
  const inquiries = stage("inquiries");
  const quotations = stage("quotations");
  const bookings = stage("bookings");
  const rate = s.conversionRate ?? (quotations > 0 ? (bookings / quotations) * 100 : null);
  const top = s.funnel[0]?.count ?? 0;
  const typeTotal = s.inquiriesByType.reduce((sum, t) => sum + t.count, 0);
  const tiles: StatCardProps[] = [
    {
      label: "Tour inquiries",
      value: count(inquiries),
      sub: inquiryWords,
      icon: "walk-outline",
      onPress: () => drill.records(drill.funnelRecords("inquiries"), ["Sales", "Tour inquiries"], "Tour inquiries"),
    },
    {
      label: "Conversion",
      value: rate != null ? pct(rate) : "—",
      sub: "bookings per quotation",
      icon: "trending-up-outline",
      tone: rate != null && rate >= 30 ? "success" : quotations ? "warning" : "neutral",
    },
    { label: "Quotation value", value: money(s.quotationValue), sub: `${count(quotations)} quotations ${words}`, icon: "document-text-outline", tone: "indigo" },
    { label: "Booking value", value: money(s.bookingValue), sub: `${count(bookings)} bookings ${words}`, icon: "calendar-outline", tone: "success" },
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
                  accessibilityLabel={`Conversion ${words}: ${rate != null ? pct(rate) : "not available"}. ${bookings} bookings from ${quotations} quotations.`}
                />
                <View style={styles.facts}>
                  <Fact label="Quotations" value={`${count(quotations)} · ${money(s.quotationValue)}`} />
                  <Fact label="Bookings" value={`${count(bookings)} · ${money(s.bookingValue)}`} />
                </View>
              </View>
              <HBarList
                style={styles.gapTop}
                label={`Sales funnel ${words}`}
                items={s.funnel.map((f) => ({
                  key: f.stage,
                  label: f.stage === "inquiries" && inquiriesEverywhere ? `${f.label} (all locations)` : f.label,
                  value: f.count,
                  // No share over 100% (most quotations don't start as tour inquiries): just the count then.
                  valueLabel: top > 0 && f.stage !== s.funnel[0]?.stage && f.count <= top ? `${count(f.count)} · ${pct(shareOf(f.count, top))}` : count(f.count),
                }))}
                itemAccessibilityHint="Opens the list"
                onPressItem={(item) => {
                  const f = s.funnel.find((x) => x.stage === item.key);
                  if (f) drill.records(drill.funnelRecords(f.stage), ["Sales", f.label], f.label);
                }}
              />
            </>
          ) : (
            <InlineEmpty text={`No inquiries or quotations ${words}.`} />
          )}
        </ChartCard>
        <ChartCard title="Inquiries by type" caption={`How visitors found WorkNest, ${inquiryWords}. Tap a type for the last 6 months.`}>
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

export function TeamSection({ team: t, drill }: { team: CeoTeam; drill: Drill }) {
  const words = periodWords(drill.period);
  return (
    <>
      <ChartGrid>
        <ChartCard title="Per location" caption={`Staff and quotations ${words}`} padding={0}>
          {t.perLocation.length ? (
            t.perLocation.map((l, i) => (
              <Fragment key={`${l.locationId ?? l.name}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <ListRow
                  leftIcon="location-outline"
                  title={l.name}
                  subtitle={`${plural(l.admins, "admin", "admins")} · ${plural(l.salesExecutives, "sales executive", "sales executives")}`}
                  meta={`${count(l.quotations)} quotes · ${count(l.converted)} won`}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No locations with staff." />
            </View>
          )}
        </ChartCard>
        <ChartCard title="People" caption={`Quotations and conversions ${words}. Tap a person for the last 6 months.`} padding={0}>
          {t.people.length ? (
            t.people.map((p, i) => (
              <Fragment key={`${p.userId ?? p.name}-${i}`}>
                {i > 0 ? <Divider inset={68} /> : null}
                <ListRow
                  avatar={{ name: p.name }}
                  title={p.name}
                  subtitle={[p.role, p.locations, p.convertedValue ? `${money(p.convertedValue)} won` : null].filter(Boolean).join(" · ")}
                  meta={`${count(p.quotations)} quotes · ${count(p.converted)} won`}
                  accessibilityHint={p.userId ? "Opens this person's last 6 months" : undefined}
                  onPress={p.userId ? () => drill.breakdown({ metric: "staff", userId: p.userId as number }, ["Team", p.name]) : undefined}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No admins or sales executives yet." />
            </View>
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── 3-month outlook (GET dashboard/forecast) ─────────────────────────────────────────────────────────────

export function OutlookSection({ forecast }: { forecast: DashboardForecast }) {
  const rows = forecast.totals;
  if (!rows.length || !rows.some((r) => r.expectedRent > 0 || r.occupiedSpaces > 0)) {
    return (
      <ChartCard title="Expected rent" caption="Rent and occupancy expected from current leases">
        <InlineEmpty text="No current leases to forecast from." />
      </ChartCard>
    );
  }
  return (
    <ChartCard title="Expected rent" caption="Rent and occupancy expected from current leases">
      <BarChart
        height={130}
        label="Expected rent by month"
        series={[{ label: "Expected rent" }]}
        data={rows.map((r) => ({ label: r.month ? monthShort(r.month) : r.label, title: r.label || monthLabel(r.month), values: [r.expectedRent] }))}
        formatValue={money}
        selectable={false}
      />
      <View style={styles.monthList}>
        {rows.map((r, i) => {
          const title = r.label || monthLabel(r.month);
          const caption = `${pct(r.occupancyPct)} occupied · ${count(r.leasesEnding)} ending · ${count(r.leasesStarting)} starting${
            r.pendingStarting ? ` (${count(r.pendingStarting)} waiting)` : ""
          }`;
          return (
            <View key={`${r.month || r.label}-${i}`} style={styles.monthRow} accessible accessibilityLabel={`${title}: expected rent ${money(r.expectedRent)}. ${caption}`}>
              <View style={styles.rowBetween}>
                <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
                  {title}
                </AppText>
                <AppText variant="bodyStrong">{money(r.expectedRent)}</AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                {caption}
              </AppText>
            </View>
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
  monthList: { gap: spacing.md, marginTop: spacing.md },
  monthRow: { gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
