import { Fragment, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppText, Card, Divider, FilterChips, InfoRow, ListRow, SegmentedControl, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { dashboardTrend } from "../../../../services/staff";
import type {
  DashboardForecast,
  DashboardOverview,
  LocationComparison,
  SalesDashboard,
  StaffOverview,
  SystemHealth,
  TeamDashboard,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatNumber, formatRelative } from "../../../../utils/format";
import { AttentionList, BarRow, KpiGrid, money } from "./parts";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

const pct = (v: number) => `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}%`;

// ─── Sales executive ──────────────────────────────────────────────────────────────────────────────────────

export function SalesSection({ sales, periodWord }: { sales: SalesDashboard; periodWord: string }) {
  const navigation = useNavigation<Nav>();
  const s = sales;
  const stages = [
    { label: "Draft", n: s.draft, tone: "neutral" as const },
    { label: "Sent", n: s.sent, tone: "info" as const },
    { label: "Accepted", n: s.accepted, tone: "success" as const },
    { label: "Agreement", n: s.agreementStage, tone: "indigo" as const },
    { label: "Converted", n: s.converted, tone: "primary" as const },
    { label: "Lost", n: s.lost, tone: "danger" as const },
  ];
  const max = Math.max(1, ...stages.map((x) => x.n));
  return (
    <>
      <KpiGrid
        tiles={[
          { label: "Quotations", value: s.quotationsCreated, sub: `created ${periodWord}`, icon: "document-text-outline", onPress: () => navigation.navigate("QuotationList") },
          {
            label: "Conversion",
            value: pct(s.conversionPct),
            sub: `${s.converted} converted · ${money(s.convertedValue)}`,
            icon: "trending-up-outline",
            tone: s.conversionPct >= 30 ? "success" : s.quotationsCreated ? "warning" : "neutral",
          },
          {
            label: "New inquiries",
            value: s.newInquiries,
            sub: `${s.inquiriesInPeriod} received ${periodWord}`,
            icon: "walk-outline",
            tone: s.newInquiries ? "warning" : "success",
            onPress: () => navigation.navigate("TourInquiries", { filter: "new" }),
          },
          {
            label: "Follow-ups due",
            value: s.followUpsDue,
            sub: "future prospects to call",
            icon: "call-outline",
            tone: s.followUpsDue ? "danger" : "success",
            onPress: () => navigation.navigate("TourInquiries", { filter: "due" }),
          },
          {
            label: "Renewals due",
            value: s.renewalsDue,
            sub: `leases ending in ${s.renewalDays} days`,
            icon: "refresh-outline",
            tone: s.renewalsDue ? "warning" : "success",
            onPress: () => navigation.navigate("BookingList"),
          },
          {
            label: "Overdue",
            value: money(s.overdue),
            sub: `${s.overdueCount} invoices · ${money(s.outstanding)} outstanding`,
            icon: "alert-circle-outline",
            tone: s.overdueCount ? "danger" : "success",
            onPress: () => navigation.navigate("InvoiceList"),
          },
        ]}
      />
      <Card>
        <AppText variant="subheading">Pipeline {periodWord}</AppText>
        <View style={styles.bars}>
          {stages.map((st) => (
            <BarRow key={st.label} label={st.label} value={String(st.n)} pct={(st.n / max) * 100} tone={st.tone} />
          ))}
        </View>
      </Card>
      {s.followUps.length ? (
        <Card padding={0}>
          <View style={styles.cardTitle}>
            <AppText variant="subheading">Follow-ups</AppText>
          </View>
          {s.followUps.slice(0, 5).map((f, i) => (
            <Fragment key={`${f.contactId}-${i}`}>
              {i > 0 ? <Divider inset={16} /> : null}
              <ListRow
                leftIcon="call-outline"
                title={f.name || "Visitor"}
                subtitle={[f.phone, f.followUpOn ? `due ${formatDate(f.followUpOn)}` : null, f.note].filter(Boolean).join(" · ")}
                onPress={() => navigation.navigate("TourInquiries", { filter: "due" })}
              />
            </Fragment>
          ))}
        </Card>
      ) : null}
      <AttentionCard
        title="Waiting for signature"
        items={s.awaitingSignature}
        empty="No agreements waiting for a signature."
        dateLabel="sent"
        onAll={() => navigation.navigate("AgreementList", { status: "AgreementSent" })}
      />
      <AttentionCard title="Bookings to confirm" items={s.pendingBookings} empty="Nothing waiting for confirmation." dateLabel="starts" />
      <AttentionCard title="Renewals" items={s.renewals} empty="No leases ending soon." dateLabel="ends" />
      <AttentionCard title="Overdue invoices" items={s.overdueInvoices} empty="No overdue invoices." dateLabel="due" onAll={() => navigation.navigate("InvoiceList")} />
    </>
  );
}

function AttentionCard({
  title,
  items,
  empty,
  dateLabel,
  onAll,
}: {
  title: string;
  items: SalesDashboard["renewals"];
  empty: string;
  dateLabel: string;
  onAll?: () => void;
}) {
  const navigation = useNavigation<Nav>();
  return (
    <Card padding={0}>
      <View style={styles.cardTitle}>
        <AppText variant="subheading" style={styles.flex}>
          {title}
        </AppText>
        {items.length ? <StatusPill tone="neutral" label={String(items.length)} /> : null}
      </View>
      <AttentionList items={items} empty={empty} dateLabel={dateLabel} onOpen={(it) => navigation.navigate("BookingDetail", { bookingId: it.bookingId as number })} />
      {onAll && items.length ? <ListRow title="See all" leftIcon="list-outline" onPress={onAll} /> : null}
    </Card>
  );
}

// ─── Admin / super admin overview ─────────────────────────────────────────────────────────────────────────

export function OverviewSection({ data, periodWord }: { data: DashboardOverview; periodWord: string }) {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<"overdue" | "ending" | "pending">("overdue");
  const d = data;
  const maxMonth = Math.max(1, ...d.months.map((m) => Math.max(m.invoiced, m.paid)));
  return (
    <>
      <KpiGrid
        tiles={[
          {
            label: "Occupancy",
            value: pct(d.occupancyPct),
            sub: `${d.occupiedSpaces} of ${d.totalSpaces} spaces in use`,
            icon: "business-outline",
            tone: d.occupancyPct >= 70 ? "success" : d.occupancyPct >= 40 ? "primary" : "warning",
            trend: dashboardTrend(d.occupancyPct, d.occupancyPctLastMonth, "pts"),
            onPress: () => navigation.navigate("Spaces"),
          },
          {
            label: "Active bookings",
            value: d.activeBookings,
            sub: "running today",
            icon: "calendar-outline",
            trend: dashboardTrend(d.activeBookings, d.activeBookingsLastMonth, "n"),
            onPress: () => navigation.navigate("StaffTabs", { screen: "Bookings" }),
          },
          {
            label: "Awaiting confirmation",
            value: d.pendingConfirmations,
            sub: d.pendingConfirmations ? "bookings not yet confirmed" : "nothing waiting",
            icon: "hourglass-outline",
            tone: d.pendingConfirmations ? "warning" : "success",
            onPress: () => navigation.navigate("StaffTabs", { screen: "Bookings" }),
          },
          {
            label: "Outstanding",
            value: money(d.outstanding),
            sub: `${d.outstandingCount} open invoices`,
            icon: "wallet-outline",
            tone: d.outstanding ? "warning" : "success",
            onPress: () => navigation.navigate("InvoiceList"),
          },
          {
            label: "Overdue",
            value: money(d.overdueAmount),
            sub: `${d.overdueCount} invoices past due`,
            icon: "alert-circle-outline",
            tone: d.overdueCount ? "danger" : "success",
            onPress: () => navigation.navigate("InvoiceList"),
          },
          {
            label: "Invoiced",
            value: money(d.invoicedThisPeriod),
            sub: `${money(d.paidThisPeriod)} paid ${periodWord}`,
            icon: "receipt-outline",
            trend: dashboardTrend(d.invoicedThisPeriod, d.invoicedPrevPeriod, "%"),
          },
        ]}
      />
      <Card padding={0}>
        <View style={styles.cardTitle}>
          <AppText variant="subheading">Needs attention</AppText>
        </View>
        <View style={styles.padded}>
          <SegmentedControl
            accessibilityLabel="Needs attention"
            options={[
              { label: `Overdue (${d.overdueInvoices.length})`, value: "overdue" },
              { label: `Ending (${d.endingLeases.length})`, value: "ending" },
              { label: `Pending (${d.pendingBookings.length})`, value: "pending" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
          />
        </View>
        {tab === "overdue" ? (
          <AttentionList items={d.overdueInvoices} empty="No overdue invoices." dateLabel="due" onOpen={(it) => navigation.navigate("BookingDetail", { bookingId: it.bookingId as number })} />
        ) : tab === "ending" ? (
          <AttentionList
            items={d.endingLeases}
            empty={`No leases ending in ${d.endingSoonDays || 30} days.`}
            dateLabel="ends"
            onOpen={(it) => navigation.navigate("BookingDetail", { bookingId: it.bookingId as number })}
          />
        ) : (
          <AttentionList items={d.pendingBookings} empty="No bookings waiting." dateLabel="starts" onOpen={(it) => navigation.navigate("BookingDetail", { bookingId: it.bookingId as number })} />
        )}
      </Card>
      {d.months.length ? (
        <Card>
          <AppText variant="subheading">Invoiced and paid</AppText>
          <View style={styles.bars}>
            {d.months.slice(-6).map((m) => (
              <View key={m.month} style={styles.monthBlock}>
                <BarRow label={`${monthLabel(m.month)} invoiced`} value={money(m.invoiced)} pct={(m.invoiced / maxMonth) * 100} tone="info" />
                <BarRow label="paid" value={`${money(m.paid)} · ${pct(m.occupancyPct)} occupied`} pct={(m.paid / maxMonth) * 100} tone="success" />
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : ym;
}

export function TeamSection({ team }: { team: TeamDashboard }) {
  const navigation = useNavigation<Nav>();
  const t = team;
  return (
    <>
      <KpiGrid
        tiles={[
          { label: "Open complaints", value: t.openComplaints, sub: "open or in progress", icon: "chatbox-ellipses-outline", tone: t.openComplaints ? "danger" : "success", onPress: () => navigation.navigate("Complaints") },
          { label: "New inquiries", value: t.newInquiries, sub: "not handled yet", icon: "walk-outline", tone: t.newInquiries ? "warning" : "success", onPress: () => navigation.navigate("TourInquiries", { filter: "new" }) },
          { label: "KYC to review", value: t.kycPending, sub: "customers with pending documents", icon: "id-card-outline", tone: t.kycPending ? "warning" : "success", onPress: () => navigation.navigate("KycList") },
          { label: "Access suspended", value: t.accessSuspended, sub: "bookings locked for unpaid challans", icon: "lock-closed-outline", tone: t.accessSuspended ? "danger" : "success", onPress: () => navigation.navigate("Attendants") },
          { label: "Machines offline", value: `${t.machinesOffline}/${t.machines}`, sub: t.machinesOffline ? "door machines not reachable" : "all door machines online", icon: "hardware-chip-outline", tone: t.machinesOffline ? "danger" : "success", onPress: () => navigation.navigate("AccessActivity") },
          { label: "WhatsApp unread", value: t.unreadWhatsApp, sub: "chats waiting (web portal)", icon: "logo-whatsapp", tone: t.unreadWhatsApp ? "warning" : "success" },
        ]}
      />
      {t.offlineMachines.length ? (
        <Card>
          <AppText variant="subheading">Offline machines</AppText>
          {t.offlineMachines.map((m) => (
            <InfoRow key={m.name} label={m.name} value={m.lastSeen ? `seen ${formatRelative(m.lastSeen)}` : "never seen"} icon="hardware-chip-outline" />
          ))}
        </Card>
      ) : null}
    </>
  );
}

// ─── Forecast ─────────────────────────────────────────────────────────────────────────────────────────────

export function ForecastSection({ forecast }: { forecast: DashboardForecast }) {
  const [locationId, setLocationId] = useState(0);
  const rows = useMemo(
    () => (locationId ? forecast.locations.find((l) => l.locationId === locationId)?.months ?? [] : forecast.totals),
    [forecast, locationId],
  );
  const maxRent = Math.max(1, ...rows.map((r) => r.expectedRent));
  return (
    <Card>
      {forecast.locations.length > 1 ? (
        <FilterChips
          value={locationId}
          onChange={setLocationId}
          options={[{ label: "All", value: 0 }, ...forecast.locations.map((l) => ({ label: l.name, value: l.locationId }))]}
          accessibilityLabel="Forecast location"
          style={styles.chipBar}
        />
      ) : null}
      {rows.length === 0 || !rows.some((r) => r.expectedRent > 0 || r.occupiedSpaces > 0) ? (
        <AppText variant="bodySmall" color="textMuted" style={styles.gapTop}>
          No current leases to forecast from.
        </AppText>
      ) : (
        <View style={styles.bars}>
          {rows.map((r) => (
            <View key={r.month} style={styles.monthBlock}>
              <BarRow label={r.label || monthLabel(r.month)} value={money(r.expectedRent)} pct={(r.expectedRent / maxRent) * 100} tone="primary" />
              <AppText variant="caption" color="textMuted">
                {pct(r.occupancyPct)} occupied · {r.leasesEnding} ending · {r.leasesStarting} starting
                {r.pendingStarting ? ` (${r.pendingStarting} waiting)` : ""}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ─── Door access ──────────────────────────────────────────────────────────────────────────────────────────

export function DoorAccessSection({ overview }: { overview: Record<string, any> }) {
  const navigation = useNavigation<Nav>();
  const n = (k: string) => Number(overview?.[k] ?? 0) || 0;
  const items: any[] = Array.isArray(overview?.items) ? overview.items : [];
  return (
    <>
      <KpiGrid
        tiles={[
          {
            label: "Door machines",
            value: `${n("devicesOnline")}/${n("devices")}`,
            sub: n("devicesOffline") ? `${n("devicesOffline")} offline` : "all online",
            icon: "hardware-chip-outline",
            tone: n("devicesOffline") ? "danger" : "success",
          },
          {
            label: "Suspended",
            value: n("suspended"),
            sub: `${n("extended")} with temporary access`,
            icon: "lock-closed-outline",
            tone: n("suspended") ? "danger" : "success",
            onPress: () => navigation.navigate("Attendants"),
          },
        ]}
      />
      {items.length ? (
        <Card padding={0}>
          {items.slice(0, 5).map((it, i) => (
            <Fragment key={`${it.suspensionId ?? i}`}>
              {i > 0 ? <Divider inset={16} /> : null}
              <ListRow
                leftIcon={it.extended ? "key-outline" : "lock-closed-outline"}
                leftIconTone={it.extended ? "warning" : "danger"}
                title={String(it.customer ?? "Customer")}
                subtitle={[it.space, it.extended && it.overrideUntil ? `access until ${formatDate(it.overrideUntil)}` : it.reason].filter(Boolean).join(" · ")}
              />
            </Fragment>
          ))}
        </Card>
      ) : null}
    </>
  );
}

// ─── Super admin ──────────────────────────────────────────────────────────────────────────────────────────

export function LocationsSection({ locations }: { locations: LocationComparison[] }) {
  if (!locations.length) return null;
  const sum = (k: keyof LocationComparison) => locations.reduce((a, l) => a + Number(l[k] || 0), 0);
  const spaces = sum("totalSpaces");
  const occupied = sum("occupiedSpaces");
  const rate = (inv: number, col: number) => (inv > 0 ? Math.round((col / inv) * 100) : 0);
  return (
    <Card padding={0}>
      {locations.map((l, i) => (
        <Fragment key={l.locationId}>
          {i > 0 ? <Divider /> : null}
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {l.name}
              </AppText>
              <StatusPill tone={l.occupancyPct >= 70 ? "success" : l.occupancyPct >= 40 ? "primary" : "warning"} label={`${pct(l.occupancyPct)} occupied`} />
            </View>
            <AppText variant="caption" color="textMuted">
              {l.occupiedSpaces}/{l.totalSpaces} spaces · {l.activeBookings} active bookings
            </AppText>
            <AppText variant="caption" color="textMuted">
              Invoiced {money(l.invoiced)} · collected {money(l.collected)} ({rate(l.invoiced, l.collected)}%) · outstanding {money(l.outstanding)}
              {l.overdue ? ` · overdue ${money(l.overdue)}` : ""}
            </AppText>
          </View>
        </Fragment>
      ))}
      <Divider />
      <View style={styles.block}>
        <AppText variant="bodyStrong">All locations</AppText>
        <AppText variant="caption" color="textMuted">
          {occupied}/{spaces} spaces ({spaces ? pct(Math.round((occupied * 1000) / spaces) / 10) : "0%"}) · invoiced {money(sum("invoiced"))} · collected{" "}
          {money(sum("collected"))} · overdue {money(sum("overdue"))}
        </AppText>
      </View>
    </Card>
  );
}

export function StaffSection({ staff }: { staff: StaffOverview }) {
  return (
    <>
      {staff.perLocation.length ? (
        <Card>
          {staff.perLocation.map((l) => (
            <InfoRow key={l.locationId} label={l.name} value={`${l.admins} admins · ${l.salesExecutives} sales`} icon="location-outline" />
          ))}
        </Card>
      ) : null}
      {staff.people.length ? (
        <Card padding={0}>
          {staff.people.map((p, i) => (
            <Fragment key={p.userId || i}>
              {i > 0 ? <Divider inset={68} /> : null}
              <ListRow
                avatar={{ name: p.name }}
                title={p.name}
                subtitle={[p.role.replace(/_/g, " "), p.locations].filter(Boolean).join(" · ")}
                meta={`${p.quotations} quotes · ${p.converted} won`}
              />
            </Fragment>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const JOB_LABELS: Record<string, string> = { online: "Machine status", maintenance: "Maintenance", events: "Event copy", watch: "Access watch", clock: "Clock sync" };

export function SystemSection({ system }: { system: SystemHealth }) {
  return (
    <Card>
      <InfoRow label="Door machine sync" value={<StatusPill tone={system.hikSyncEnabled ? "success" : "neutral"} label={system.hikSyncEnabled ? "On" : "Off"} />} />
      <InfoRow
        label="Machines"
        value={`${system.machines - system.machinesOffline}/${system.machines} online${system.lastMachineSeen ? ` · last seen ${formatRelative(system.lastMachineSeen)}` : ""}`}
        layout="stacked"
      />
      {system.hikJobs.map((j) => (
        <InfoRow
          key={j.job}
          label={JOB_LABELS[j.job.toLowerCase()] ?? j.job}
          value={
            <StatusPill
              tone={j.running ? "info" : j.lastOk === false ? "danger" : j.lastOk ? "success" : "neutral"}
              label={j.running ? "Running" : j.lastFinishedAt ? formatRelative(j.lastFinishedAt) : "Never"}
            />
          }
        />
      ))}
      <Divider spacing={8} />
      <InfoRow
        label="WhatsApp"
        value={system.whatsAppConfigured ? (system.lastWhatsAppMessage ? `last message ${formatRelative(system.lastWhatsAppMessage)}` : "Connected") : "Not set up"}
      />
      <InfoRow label="Emails waiting" value={String(system.emailPending)} />
      <InfoRow label="Emails failed" value={String(system.emailFailed)} valueColor={system.emailFailed ? "danger" : undefined} />
    </Card>
  );
}

const styles = StyleSheet.create({
  bars: { gap: spacing.md, marginTop: spacing.md },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  padded: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  flex: { flex: 1 },
  monthBlock: { gap: 4 },
  chipBar: { flexGrow: 0, flexShrink: 0 },
  gapTop: { marginTop: spacing.sm },
  block: { padding: spacing.lg, gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
