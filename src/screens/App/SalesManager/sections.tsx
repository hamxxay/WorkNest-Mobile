import { Fragment, useMemo, useState, type Ref } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BarChart, Donut, HBarList, type HBarItem } from "../../../components/charts";
import { AppText, Divider, ListRow, SegmentedControl, StatusPill, type StatCardProps } from "../../../components/ui";
import { count, monthLabel, monthShort, pct, periodWords, shareOf, trendForPeriod } from "../../../services/ceo";
import {
  countOf,
  deskTrend,
  desks,
  signedCount,
  smExpiringLeasesRecords,
  smFollowUpsDueRecords,
  smInquiryMonthRecords,
  smInquiryOutcomeRecords,
  smNotInterestedRecords,
  smRecordsForFunnelStage,
  type SmBreakdownQuery,
  type SmFunnel,
  type SmInquiries,
  type SmPerson,
  type SmRecordsQuery,
  type SmRenewals,
  type SmScope,
  type SmTeam,
} from "../../../services/salesManager";
import { dashboardTrend } from "../../../services/staff/dashboard";
import { INQUIRY_TYPE_LABELS, INQUIRY_TYPES, spacing, useInquiryTypeColors } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { ChartCard, ChartGrid, InlineEmpty } from "../Ceo/parts";
import { KpiGrid } from "../Staff/Dashboard/parts";

// The Sales Manager dashboard sections (Sales funnel, Team performance, Tour inquiries, Renewals & desks), built
// from the CEO dashboard's pieces. Read-only: every tappable element drills down (breakdown or records); nothing
// changes data and there are no action buttons. Figures stay on screen as text next to every chart.
//
// No money anywhere: a sales manager sees desks ("91 desks", "1 desk"), quotations, bookings and leases.

/** A breakdown request without the scope (the dashboard adds period, range and location). */
export type SmBreakdownTarget = Omit<SmBreakdownQuery, "period" | "range" | "locationId">;

/** Places on the dashboard a KPI card can scroll to. */
export type SmFocusTarget = "renewalsMonths" | "expiring";

/** What the sections may do: open a drill screen or scroll to a chart. */
export type SmDrill = {
  scope: SmScope;
  breakdown: (target: SmBreakdownTarget, trail: string[]) => void;
  records: (query: SmRecordsQuery | null, trail: string[], title?: string) => void;
  focus: (target: SmFocusTarget) => void;
  /** Ref callback that registers a scroll target. */
  target: (name: SmFocusTarget) => Ref<View>;
};

const DONUT_SIZE = 112;

/** "vs last period" change, or undefined when the previous figure was not sent. */
const trend = (now: number, prev: number | null, unit: "pts" | "n" | "%", upIsGood = true) =>
  prev == null ? undefined : dashboardTrend(now, prev, unit, upIsGood);

/** A change worded for the dashboard's period: "vs previous 15 days" for a custom range, else as it is. */
const forPeriod = <T extends { label: string }>(drill: SmDrill, t: T | undefined) => trendForPeriod(t, drill.scope.period, drill.scope.range);

const plural = countOf;

/** A row of small labelled figures ("QUOTATIONS 115   BOOKINGS 17   DESKS BOOKED 91"), read as one sentence. */
function SummaryStats({ label, items, style }: { label: string; items: { label: string; value: string }[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.summary, style]} accessible accessibilityLabel={`${label}: ${items.map((it) => `${it.label} ${it.value}`).join(", ")}`}>
      {items.map((it) => (
        <View key={it.label} style={styles.summaryItem}>
          <AppText variant="overline" color="textMuted" numberOfLines={1}>
            {it.label}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.tabular}>
            {it.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Sales funnel ─────────────────────────────────────────────────────────────────────────────────────────

export function FunnelSection({ funnel: f, drill }: { funnel: SmFunnel; drill: SmDrill }) {
  const words = periodWords(drill.scope.period);
  const stage = (key: string) => f.stages.find((s) => s.stage === key)?.count ?? 0;
  const quotations = stage("quotations");
  const bookings = stage("bookings");
  // Conversion: of this period's quotations, the ones booked (never above 100%; quotationsBooked <= quotations).
  const rate = f.conversionRate ?? (quotations > 0 ? (f.quotationsBooked / quotations) * 100 : null);
  const top = f.stages[0]?.count ?? 0;
  const recent = f.months.slice(-12);
  const openStage = (key: string, label: string) => drill.records(smRecordsForFunnelStage(key, drill.scope), ["Sales funnel", label], label);
  const totals = recent.reduce(
    (sum, m) => ({ quotations: sum.quotations + m.quotations, bookings: sum.bookings + m.bookings, desks: sum.desks + m.bookedDesks }),
    { quotations: 0, bookings: 0, desks: 0 },
  );

  // Two per row: the third (desks booked, the figure that matters most) takes the whole last row.
  const tiles: StatCardProps[] = [
    {
      label: "Conversion",
      value: rate != null ? pct(rate) : "—",
      sub: quotations ? `${count(f.quotationsBooked)} of ${count(quotations)} quotations booked` : "No quotations yet",
      icon: "trending-up-outline",
      tone: rate != null && rate >= 30 ? "success" : quotations ? "warning" : "neutral",
      trend: rate != null ? forPeriod(drill, trend(rate, f.conversionRatePrev, "pts")) : undefined,
    },
    {
      label: `Desks quoted ${words}`,
      value: count(f.quotedDesks),
      sub: plural(quotations, "quotation", "quotations"),
      icon: "document-text-outline",
      tone: "indigo",
      onPress: () => openStage("quotations", "Quotations"),
    },
    {
      label: `Desks booked ${words}`,
      value: count(f.bookedDesks),
      sub: plural(bookings, "booking", "bookings"),
      icon: "calendar-outline",
      tone: "success",
      trend: forPeriod(drill, deskTrend(f.bookedDesks, f.bookedDesksPrev)),
      trendSeries: recent.map((m) => m.bookedDesks),
      onPress: () => openStage("bookings", "Bookings"),
    },
  ];

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard title="Funnel" caption={`Created ${words}. Tap a stage for the list.`}>
          {f.stages.length ? (
            <HBarList
              label={`Sales funnel ${words}`}
              items={f.stages.map((s) => ({
                key: s.stage,
                label: s.label,
                value: s.count,
                // No share over 100% (most quotations don't start as tour inquiries): just the count then.
                valueLabel: top > 0 && s.stage !== f.stages[0]?.stage && s.count <= top ? `${count(s.count)} · ${pct(shareOf(s.count, top))}` : count(s.count),
              }))}
              itemAccessibilityHint="Opens the list"
              onPressItem={(item) => {
                const s = f.stages.find((x) => x.stage === item.key);
                if (s) openStage(s.stage, s.label);
              }}
            />
          ) : (
            <InlineEmpty text={`No inquiries or quotations ${words}.`} />
          )}
        </ChartCard>
        <ChartCard title="Last 12 months" caption="Quotations, accepted and bookings by month. Tap a month for its desks booked by location.">
          {recent.length ? (
            <>
              <SummaryStats
                label="Last 12 months"
                style={styles.gapBottom}
                items={[
                  { label: "Quotations", value: count(totals.quotations) },
                  { label: "Bookings", value: count(totals.bookings) },
                  { label: "Desks booked", value: count(totals.desks) },
                ]}
              />
              <BarChart
                label="Quotations, accepted and bookings by month"
                series={[{ label: "Quotations" }, { label: "Accepted" }, { label: "Bookings" }]}
                data={recent.map((m) => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.quotations, m.accepted, m.bookings] }))}
                formatValue={count}
                emptyText="No quotations in these months."
                itemAccessibilityHint="Opens this month by location"
                onPressItem={(i) => drill.breakdown({ metric: "funnel-month", month: recent[i].month }, ["Sales funnel", monthLabel(recent[i].month)])}
              />
            </>
          ) : (
            <InlineEmpty text="No sales history yet." />
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── Team performance ─────────────────────────────────────────────────────────────────────────────────────

/** "I-8 · 6 quotes · 2 won (33%) · 6 inquiries" (every person is a sales executive: no role label). */
function personSubtitle(p: SmPerson): string {
  return [
    p.locations,
    `${count(p.quotations)} quotes · ${count(p.converted)} won${p.conversionRate != null ? ` (${pct(p.conversionRate)})` : ""}`,
    p.inquiriesHandled ? plural(p.inquiriesHandled, "inquiry", "inquiries") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function TeamSection({ team: t, drill }: { team: SmTeam; drill: SmDrill }) {
  const words = periodWords(drill.scope.period);
  return (
    <>
      <ChartGrid>
        <ChartCard title="Sales executives" caption={`Ranked by desks sold ${words}. Tap a person for the last 6 months.`} padding={0}>
          {t.people.length ? (
            t.people.map((p, i) => (
              <Fragment key={`${p.userId ?? p.name}-${i}`}>
                {i > 0 ? <Divider inset={68} /> : null}
                <ListRow
                  avatar={{ name: p.name }}
                  title={p.name}
                  subtitle={personSubtitle(p)}
                  subtitleLines={3}
                  meta={desks(p.desksSold)}
                  right={p.followUpsDue ? <StatusPill tone="warning" icon="time-outline" label={`${count(p.followUpsDue)} due`} /> : undefined}
                  accessibilityLabel={[
                    `Rank ${i + 1}: ${p.name}`,
                    personSubtitle(p),
                    `${desks(p.desksSold)} sold`,
                    p.followUpsDue ? plural(p.followUpsDue, "follow-up due", "follow-ups due") : null,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  accessibilityHint={p.userId ? "Opens this person's last 6 months" : undefined}
                  onPress={p.userId ? () => drill.breakdown({ metric: "staff", userId: p.userId as number }, ["Team", p.name]) : undefined}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No sales executives at your locations yet." />
            </View>
          )}
        </ChartCard>
        <ChartCard title="Per location" caption={`Quotations, converted and desks sold ${words}`} padding={0}>
          {t.perLocation.length ? (
            t.perLocation.map((l, i) => (
              <Fragment key={`${l.locationId ?? l.name}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <ListRow
                  leftIcon="location-outline"
                  title={l.name}
                  subtitle={[
                    plural(l.salesExecutives, "sales executive", "sales executives"),
                    plural(l.quotations, "quotation", "quotations"),
                    `${count(l.converted)} converted`,
                  ].join(" · ")}
                  meta={desks(l.desksSold)}
                  accessibilityLabel={[
                    l.name,
                    plural(l.salesExecutives, "sales executive", "sales executives"),
                    plural(l.quotations, "quotation", "quotations"),
                    `${count(l.converted)} converted`,
                    `${desks(l.desksSold)} sold`,
                  ].join(", ")}
                />
              </Fragment>
            ))
          ) : (
            <View style={styles.padded}>
              <InlineEmpty text="No locations with sales figures." />
            </View>
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── Tour inquiries ───────────────────────────────────────────────────────────────────────────────────────

export function InquiriesSection({ inquiries: q, drill }: { inquiries: SmInquiries; drill: SmDrill }) {
  const words = periodWords(drill.scope.period);
  const colorOf = useInquiryTypeColors();
  const typeTotal = q.byType.reduce((sum, t) => sum + t.count, 0);
  const recent = q.months.slice(-12);

  const tiles: StatCardProps[] = [
    {
      label: "Tour inquiries",
      value: count(q.total),
      sub: `${count(q.followedUp)} followed up`,
      icon: "walk-outline",
      trend: forPeriod(drill, trend(q.total, q.totalPrev, "%")),
      trendSeries: recent.map((m) => INQUIRY_TYPES.reduce((sum, t) => sum + m.counts[t], 0)),
      onPress: () => drill.records(smRecordsForFunnelStage("inquiries", drill.scope), ["Tour inquiries", "All inquiries"], "Tour inquiries"),
    },
    {
      label: "Follow-ups due",
      value: count(q.followUpsDue),
      sub: "due today or earlier",
      icon: "time-outline",
      tone: q.followUpsDue ? "warning" : "success",
      onPress: () => drill.records(smFollowUpsDueRecords(drill.scope), ["Tour inquiries", "Follow-ups due"], "Follow-ups due"),
    },
    {
      label: "Converted",
      value: count(q.converted),
      sub: words,
      icon: "checkmark-circle-outline",
      tone: "success",
      onPress: () => drill.records(smInquiryOutcomeRecords("converted", drill.scope), ["Tour inquiries", "Converted"], "Converted inquiries"),
    },
    {
      label: "Not interested",
      value: count(q.notInterested),
      sub: words,
      icon: "close-circle-outline",
      tone: "neutral",
      onPress: () => drill.records(smInquiryOutcomeRecords("not_interested", drill.scope), ["Tour inquiries", "Not interested"], "Not interested"),
    },
  ];

  const typeItems = useMemo(
    () =>
      q.byType.map(
        (t): HBarItem => ({
          key: t.key,
          label: t.label,
          value: t.count,
          valueLabel: `${count(t.count)} · ${pct(shareOf(t.count, typeTotal))}`,
          color: colorOf(t.type),
        }),
      ),
    [q.byType, typeTotal, colorOf],
  );

  const monthSeries = useMemo(() => INQUIRY_TYPES.map((t) => ({ label: INQUIRY_TYPE_LABELS[t], color: colorOf(t) })), [colorOf]);

  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <ChartCard title="By type" caption={`How visitors found WorkNest, ${words}. Tap a type for the last 6 months.`}>
          {typeItems.length && typeTotal > 0 ? (
            <>
              <View style={styles.donutCenter}>
                <Donut
                  size={DONUT_SIZE}
                  segments={q.byType.map((t) => ({ label: t.label, value: t.count, color: colorOf(t.type) }))}
                  legend={false}
                  centerLabel={count(typeTotal)}
                  centerCaption="inquiries"
                  label={`Tour inquiries by type ${words}`}
                />
              </View>
              <HBarList
                style={styles.gapTop}
                label="Tour inquiries by type"
                items={typeItems}
                itemAccessibilityHint="Opens this type by month"
                onPressItem={(item) => {
                  const t = q.byType.find((x) => x.key === item.key);
                  if (t) drill.breakdown({ metric: "inquiries-type", type: t.key }, ["Tour inquiries", t.label]);
                }}
              />
            </>
          ) : (
            <InlineEmpty text={`No tour inquiries ${words}.`} />
          )}
        </ChartCard>
        <ChartCard title="Why not interested" caption={`Top reasons ${words}. Tap a reason for those inquiries.`}>
          {q.notInterestedReasons.length ? (
            <HBarList
              label="Not interested reasons"
              items={q.notInterestedReasons.map((r, i) => ({ key: `${r.reason}-${i}`, label: r.reason, value: r.count, tone: "neutral" }))}
              formatValue={count}
              itemAccessibilityHint="Opens these inquiries"
              onPressItem={(_item, i) => {
                const r = q.notInterestedReasons[i];
                if (r) drill.records(smNotInterestedRecords(r.reason, drill.scope), ["Tour inquiries", "Not interested", r.reason], "Not interested");
              }}
            />
          ) : (
            <InlineEmpty text={`No inquiries marked not interested ${words}.`} />
          )}
        </ChartCard>
        <ChartCard title="Last 12 months" caption="Tour inquiries by type each month. Tap a month for its inquiries.">
          {recent.length ? (
            <BarChart
              stacked
              label="Tour inquiries by type and month"
              series={monthSeries}
              data={recent.map((m) => ({
                label: monthShort(m.month),
                title: monthLabel(m.month),
                values: INQUIRY_TYPES.map((t) => m.counts[t]),
              }))}
              formatValue={count}
              emptyText="No tour inquiries in these months."
              itemAccessibilityHint="Opens this month's inquiries"
              onPressItem={(i) =>
                drill.records(smInquiryMonthRecords(recent[i].month, drill.scope), ["Tour inquiries", monthLabel(recent[i].month)], `Tour inquiries, ${monthLabel(recent[i].month)}`)
              }
            />
          ) : (
            <InlineEmpty text="No inquiry history yet." />
          )}
        </ChartCard>
      </ChartGrid>
    </>
  );
}

// ─── Renewals & desks ─────────────────────────────────────────────────────────────────────────────────────

type RenewalsView = "desks" | "leases";

const LEASES_SHOWN = 8;

/** "in 12 days" / "today" / "ended 3 days ago"; null when not sent. */
function daysLeftWords(days: number | null): string | null {
  if (days == null) return null;
  const n = Math.round(days);
  if (n === 0) return "ends today";
  if (n < 0) return `ended ${plural(-n, "day", "days")} ago`;
  return `in ${plural(n, "day", "days")}`;
}

export function RenewalsSection({ renewals: r, drill }: { renewals: SmRenewals; drill: SmDrill }) {
  const words = periodWords(drill.scope.period);
  const [view, setView] = useState<RenewalsView>("desks");
  // Booked desks only go up to this month; desks ending and leases ending also cover the next 3.
  const thisMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const pastMonths = useMemo(() => r.months.filter((m) => !m.month || m.month <= thisMonth).slice(-12), [r.months, thisMonth]);
  const months = r.months.slice(-15);
  // The KPIs and "and N more" open the full list (records/leases); the card below shows the first few.
  const openLeases = (withinDays?: number) =>
    drill.records(
      smExpiringLeasesRecords(drill.scope, withinDays),
      ["Renewals", withinDays ? `Ending within ${withinDays} days` : "Leases expiring"],
      withinDays ? `Leases ending within ${withinDays} days` : "Leases expiring",
    );
  const shownLeases = r.expiring.slice(0, LEASES_SHOWN);
  const moreLeases = r.expiringCount - shownLeases.length;

  // Two per row: the third (net desks) takes the whole last row.
  const tiles: StatCardProps[] = [
    {
      label: "Desks ending in 90 days",
      value: count(r.expiringDesks),
      sub: plural(r.expiringCount, "lease", "leases"),
      icon: "hourglass-outline",
      tone: r.expiringDesks || r.expiringCount ? "warning" : "success",
      onPress: () => openLeases(),
    },
    {
      label: "Desks ending within 30 days",
      value: count(r.expiring30Desks),
      sub: plural(r.expiring30Count, "lease", "leases"),
      icon: "alarm-outline",
      tone: r.expiring30Desks || r.expiring30Count ? "danger" : "success",
      onPress: () => openLeases(30),
    },
    {
      label: `Net desks ${words}`,
      value: signedCount(r.netDesks),
      sub: `${count(r.bookedDesks)} booked, ${count(r.endedDesks)} ended`,
      icon: "swap-vertical-outline",
      tone: r.netDesks > 0 ? "success" : r.netDesks < 0 ? "danger" : "neutral",
      trend: forPeriod(drill, deskTrend(r.netDesks, r.netDesksPrev)),
      trendSeries: pastMonths.map((m) => m.bookedDesks - m.endingDesks),
      onPress: () => {
        setView("desks");
        drill.focus("renewalsMonths");
      },
    },
  ];
  const openMonth = (i: number) => {
    const month = months[i]?.month;
    if (!month) return;
    if (view === "desks") drill.breakdown({ metric: "desks-month", month }, ["Desks", monthLabel(month)]);
    else drill.breakdown({ metric: "renewals-month", month }, ["Renewals", monthLabel(month)]);
  };
  return (
    <>
      <KpiGrid tiles={tiles} />
      <ChartGrid>
        <View ref={drill.target("renewalsMonths")} collapsable={false}>
          <ChartCard
            title={view === "desks" ? "Desks booked & desks ending" : "Leases ending"}
            caption="Last 12 months and the next 3. Tap a month to see it by location."
          >
            <SegmentedControl
              accessibilityLabel="Chart shows"
              options={[
                { label: "Desks", value: "desks" },
                { label: "Leases ending", value: "leases" },
              ]}
              value={view}
              onChange={setView}
            />
            {months.length ? (
              view === "desks" ? (
                <BarChart
                  key="desks"
                  style={styles.gapTop}
                  label="Desks booked and desks ending by month"
                  series={[{ label: "Desks booked", tone: "success" }, { label: "Desks ending", tone: "warning" }]}
                  data={months.map((m) => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.bookedDesks, m.endingDesks] }))}
                  formatValue={count}
                  emptyText="No desks booked or ending in these months."
                  itemAccessibilityHint="Opens this month by location"
                  onPressItem={openMonth}
                />
              ) : (
                <BarChart
                  key="leases"
                  style={styles.gapTop}
                  label="Leases ending by month"
                  series={[{ label: "Leases ending", tone: "warning" }]}
                  data={months.map((m) => ({ label: monthShort(m.month), title: monthLabel(m.month), values: [m.expiring] }))}
                  formatValue={count}
                  emptyText="No leases end in these months."
                  itemAccessibilityHint="Opens this month by location"
                  onPressItem={openMonth}
                />
              )
            ) : (
              <InlineEmpty text="No history yet." />
            )}
          </ChartCard>
        </View>
        <View ref={drill.target("expiring")} collapsable={false}>
          <ChartCard title="Leases expiring" caption="Ending in the next 90 days, soonest first" padding={0}>
            {r.expiring.length ? (
              <>
                <SummaryStats
                  label="Leases expiring"
                  style={styles.summaryPadded}
                  items={[
                    { label: "Leases", value: count(r.expiringCount) },
                    { label: "Desks", value: count(r.expiringDesks) },
                  ]}
                />
                {shownLeases.map((l, i) => (
                  <Fragment key={`${l.bookingId ?? l.customer}-${i}`}>
                    <Divider inset={16} />
                    <ListRow
                      leftIcon="hourglass-outline"
                      leftIconTone={l.daysLeft != null && l.daysLeft <= 30 ? "danger" : "warning"}
                      title={l.customer}
                      subtitle={[l.space, l.location, l.endOn ? `ends ${formatDate(l.endOn)}` : null, daysLeftWords(l.daysLeft)].filter(Boolean).join(" · ")}
                      meta={desks(l.desks)}
                    />
                  </Fragment>
                ))}
                {moreLeases > 0 ? (
                  <>
                    <Divider inset={16} />
                    <ListRow
                      leftIcon="list-outline"
                      title={`All ${count(r.expiringCount)} leases expiring`}
                      subtitle={`and ${count(moreLeases)} more not shown here`}
                      accessibilityHint="Opens every lease ending in the next 90 days"
                      onPress={() => openLeases()}
                    />
                  </>
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

const styles = StyleSheet.create({
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  gapTop: { marginTop: spacing.md },
  gapBottom: { marginBottom: spacing.md },
  donutCenter: { alignItems: "center" },
  summary: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xl, rowGap: spacing.sm },
  summaryItem: { gap: 2 },
  // Under the list card's heading hairline (ChartCard padding 0): room above as well as below.
  summaryPadded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tabular: { fontVariant: ["tabular-nums"] },
});
