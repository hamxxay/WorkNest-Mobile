import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  ErrorState,
  InfoRow,
  ListSkeleton,
  SectionHeader,
  StatusPill,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  BOOKING_STATUS,
  BOOKING_STATUS_OPTIONS,
  bookingSpaceTypeId,
  cancelBooking,
  downloadBookingChallanPdf,
  emailBookingChallan,
  getAllSpaces,
  getBooking,
  getReassignmentSpaces,
  reassignBooking,
  toApiDate,
  updateBookingStatus,
  type BookingStatusId,
  type ReassignmentSpace,
  type StaffBookingDetail,
} from "../../../../services/staff";
import { normalizeStatus, spacing, useTheme } from "../../../../theme";
import { formatDate, formatDateRange, formatMoney, parseDate } from "../../../../utils/format";
import { StaffScreen } from "../shared/StaffScreen";
import { useAsyncData } from "../shared/hooks";
import { useOpenFile } from "../shared/useOpenFile";
import { useRefreshColors } from "../shared/refresh";

type Route = RouteProp<StaffStackParamList, "BookingDetail">;

/**
 * One booking (GET booking/{id}): customer, space, contract and billing; change the status (PATCH status, as the
 * CMS status menu), cancel (status Cancelled), reassign a confirmed booking to another free space of the same
 * type (PATCH reassign), and the challan PDF / email.
 */
export default function BookingDetailScreen() {
  const { params } = useRoute<Route>();
  const toast = useToast();
  const { opening, open } = useOpenFile();
  const refreshColors = useRefreshColors();
  const fetcher = useCallback(() => getBooking(params.bookingId), [params.bookingId]);
  const { data: b, loading, refreshing, error, reload, refresh } = useAsyncData<StaffBookingDetail>(fetcher);

  const [statusOpen, setStatusOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Errors of an action started from a sheet / dialog are shown there (toasts render under modals).
  const [modalError, setModalError] = useState<string | null>(null);

  const status = normalizeStatus(b?.statusLabel);
  const isCancelled = b?.statusId === BOOKING_STATUS.cancelled;

  const changeStatus = async (statusId: BookingStatusId) => {
    if (!b) return;
    setBusy("status");
    setModalError(null);
    try {
      const result = await updateBookingStatus(b.bookingId, statusId);
      toast.success(result.message);
      setStatusOpen(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not change the status."));
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    if (!b) return;
    setBusy("cancel");
    setModalError(null);
    try {
      const result = await cancelBooking(b.bookingId);
      toast.success(result.message === "Booking status updated." ? "Booking cancelled." : result.message);
      setConfirmCancel(false);
      refresh();
    } catch (err) {
      setModalError(errorMessage(err, "Could not cancel the booking."));
    } finally {
      setBusy(null);
    }
  };

  const emailChallan = async () => {
    if (!b) return;
    setBusy("email");
    try {
      toast.success((await emailBookingChallan(b.bookingId)).message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not email the challan."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title={b ? `Booking #${b.bookingId}` : "Booking"} subtitle={b?.challanNumber ?? undefined} />
      {loading && !b ? (
        <ListSkeleton rows={4} />
      ) : error && !b ? (
        <ErrorState message={error} onRetry={reload} />
      ) : b ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />}
        >
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="heading" numberOfLines={2}>
                  {b.customerName || "Customer"}
                </AppText>
                {b.companyName ? (
                  <AppText variant="bodySmall" color="textMuted">
                    {b.companyName}
                  </AppText>
                ) : null}
              </View>
              <StatusPill status={b.statusLabel || "Unknown"} size="md" />
            </View>
            <Divider spacing={10} />
            {b.customerEmail ? <InfoRow label="Email" value={b.customerEmail} icon="mail-outline" /> : null}
            {b.customerAddress ? <InfoRow label="Address" value={b.customerAddress} icon="home-outline" layout="stacked" /> : null}
            <InfoRow label="Booked on" value={formatDate(b.bookedOn)} icon="time-outline" />
          </Card>

          <SectionHeader title="Space" variant="overline" />
          <Card>
            <InfoRow label="Space" value={[b.spaceName, b.spaceCode].filter(Boolean).join(" · ") || "—"} icon="business-outline" />
            {b.spaceTypeName ? <InfoRow label="Type" value={b.spaceTypeName} /> : null}
            {b.spaceCapacity ? <InfoRow label="Seats" value={String(b.spaceCapacity)} /> : null}
            <InfoRow label="Location" value={[b.locationName, b.cityName].filter(Boolean).join(", ") || "—"} icon="location-outline" />
            {b.offeringType ? <InfoRow label="Offering" value={b.offeringType} /> : null}
            <InfoRow
              label="Contract"
              value={formatDateRange(b.contractStartDate || b.startOn, b.contractEndDate || b.endOn)}
              icon="calendar-outline"
            />
            {b.numberOfMonths ? <InfoRow label="Length" value={`${b.numberOfMonths} months`} /> : null}
          </Card>

          <SectionHeader title="Billing" variant="overline" />
          <Card>
            {b.monthlyRent ? <InfoRow label="Monthly rent" value={formatMoney(b.monthlyRent)} /> : null}
            {b.billingPeriodLabel ? <InfoRow label="Billing" value={b.billingPeriodLabel} /> : null}
            {b.currentCycleAmount ? <InfoRow label="Current cycle" value={formatMoney(b.currentCycleAmount)} /> : null}
            {b.securityDeposit ? <InfoRow label="Security deposit" value={formatMoney(b.securityDeposit)} /> : null}
            {b.totalContractAmount ? <InfoRow label="Contract value" value={formatMoney(b.totalContractAmount)} /> : null}
            <InfoRow label="Paid" value={formatMoney(b.totalPaidAmount)} valueColor="success" />
            <InfoRow label="Balance" value={formatMoney(b.balanceLeft)} emphasize />
            {b.nextBillDueDate ? <InfoRow label="Next bill due" value={formatDate(b.nextBillDueDate)} /> : null}
            {b.challanNumber ? (
              <>
                <Divider spacing={8} />
                <InfoRow label="Challan" value={b.challanNumber} icon="receipt-outline" />
                {b.challanValidUntil ? <InfoRow label="Challan valid until" value={formatDate(b.challanValidUntil)} /> : null}
              </>
            ) : null}
          </Card>

          <View style={styles.actions}>
            <Button title="Change status" leftIcon="swap-horizontal-outline" onPress={() => setStatusOpen(true)} fullWidth />
            {status === "confirmed" ? (
              <Button title="Reassign space" variant="secondary" leftIcon="git-compare-outline" onPress={() => setReassignOpen(true)} fullWidth />
            ) : null}
            <View style={styles.row}>
              <Button
                title="Challan PDF"
                variant="outline"
                leftIcon="document-outline"
                loading={opening === "challan"}
                onPress={() => open("challan", () => downloadBookingChallanPdf(b.bookingId, b.challanNumber), "Booking challan")}
                style={styles.flex}
              />
              <Button title="Email challan" variant="outline" leftIcon="mail-outline" loading={busy === "email"} onPress={emailChallan} style={styles.flex} />
            </View>
            {!isCancelled ? (
              <Button title="Cancel booking" variant="danger" leftIcon="close-circle-outline" onPress={() => setConfirmCancel(true)} fullWidth />
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      {b ? (
        <StatusSheet
          visible={statusOpen}
          current={b.statusId}
          busy={busy === "status"}
          error={modalError}
          onClose={() => {
            setStatusOpen(false);
            setModalError(null);
          }}
          onPick={(id) => {
            if (id === BOOKING_STATUS.cancelled) {
              setStatusOpen(false);
              setConfirmCancel(true);
            } else {
              changeStatus(id);
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        error={modalError}
        visible={confirmCancel}
        title="Cancel this booking?"
        message="The booking is marked Cancelled. The customer loses the space."
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        destructive
        loading={busy === "cancel"}
        onCancel={() => {
          setConfirmCancel(false);
          setModalError(null);
        }}
        onConfirm={doCancel}
       />

      {b && reassignOpen ? (
        <ReassignSheet
          booking={b}
          onClose={() => setReassignOpen(false)}
          onDone={(message) => {
            setReassignOpen(false);
            toast.success(message);
            refresh();
          }}
        />
      ) : null}
    </StaffScreen>
  );
}

function StatusSheet({
  visible,
  current,
  busy,
  error,
  onClose,
  onPick,
}: {
  visible: boolean;
  current: BookingStatusId | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPick: (id: BookingStatusId) => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <BottomSheet error={error} visible={visible} onClose={onClose} dismissible={!busy} title="Change status" subtitle="Any status can be changed to any other, as in the web portal.">
      {BOOKING_STATUS_OPTIONS.map((o) => {
        const selected = o.id === current;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected, disabled: busy }}
            accessibilityLabel={o.label}
            disabled={busy || selected}
            onPress={() => onPick(o.id)}
            android_ripple={{ color: colors.ripple }}
            style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }]}
          >
            <StatusPill status={o.label} />
            <AppText style={[typography.body, styles.flex]}>{selected ? "Current status" : `Set to ${o.label}`}</AppText>
            {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function ReassignSheet({ booking, onClose, onDone }: { booking: StaffBookingDetail; onClose: () => void; onDone: (m: string) => void }) {
  const { colors } = useTheme();
  const [spaces, setSpaces] = useState<ReassignmentSpace[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReassignmentSpace | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setSpaces(null);
    setLoadError(null);
    (async () => {
      // The booking's own space type (from its row). Only an API without it falls back to the space list, matched
      // by space id (space codes repeat across types: "1" is both a meeting room and a shared space).
      const spaceTypeId = bookingSpaceTypeId(booking) ?? bookingSpaceTypeId(booking, await getAllSpaces());
      if (!spaceTypeId) throw new Error("The space type of this booking could not be found. Reassign it from the web portal.");
      const start = parseDate(booking.contractStartDate || booking.startOn);
      const end = parseDate(booking.contractEndDate || booking.endOn);
      if (!start || !end) throw new Error("This booking has no dates to check availability for.");
      return getReassignmentSpaces({
        spaceTypeId,
        startOn: toApiDate(start),
        endOn: toApiDate(end),
        excludeBookingId: booking.bookingId,
      });
    })()
      .then((rows) => alive && setSpaces(rows))
      .catch((err) => alive && setLoadError(errorMessage(err, "Could not load the free spaces.")));
    return () => {
      alive = false;
    };
  }, [booking, attempt]);

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    setSaveError(null);
    try {
      onDone((await reassignBooking(booking.bookingId, picked.id)).message);
    } catch (err) {
      setSaveError(errorMessage(err, "Could not reassign the booking."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      error={saveError}
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Reassign space"
      subtitle={`Free spaces of the same type for ${formatDateRange(booking.contractStartDate || booking.startOn, booking.contractEndDate || booking.endOn)}`}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Reassign" onPress={save} loading={saving} disabled={!picked || saving} style={styles.flex} />
        </>
      }
    >
      {loadError ? (
        <ErrorState compact message={loadError} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !spaces ? (
        <ListSkeleton rows={3} variant="rows" />
      ) : spaces.length === 0 ? (
        <EmptyState compact illustration="building" title="No free spaces" message="No other space of this type is free for these dates." />
      ) : (
        spaces.map((s) => {
          const selected = picked?.id === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${s.name}, ${s.locationName ?? ""}, ${s.capacity} seats`}
              onPress={() => setPicked(s)}
              android_ripple={{ color: colors.ripple }}
              style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface }]}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{[s.name, s.code].filter(Boolean).join(" · ")}</AppText>
                <AppText variant="caption" color="textMuted">
                  {[s.locationName, `${s.capacity} seats`, s.seatPrice ? formatMoney(s.seatPrice) : null].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actions: { gap: spacing.sm },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
