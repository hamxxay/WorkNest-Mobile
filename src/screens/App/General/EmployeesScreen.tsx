import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppHeader,
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  InfoRow,
  ListSkeleton,
  Screen,
  SectionHeader,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { formatDate } from "../../../utils/format";
import { errorMessage } from "../../../services/apiClient";
import {
  accessLabels,
  ADDED_MESSAGE,
  BRANCH_ACCESS_NOTE,
  getBookingEmployees,
  isEmployeesUnavailable,
  PENDING_NOTE,
  PENDING_TEXT,
  REMOVED_MESSAGE,
  SEATS_FULL_TEXT,
  removeBookingEmployee,
  seatsUsedLabel,
  type BookingEmployee,
  type BookingEmployees,
} from "../../../services/employeeService";
import type { AppStackParamList } from "../../../navigation/types";
import { AddEmployeeSheet } from "./employees/AddEmployeeSheet";
import { ScrollableState } from "./shared/ScrollableState";
import { stackSideAction, useContentWidth } from "./shared/layout";

type Route = RouteProp<AppStackParamList, "Employees">;

const ACCESS_ICONS: Record<string, string> = {
  Fingerprint: "finger-print-outline",
  Face: "scan-outline",
  Card: "card-outline",
};
const ACCESS_PENDING = "Access pending: added at the branch";
/** Avatar (40) + its gap (12) + the gap before the Remove button (8): the part of a person row without text. */
const PERSON_ROW_RESERVED = 40 + 12 + 8;

/**
 * The employees of one of the customer's bookings. While the API allows it (Confirmed, not ended, the customer's own
 * booking) the customer adds people up to the booked seats and removes anyone listed; otherwise the list is
 * read-only with the API's reason. People the customer adds wait for a CNIC check at the branch ("pending"); once
 * checked (or when sales added them) they are on the booking ("active") and WorkNest staff enrol fingerprint, face
 * or card there, never here. Removing an active person cancels their door access.
 */
export default function EmployeesScreen() {
  const route = useRoute<Route>();
  const bookingId = Number(route.params?.bookingId) || 0;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirm = useConfirm();
  const toast = useToast();

  const [data, setData] = useState<BookingEmployees | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  // Guards that act at once (state updates are async): one removal at a time, and only the latest load is applied.
  const removingRef = useRef(false);
  const requestRef = useRef(0);

  /** First load and silent reloads (after a change) keep what is shown; `pull` shows the refresh spinner. */
  const load = useCallback(
    async (pull = false) => {
      const request = ++requestRef.current;
      if (pull) setRefreshing(true);
      try {
        const next = await getBookingEmployees(bookingId);
        if (request !== requestRef.current) return;
        setData(next);
        setError("");
        setUnavailable(false);
      } catch (err) {
        if (request !== requestRef.current) return;
        setError(errorMessage(err, "The employees could not be loaded. Please try again."));
        setUnavailable(isEmployeesUnavailable(err));
      } finally {
        if (request === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [bookingId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (employee: BookingEmployee) => {
    if (removingRef.current || !data?.canManage || !(employee.personId > 0)) return;
    removingRef.current = true;
    let message = "";
    try {
      const ok = await confirm({
        title: `Remove ${employee.name}?`,
        message:
          employee.status === "pending"
            ? "They are still waiting for the check at the branch. WorkNest will not add them to this booking."
            : "Their door access will be cancelled.",
        confirmLabel: "Remove",
        cancelLabel: "Keep",
        destructive: true,
        icon: "person-remove-outline",
        onConfirm: async () => {
          setRemovingId(employee.personId);
          message = await removeBookingEmployee(bookingId, employee.personId);
        },
      });
      if (!ok) return;
      toast.success(message || REMOVED_MESSAGE);
      load();
    } catch (err) {
      // The API's own reason (e.g. the booking has ended); reload so the list shows how things are now.
      toast.error(errorMessage(err, "The employee could not be removed. Please try again."));
      load();
    } finally {
      removingRef.current = false;
      setRemovingId(null);
    }
  };

  const spaceName = data?.space ?? route.params?.spaceName ?? null;
  const seatsLeft = data && data.seats !== null ? Math.max(data.seats - data.used, 0) : null;

  return (
    <Screen>
      <AppHeader title="Employees" subtitle={spaceName ?? (bookingId ? `Booking #${bookingId}` : undefined)} />
      {loading && !data ? (
        <View style={styles.content}>
          <ListSkeleton rows={3} />
        </View>
      ) : !data ? (
        <ScrollableState>
          {unavailable ? (
            <ErrorState
              illustration="people"
              title="Not available yet"
              message={error}
              retryLabel="Check again"
              onRetry={() => load()}
            />
          ) : (
            <ErrorState message={error} onRetry={() => load()} />
          )}
        </ScrollableState>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surfaceRaised}
            />
          }
        >
          {error ? <Banner tone="danger" message={error} actionLabel="Try again" onAction={() => load(true)} /> : null}

          <Card>
            <AppText variant="heading" accessibilityRole="header">
              {spaceName ?? "Your booking"}
            </AppText>
            {data.location ? <InfoRow label="Location" value={data.location} icon="location-outline" /> : null}
            <InfoRow label="Seats" value={seatsUsedLabel(data)} icon="people-outline" />
            {data.seats !== null ? <SeatMeter used={data.used} seats={data.seats} /> : null}
          </Card>

          {!data.canManage && data.reason ? (
            <Banner tone="info" title="View only" icon="lock-closed-outline" message={data.reason} />
          ) : null}

          <SectionHeader
            title={`Employees (${data.employees.length})`}
            subtitle={data.pendingCount ? `${data.pendingCount} waiting for check at the branch` : undefined}
            variant="overline"
          />
          {data.employees.length === 0 ? (
            <Card>
              <EmptyState
                compact
                illustration="people"
                title="No employees yet"
                message={
                  data.canManage
                    ? "Add the people who work in this space. WorkNest checks their CNIC at the branch and adds their fingerprint or face there."
                    : "Nobody has been added to this booking."
                }
              />
            </Card>
          ) : (
            <Card padding={0}>
              {data.employees.map((employee, index) => (
                <Fragment key={employee.personId || `row-${index}`}>
                  {index > 0 ? <Divider inset={16} /> : null}
                  <EmployeeRow
                    employee={employee}
                    canRemove={data.canManage && employee.personId > 0}
                    removing={removingId === employee.personId}
                    disabled={removingId !== null}
                    onRemove={() => remove(employee)}
                  />
                </Fragment>
              ))}
            </Card>
          )}

          {data.canManage ? (
            <View style={styles.addBlock}>
              <Button
                title="Add employee"
                leftIcon="person-add-outline"
                fullWidth
                disabled={!data.canAdd || removingId !== null}
                onPress={() => setAdding(true)}
                accessibilityLabel={data.seatsFull ? `Add employee. ${SEATS_FULL_TEXT}` : "Add employee"}
              />
              {data.seatsFull ? (
                <AppText variant="caption" color="textMuted" align="center">
                  {SEATS_FULL_TEXT}. Remove an employee to add someone else.
                </AppText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.note} accessible accessibilityLabel={data.pendingCount ? PENDING_NOTE : BRANCH_ACCESS_NOTE}>
            <Ionicons name="finger-print-outline" size={18} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" style={styles.flex}>
              {data.pendingCount ? PENDING_NOTE : BRANCH_ACCESS_NOTE}
            </AppText>
          </View>
        </ScrollView>
      )}

      {adding && data ? (
        <AddEmployeeSheet
          bookingId={bookingId}
          savedEmployees={data.savedEmployees}
          seatsLeft={seatsLeft}
          onClose={() => setAdding(false)}
          onAdded={(message) => {
            setAdding(false);
            toast.success(message || ADDED_MESSAGE);
            load();
          }}
          onRefused={() => load()}
        />
      ) : null}
    </Screen>
  );
}

function EmployeeRow({
  employee,
  canRemove,
  removing,
  disabled,
  onRemove,
}: {
  employee: BookingEmployee;
  canRemove: boolean;
  removing: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  // The row inside the card (16dp padding each side). On a narrow phone, the Fold cover screen or with large text
  // the Remove button goes under the person's details, which keep the full width for names, CNICs and emails.
  const rowWidth = useContentWidth() - 2 * 16;
  const removeBelow = canRemove && stackSideAction(rowWidth, PERSON_ROW_RESERVED, "Remove", fontScale, true);
  const chips = accessChips(employee);
  const id = employee.idNumber ? `${employee.idType} ${employee.idNumber}` : null;
  const contact = [employee.phone, employee.email].filter(Boolean).join(" · ");
  const added = addedText(employee);
  const spoken = [
    employee.name,
    id,
    employee.phone ? `phone ${employee.phone}` : null,
    employee.email ? `email ${employee.email}` : null,
    added,
    employee.status === "active" && accessLabels(employee.access).length
      ? `door access: ${accessLabels(employee.access).join(", ")}`
      : chips[0].label,
  ]
    .filter(Boolean)
    .join(", ");
  const removeButton = (
    <Button
      title="Remove"
      variant="ghost"
      size="sm"
      leftIcon="person-remove-outline"
      loading={removing}
      disabled={disabled}
      onPress={onRemove}
      accessibilityLabel={`Remove ${employee.name}`}
    />
  );

  return (
    <View style={styles.person}>
      <View style={styles.personTop}>
        <View style={styles.personInfo} accessible accessibilityLabel={spoken}>
          <Avatar name={employee.name} size={40} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{employee.name}</AppText>
            {id ? (
              <AppText variant="caption" color="textMuted">
                {id}
              </AppText>
            ) : null}
            {contact ? (
              <AppText variant="caption" color="textMuted">
                {contact}
              </AppText>
            ) : null}
            {added ? (
              <AppText variant="caption" color="textMuted">
                {added}
              </AppText>
            ) : null}
          </View>
        </View>
        {canRemove && !removeBelow ? removeButton : null}
      </View>
      <AccessChips chips={chips} />
      {removeBelow ? <View style={styles.removeBelow}>{removeButton}</View> : null}
    </View>
  );
}

/** "Added 14 Oct 2026", "Added by WorkNest on 14 Oct 2026", "Added by WorkNest" or null. */
function addedText(employee: BookingEmployee): string | null {
  const on = employee.addedOn ? formatDate(employee.addedOn) : null;
  if (employee.addedBy === "staff") return on ? `Added by WorkNest on ${on}` : "Added by WorkNest";
  return on ? `Added ${on}` : null;
}

type ChipSpec = { label: string; icon: string; tone: "primary" | "neutral" | "warning" };

/**
 * pending: one amber "Waiting for check at the branch" chip (no access chips); active: a teal chip per enrolled
 * access, or one grey "Access pending" chip when staff have not enrolled anything yet.
 */
function accessChips(employee: BookingEmployee): ChipSpec[] {
  if (employee.status === "pending") return [{ label: PENDING_TEXT, icon: "time-outline", tone: "warning" }];
  const labels = accessLabels(employee.access);
  if (!labels.length) return [{ label: ACCESS_PENDING, icon: "hourglass-outline", tone: "neutral" }];
  return labels.map((label) => ({ label, icon: ACCESS_ICONS[label] ?? "checkmark-outline", tone: "primary" }));
}

/** The row's status chips. Hidden from screen readers: the row's label above reads them. */
function AccessChips({ chips: specs }: { chips: ChipSpec[] }) {
  const styles = useThemedStyles(createStyles);
  const { tones } = useTheme();
  const chips = specs.map((spec) => ({ ...spec, tone: tones[spec.tone] }));
  return (
    <View style={styles.chips} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {chips.map((chip) => (
        <View key={chip.label} style={[styles.chip, { backgroundColor: chip.tone.bg, borderColor: chip.tone.border }]}>
          <Ionicons name={chip.icon} size={13} color={chip.tone.fg} />
          <Text maxFontSizeMultiplier={1.3} style={[styles.chipText, { color: chip.tone.fg }]}>
            {chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Seats used as a thin bar (amber when every seat is taken). Decorative: the seats line above says it in words. */
function SeatMeter({ used, seats }: { used: number; seats: number }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const full = used >= seats;
  const ratio = seats > 0 ? Math.min(used / seats, 1) : 0;
  return (
    <View style={styles.meterTrack} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View
        style={[
          styles.meterFill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: full ? colors.warning : colors.primary },
        ]}
      />
    </View>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    flex: { flex: 1 },
    addBlock: { gap: t.spacing.sm },
    note: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm },
    person: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, gap: t.spacing.sm },
    personTop: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm },
    personInfo: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.xs, paddingLeft: 40 + t.spacing.md },
    // Remove under the details: lined up with the text and chips (after the avatar).
    removeBelow: { flexDirection: "row", paddingLeft: 40 + t.spacing.md },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xxs,
      borderRadius: t.radii.pill,
      borderWidth: 1,
      maxWidth: "100%",
    },
    chipText: { ...t.typography.captionStrong, flexShrink: 1 },
    meterTrack: {
      height: 6,
      borderRadius: t.radii.pill,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
      marginTop: t.spacing.sm,
    },
    meterFill: { height: "100%", borderRadius: t.radii.pill },
  });
