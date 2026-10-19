import { Fragment, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  AppText,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  ListRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
} from "../../../../components/ui";
import type { IllustrationName } from "../../../../components/illustrations/names";
import {
  OVERVIEW_ROW_CAP,
  agreementStatusLabel,
  summaryFigures,
  timelineIcon,
  timelineKindLabel,
  timelineTarget,
  timelineTone,
  type CustomerAgreement,
  type CustomerBooking,
  type CustomerDeposit,
  type CustomerPayment,
  type CustomerReceipt,
  type CustomerSummary,
  type SectionError,
  type SectionResult,
  type TimelineEvent,
  type TimelineTarget,
} from "../../../../services/staff";
import { spacing, statusTone, useThemeColors } from "../../../../theme";
import { formatDate, formatDateRange, formatDateTime, formatMoney } from "../../../../utils/format";
import { KpiGrid } from "../Dashboard/parts";

// Building blocks of the customer detail screen (CMS customer-detail.html): every section shows its own loading,
// error and empty state, so one failing request (e.g. the overview before the database script CD_01 has run) never
// blanks the others. Read-only: rows open the existing detail screens; nothing here records a payment.

/** Rows shown per list before "Show all" (CMS SHORT_LIST). */
export const SHORT_LIST = 10;

/** One section's request: still loading (no answer yet), or its answer. */
export type SectionState<T> = { loading: boolean; result: SectionResult<T> | null };

const join = (parts: ReadonlyArray<string | null | undefined | false>, sep = " · ") => parts.filter(Boolean).join(sep);

// ─── Section states ───────────────────────────────────────────────────────────────────────────────────────

/** "Bookings could not be loaded" + the reason. No retry while the database script is missing (it would not help). */
export function SectionFailure({ error, what, onRetry }: { error: SectionError; what: string; onRetry: () => void }) {
  return (
    <Card>
      <ErrorState
        compact
        icon={error.needsDbUpdate ? "construct-outline" : undefined}
        title={`${what} could not be loaded`}
        message={error.message}
        onRetry={error.needsDbUpdate ? undefined : onRetry}
      />
    </Card>
  );
}

/** Loading skeleton, failure, empty state or the rows of one section. */
export function SectionBody<T>({
  state,
  what,
  onRetry,
  isEmpty,
  empty,
  children,
}: {
  state: SectionState<T>;
  what: string;
  onRetry: () => void;
  isEmpty: (data: T) => boolean;
  empty: { title: string; message?: string; illustration: IllustrationName };
  children: (data: T) => ReactNode;
}) {
  const { loading, result } = state;
  if (loading || !result) return <ListSkeleton rows={3} />;
  if (!result.ok) return <SectionFailure error={result.error} what={what} onRetry={onRetry} />;
  if (isEmpty(result.data)) {
    return (
      <Card>
        <EmptyState compact illustration={empty.illustration} title={empty.title} message={empty.message} />
      </Card>
    );
  }
  return <>{children(result.data)}</>;
}

/** A list cut to SHORT_LIST rows until "Show all" (and the API's 100-row cap said). */
export function ShowAllFooter({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= SHORT_LIST) return null;
  return (
    <View style={styles.footer}>
      <Button
        title={expanded ? "Show fewer" : `Show all ${total}`}
        variant="ghost"
        size="sm"
        onPress={onToggle}
        accessibilityState={{ expanded }}
      />
      {total >= OVERVIEW_ROW_CAP ? (
        <AppText variant="caption" color="textMuted">
          Showing the latest {OVERVIEW_ROW_CAP}.
        </AppText>
      ) : null}
    </View>
  );
}

/** Rows in one card with hairlines between them. */
export function RowsCard<T>({ rows, keyOf, render }: { rows: readonly T[]; keyOf: (row: T, index: number) => string; render: (row: T) => ReactNode }) {
  return (
    <Card padding={0}>
      {rows.map((row, i) => (
        <Fragment key={keyOf(row, i)}>
          {i > 0 ? <Divider inset={16} /> : null}
          {render(row)}
        </Fragment>
      ))}
    </Card>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────────────────────────

/** The five figures (active bookings, invoiced, paid, outstanding with its overdue part, deposit held). */
export function SummarySection({ state, onRetry }: { state: SectionState<{ summary: CustomerSummary }>; onRetry: () => void }) {
  const { loading, result } = state;
  if (loading || !result) return <KpiSkeleton count={5} />;
  if (!result.ok) {
    const { error } = result;
    return (
      <Banner
        tone={error.needsDbUpdate ? "warning" : "danger"}
        title="Summary figures are not available"
        message={error.message}
        actionLabel={error.needsDbUpdate ? undefined : "Try again"}
        onAction={error.needsDbUpdate ? undefined : onRetry}
      />
    );
  }
  return <KpiGrid tiles={summaryFigures(result.data.summary)} />;
}

// ─── Rows ─────────────────────────────────────────────────────────────────────────────────────────────────

export function BookingRow({ booking: b, onPress }: { booking: CustomerBooking; onPress: () => void }) {
  const status = b.status || "Not set";
  const money = join([
    b.monthlyRent != null ? `Rent ${formatMoney(b.monthlyRent)}${b.billingPeriod ? ` (${b.billingPeriod})` : ""}` : null,
    b.balance != null ? `Balance ${formatMoney(b.balance)}` : null,
  ]);
  const subtitle = join([join([b.locationName, formatDateRange(b.startOn, b.endOn)]), money], "\n");
  return (
    <ListRow
      title={b.spaceName || `Booking #${b.bookingId}`}
      subtitle={subtitle}
      subtitleLines={3}
      right={
        <View style={styles.pills}>
          <StatusPill status={b.status} label={status} />
          {b.isActive ? <StatusPill tone="primary" label="Running" icon={false} /> : null}
        </View>
      }
      onPress={onPress}
      accessibilityLabel={join([b.spaceName || `Booking ${b.bookingId}`, b.spaceType, subtitle.replace(/\n/g, ", "), status, b.isActive && "running"], ", ")}
      accessibilityHint="Opens the booking"
    />
  );
}

export function ReceiptRow({ receipt: r, onPress }: { receipt: CustomerReceipt; onPress?: () => void }) {
  const status = r.status || (r.isVoid ? "Void" : "Active");
  const subtitle = join([
    join([formatDate(r.receiptDate), r.invoiceNumber ? `Invoice ${r.invoiceNumber}` : null, r.paymentType]),
    r.isVoid && r.voidReason ? `Void: ${r.voidReason}` : join([r.account, r.createdByName ? `by ${r.createdByName}` : null]),
  ], "\n");
  return (
    <ListRow
      title={r.code || `Receipt #${r.id}`}
      subtitle={subtitle}
      subtitleLines={3}
      meta={formatMoney(r.amount)}
      right={<StatusPill tone={r.isVoid ? "danger" : "success"} label={status} />}
      onPress={onPress}
      accessibilityLabel={join([r.code || `Receipt ${r.id}`, formatMoney(r.amount), subtitle.replace(/\n/g, ", "), status], ", ")}
      accessibilityHint={onPress ? "Opens the invoice" : undefined}
    />
  );
}

export function PaymentRow({ payment: p, onPress }: { payment: CustomerPayment; onPress?: () => void }) {
  const when = p.paidOn || p.createdOn;
  const subtitle = join([
    join([when ? formatDateTime(when) : null, p.method]),
    join([p.reference ? `Ref ${p.reference}` : null, p.invoiceNumber ? `Invoice ${p.invoiceNumber}` : p.bookingId ? `Booking #${p.bookingId}` : null]),
  ], "\n");
  const amount = formatMoney(p.amount, p.currency ? { currency: p.currency } : undefined);
  return (
    <ListRow
      title={amount}
      subtitle={subtitle || null}
      subtitleLines={3}
      right={<StatusPill status={p.status} label={p.status || undefined} />}
      onPress={onPress}
      accessibilityLabel={join([`Payment ${amount}`, subtitle.replace(/\n/g, ", "), p.status], ", ")}
      accessibilityHint={onPress ? (p.invoiceId ? "Opens the invoice" : "Opens the booking") : undefined}
    />
  );
}

export function DepositRow({ deposit: d, onPress }: { deposit: CustomerDeposit; onPress?: () => void }) {
  const closedOn = d.releasedOn || d.forfeitedOn;
  const subtitle = join([
    join([d.bookingId ? `Booking #${d.bookingId}` : null, d.createdOn ? `Held ${formatDate(d.createdOn)}` : null]),
    join([closedOn ? `${d.releasedOn ? "Released" : "Forfeited"} ${formatDate(closedOn)}` : null, d.forfeitReason]),
  ], "\n");
  return (
    <ListRow
      title={d.refNo || `Deposit #${d.id}`}
      subtitle={subtitle || null}
      subtitleLines={3}
      meta={formatMoney(d.amount)}
      right={<StatusPill status={d.state} label={d.state || undefined} />}
      onPress={onPress}
      accessibilityLabel={join([`Security deposit ${d.refNo || d.id}`, formatMoney(d.amount), subtitle.replace(/\n/g, ", "), d.state], ", ")}
      accessibilityHint={onPress ? "Opens the booking" : undefined}
    />
  );
}

export function AgreementRow({ agreement: a, opening, onPress }: { agreement: CustomerAgreement; opening: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const label = agreementStatusLabel(a.status, a.bookingId);
  const quotation = a.quotationNumber ? `${a.quotationNumber}${a.quotationVersion ? ` v${a.quotationVersion}` : ""}` : null;
  const subtitle = join([
    join([quotation, a.spaceName, a.locationName]),
    join([
      a.sentAt ? `Sent ${formatDate(a.sentAt)}` : null,
      a.signedDate ? `Signed ${formatDate(a.signedDate)}` : null,
      a.feeAmount ? `Fee ${formatMoney(a.feeAmount)}` : null,
    ]),
  ], "\n");
  return (
    <ListRow
      title={`Agreement #${a.id}`}
      subtitle={subtitle || null}
      subtitleLines={3}
      right={opening ? <ActivityIndicator size="small" color={colors.primary} /> : <StatusPill tone={a.bookingId ? "success" : statusTone(a.status)} label={label} />}
      onPress={onPress}
      disabled={opening}
      accessibilityLabel={join([`Agreement ${a.id}`, subtitle.replace(/\n/g, ", "), label], ", ")}
      accessibilityHint="Opens the agreement"
    />
  );
}

export function TimelineRow({ event: e, onOpen }: { event: TimelineEvent; onOpen?: (target: TimelineTarget, event: TimelineEvent) => void }) {
  const target = onOpen ? timelineTarget(e) : null;
  const when = e.at ? (e.dateOnly ? formatDate(e.at) : formatDateTime(e.at)) : null;
  const subtitle = join([
    join([timelineKindLabel(e.kind), e.reference, when, e.actorName ? `by ${e.actorName}` : null]),
    e.detail,
    e.note ? `Customer note: ${e.note}` : null,
  ], "\n");
  const amount = e.amount != null && e.amount > 0 ? formatMoney(e.amount) : null;
  return (
    <ListRow
      title={e.title}
      subtitle={subtitle}
      subtitleLines={4}
      meta={amount}
      leftIcon={timelineIcon(e.kind)}
      leftIconTone={timelineTone(e)}
      onPress={target && onOpen ? () => onOpen(target, e) : undefined}
      accessibilityLabel={join([e.title, amount, subtitle.replace(/\n/g, ", ")], ", ")}
      accessibilityHint={target ? `Opens the ${target.kind}` : undefined}
    />
  );
}

/** A titled group inside the Payments section (fee receipts, payments, security deposits). */
export function SubList<T>({
  title,
  rows,
  emptyText,
  expanded,
  onToggle,
  keyOf,
  render,
}: {
  title: string;
  rows: readonly T[];
  emptyText: string;
  expanded: boolean;
  onToggle: () => void;
  keyOf: (row: T, index: number) => string;
  render: (row: T) => ReactNode;
}) {
  return (
    <View style={styles.sub}>
      <SectionHeader title={`${title} (${rows.length})`} variant="overline" />
      {rows.length ? (
        <>
          <RowsCard rows={expanded ? rows : rows.slice(0, SHORT_LIST)} keyOf={keyOf} render={render} />
          <ShowAllFooter total={rows.length} expanded={expanded} onToggle={onToggle} />
        </>
      ) : (
        <AppText variant="bodySmall" color="textMuted" style={styles.subEmpty}>
          {emptyText}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", gap: spacing.xxs },
  pills: { alignItems: "flex-end", gap: spacing.xs },
  sub: { gap: spacing.sm },
  subEmpty: { paddingHorizontal: spacing.xs },
});
