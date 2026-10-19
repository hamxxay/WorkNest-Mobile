import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  DateField,
  EmptyState,
  ErrorState,
  FieldLabel,
  FieldMessage,
  KpiSkeleton,
  ListSkeleton,
  ResponsiveGrid,
  Screen,
  SectionHeader,
  TextField,
  useToast,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { errorMessage } from "../../../services/apiClient";
import {
  bookFreeMeetingRoom,
  bookingSummary,
  buildMeetingRoomSlots,
  canBookFreeMeetingRoom,
  clampDuration,
  clampMeetingRoomDate,
  durationOptions,
  getFreeMeetingRooms,
  getMeetingRoomEntitlement,
  getMeetingRoomSpaceConfig,
  getMyFreeMeetingRooms,
  hoursLabel,
  isDurationAllowed,
  meetingRoomOpeningHours,
  meetingRoomToday,
  NO_FREE_HOURS_TEXT,
  NOTES_MAX_LENGTH,
  seatsText,
  type FreeMeetingRoomBooking,
  type MeetingRoom,
  type MeetingRoomEntitlement,
  type MeetingRoomSlot,
} from "../../../services/meetingRoomService";
import { formatDate, parseDate, toYmdLocal } from "../../../utils/format";
import { haptics } from "../../../utils/haptics";
import type { AppStackParamList } from "../../../navigation/types";
import { AllowanceCard } from "./meetingRooms/AllowanceCard";
import { CancelFreeBookingSheet } from "./meetingRooms/CancelFreeBookingSheet";
import { ChoiceTile } from "./meetingRooms/ChoiceTile";
import { FreeBookingCard } from "./meetingRooms/FreeBookingCard";
import { ScrollableState } from "./shared/ScrollableState";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** Narrowest a start-time tile gets ("10:00 AM - 12:00 PM" on one or two lines): two per row on phones. */
const SLOT_MIN_WIDTH = 140;
/** "Passed" is checked again every minute while the screen is open. */
const CLOCK_TICK_MS = 60_000;

/**
 * My Meeting Rooms, like the website's page: the free meeting-room hours that come with a confirmed private office
 * booking (a monthly allowance). The customer picks a date, a room at their private office location, 1..max whole
 * hours (no more than the hours left) and a free start time within the meeting-room opening hours, then books with
 * the free hours; their free bookings are listed below with Cancel before the start. No private office: an empty
 * state with the API's reason and Book a tour. The API checks every rule again; all times are Pakistan time.
 */
export default function MyMeetingRoomsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  // ---- choices ----
  const [today, setToday] = useState(() => meetingRoomToday());
  const [now, setNow] = useState(() => Date.now());
  const [date, setDate] = useState(today);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [startSlot, setStartSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // ---- data ----
  const [entitlement, setEntitlement] = useState<MeetingRoomEntitlement | null>(null);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [bookings, setBookings] = useState<FreeMeetingRoomBooking[]>([]);
  const [spaceConfig, setSpaceConfig] = useState<unknown[]>([]);

  // ---- state ----
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementLoaded, setEntitlementLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<FreeMeetingRoomBooking | null>(null);

  // Only the answer for the latest date is applied (the customer may pick dates quickly); one booking at a time.
  const dateRequest = useRef(0);
  const bookingsRequest = useRef(0);
  const submittingRef = useRef(false);

  const loadRooms = useCallback(async (seq: number, forDate: string) => {
    setRoomsLoading(true);
    setRoomsError("");
    try {
      const next = await getFreeMeetingRooms(forDate);
      if (seq !== dateRequest.current) return;
      setRooms(next);
      // Keep the chosen room while it is still offered; a single room is chosen for the customer.
      setSpaceId((prev) => (next.some((r) => r.spaceId === prev) ? prev : next.length === 1 ? next[0].spaceId : null));
      setRoomsLoading(false);
    } catch (err) {
      if (seq !== dateRequest.current) return;
      setRooms([]);
      setRoomsLoading(false);
      setRoomsError(errorMessage(err, "The meeting rooms could not be loaded."));
    }
  }, []);

  /** Allowance and rooms for a date (the allowance is per calendar month and private office). */
  const loadForDate = useCallback(
    async (forDate: string) => {
      const seq = ++dateRequest.current;
      // An error stays on screen (its Retry spinning) until the new answer is in.
      setEntitlementLoading(true);
      try {
        const next = await getMeetingRoomEntitlement(forDate);
        if (seq !== dateRequest.current) return;
        setLoadError("");
        setEntitlement(next);
        setEntitlementLoading(false);
        setEntitlementLoaded(true);
        setDurationHours((d) => clampDuration(d, next.maxBookingHours, next.remainingMinutes));
        if (next.hasEntitlement) {
          await loadRooms(seq, forDate);
        } else {
          setRooms([]);
          setSpaceId(null);
          setStartSlot(null);
        }
      } catch (err) {
        if (seq !== dateRequest.current) return;
        // E.g. 503 "Database update needed: run the script MR_01_meeting_rooms_TEST ...": the API's own message.
        setEntitlement(null);
        setRooms([]);
        setEntitlementLoading(false);
        setEntitlementLoaded(true);
        setLoadError(errorMessage(err, "Your meeting-room hours could not be loaded."));
      }
    },
    [loadRooms],
  );

  const loadBookings = useCallback(async () => {
    const seq = ++bookingsRequest.current;
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const next = await getMyFreeMeetingRooms();
      if (seq !== bookingsRequest.current) return;
      setBookings(next);
    } catch (err) {
      if (seq !== bookingsRequest.current) return;
      setBookings([]);
      setBookingsError(errorMessage(err, "Your meeting-room bookings could not be loaded."));
    } finally {
      if (seq === bookingsRequest.current) setBookingsLoading(false);
    }
  }, []);

  // First load: opening hours (defaults when they can't be read), the allowance for today and the bookings.
  const signedIn = !!user;
  const firstDate = useRef(date);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    getMeetingRoomSpaceConfig().then((rows) => active && setSpaceConfig(rows));
    loadForDate(firstDate.current);
    loadBookings();
    return () => {
      active = false;
    };
  }, [signedIn, loadForDate, loadBookings]);

  // Start times that pass while the screen is open turn grey.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  /** Both parts again (Retry, pull to refresh); a new day in Pakistan moves a past date to today. */
  const reloadAll = useCallback(async () => {
    const nextToday = meetingRoomToday();
    const nextDate = clampMeetingRoomDate(date, nextToday);
    setToday(nextToday);
    setNow(Date.now());
    if (nextDate !== date) {
      setDate(nextDate);
      setStartSlot(null);
    }
    await Promise.all([loadForDate(nextDate), loadBookings()]);
  }, [date, loadForDate, loadBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadAll();
    } finally {
      setRefreshing(false);
    }
  };

  // ---- derived ----
  const hasEntitlement = !!entitlement?.hasEntitlement;
  const remainingMinutes = entitlement?.remainingMinutes ?? 0;
  const maxBookingHours = entitlement?.maxBookingHours ?? 0;
  const selectedRoom = rooms.find((r) => r.spaceId === spaceId) ?? null;
  const roomLocationId = selectedRoom?.locationId ?? entitlement?.locationId ?? null;
  const openingHours = useMemo(() => meetingRoomOpeningHours(spaceConfig, roomLocationId), [spaceConfig, roomLocationId]);
  const slots = useMemo<MeetingRoomSlot[]>(
    () =>
      selectedRoom
        ? buildMeetingRoomSlots({ date, hours: openingHours, durationHours, busy: selectedRoom.busy, now })
        : [],
    [selectedRoom, date, openingHours, durationHours, now],
  );
  const freeSlotCount = slots.filter((s) => s.available).length;
  const selectedSlot = slots.find((s) => s.start === startSlot) ?? null;
  const canSubmit =
    !submitting &&
    !entitlementLoading &&
    canBookFreeMeetingRoom({ entitlement, spaceId, startSlot, durationHours, slots });

  // A chosen start that is no longer free (another duration or room, the room was taken, time passed) is cleared.
  useEffect(() => {
    if (startSlot && !slots.some((s) => s.start === startSlot && s.available)) setStartSlot(null);
  }, [slots, startSlot]);

  // ---- choices ----
  const onDateChange = (picked: Date) => {
    const value = clampMeetingRoomDate(toYmdLocal(picked), today);
    if (!value || value === date) return;
    setDate(value);
    setStartSlot(null);
    setFormError("");
    loadForDate(value);
  };

  const pickRoom = (room: MeetingRoom) => {
    if (room.spaceId === spaceId) return;
    setSpaceId(room.spaceId);
    setStartSlot(null);
    setFormError("");
  };

  const pickDuration = (hours: number) => {
    if (!isDurationAllowed(hours, remainingMinutes) || hours === durationHours) return;
    haptics.selection();
    setDurationHours(hours);
    setFormError("");
  };

  const pickSlot = (slot: MeetingRoomSlot) => {
    if (!slot.available) return;
    setStartSlot(slot.start);
    setFormError("");
  };

  // ---- book ----
  const submit = async () => {
    if (submittingRef.current) return;
    if (!spaceId || !startSlot) {
      setFormError("Choose a room and a start time.");
      return;
    }
    if (!canSubmit) {
      setFormError("This time is not available. Please choose another start time or a shorter booking.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      const message = await bookFreeMeetingRoom({ spaceId, date, start: startSlot, durationHours, notes });
      setStartSlot(null);
      setNotes("");
      toast.success(message, { title: "Meeting room booked" });
      loadForDate(date);
      loadBookings();
    } catch (err) {
      setFormError(errorMessage(err, "The meeting room could not be booked."));
      loadForDate(date); // the room may have been taken meanwhile
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onCancelled = (message: string) => {
    setCancelTarget(null);
    toast.success(message, { title: "Booking cancelled" });
    loadForDate(date);
    loadBookings();
  };

  const title = "My meeting rooms";
  const minimumDate = parseDate(today) ?? undefined;

  if (!user) {
    return (
      <Screen>
        <AppHeader title={title} />
        <ScrollableState>
          <EmptyState
            icon="business-outline"
            title="Sign in to see your meeting-room hours"
            message="Free meeting-room hours come with a private office. Sign in to book them."
            actionLabel="Sign in"
            onAction={() => navigation.navigate("Login", { redirectAfterLogin: { screen: "MyMeetingRooms" } })}
          />
        </ScrollableState>
      </Screen>
    );
  }

  // ---- the list of free bookings (also shown under the no-office state when there are any) ----
  const bookingList: ReactNode = bookingsLoading && !bookings.length ? (
    <ListSkeleton rows={2} avatar={false} />
  ) : bookingsError ? (
    <Card>
      <ErrorState compact title="Could not load your bookings" message={bookingsError} onRetry={loadBookings} />
    </Card>
  ) : !bookings.length ? (
    <Card>
      <EmptyState compact icon="calendar-outline" title="You have no free meeting-room bookings yet." />
    </Card>
  ) : (
    <View style={styles.list}>
      {bookings.map((b) => (
        <FreeBookingCard key={b.bookingId} booking={b} onCancel={() => setCancelTarget(b)} />
      ))}
    </View>
  );

  const noOffice = (
    <>
      <Card>
        <EmptyState
          compact
          icon="business-outline"
          title="Free meeting-room hours come with a private office"
          message={entitlement?.message ?? undefined}
        />
        <View style={styles.fields}>
          <DateField
            label="Private office starting later? Check another date"
            value={date}
            onChange={onDateChange}
            minimumDate={minimumDate}
            disabled={entitlementLoading}
            helperText={entitlementLoading ? "Checking your hours for this date..." : undefined}
          />
          <Button
            title="Book a tour"
            variant="secondary"
            leftIcon="walk-outline"
            fullWidth
            onPress={() => navigation.navigate("BookTour")}
          />
        </View>
      </Card>
      {bookings.length ? (
        <>
          <SectionHeader title="Your free meeting-room bookings" />
          {bookingList}
        </>
      ) : null}
    </>
  );

  const roomPicker =
    roomsLoading ? (
      <InlineNote busy text="Loading meeting rooms..." />
    ) : roomsError ? (
      <Banner tone="danger" message={roomsError} actionLabel="Try again" onAction={() => loadForDate(date)} />
    ) : !rooms.length ? (
      <InlineNote text="There are no meeting rooms to book at your private office location." />
    ) : (
      <View accessibilityRole="radiogroup" accessibilityLabel="Meeting room" style={styles.tiles}>
        {rooms.map((r) => (
          <ChoiceTile
            key={r.spaceId}
            title={r.spaceName}
            subtitle={[seatsText(r), r.locationName].filter(Boolean).join(" · ") || undefined}
            selected={r.spaceId === spaceId}
            onPress={() => pickRoom(r)}
          />
        ))}
      </View>
    );

  const bookingForm = (e: MeetingRoomEntitlement) => (
    <>
      <AllowanceCard entitlement={e} date={date} />

      <SectionHeader title="Book a room" />
      <Card>
        <View style={styles.fields}>
          <DateField label="Date" value={date} onChange={onDateChange} minimumDate={minimumDate} />

          {entitlementLoading ? (
            <InlineNote busy text="Checking your hours for this date..." />
          ) : remainingMinutes < 60 ? (
            <Banner tone="info" message={NO_FREE_HOURS_TEXT} />
          ) : (
            <>
              <Group label="Meeting room">{roomPicker}</Group>

              {rooms.length && !roomsLoading && !roomsError ? (
                <>
                  <Group
                    label="Duration"
                    helperText={maxBookingHours ? `Up to ${hoursLabel(maxBookingHours)} per booking.` : undefined}
                  >
                    <View style={styles.chips}>
                      {durationOptions(maxBookingHours).map((h) => {
                        const allowed = isDurationAllowed(h, remainingMinutes);
                        return (
                          <Chip
                            key={h}
                            label={hoursLabel(h)}
                            selected={h === durationHours}
                            disabled={!allowed}
                            onPress={() => pickDuration(h)}
                            accessibilityLabel={
                              allowed ? `Duration ${hoursLabel(h)}` : `Duration ${hoursLabel(h)}, more than your remaining hours`
                            }
                          />
                        );
                      })}
                    </View>
                  </Group>

                  <Group label="Start time">
                    {!spaceId ? (
                      <InlineNote text="Choose a room to see the free times." />
                    ) : !slots.length || !freeSlotCount ? (
                      <InlineNote
                        text={`No free times on ${formatDate(date, { weekday: true, year: false })}. Please try another day or a shorter booking.`}
                      />
                    ) : null}
                    {spaceId && slots.length ? (
                      <View accessibilityRole="radiogroup" accessibilityLabel="Start time">
                        <ResponsiveGrid minItemWidth={SLOT_MIN_WIDTH} gap={8} maxColumns={4}>
                          {slots.map((s) => (
                            <ChoiceTile
                              key={s.start}
                              title={s.label}
                              subtitle={s.available ? undefined : s.reason}
                              selected={s.start === startSlot}
                              disabled={!s.available}
                              onPress={() => pickSlot(s)}
                            />
                          ))}
                        </ResponsiveGrid>
                      </View>
                    ) : null}
                  </Group>

                  <TextField
                    label="Notes (optional)"
                    value={notes}
                    onChangeText={setNotes}
                    maxLength={NOTES_MAX_LENGTH}
                    multiline
                    rows={2}
                    placeholder="For example: client meeting"
                  />

                  {selectedSlot && selectedRoom ? (
                    <View style={styles.summary} accessible>
                      <Ionicons name="calendar-outline" size={18} color={colors.onPrimarySoft} />
                      <AppText variant="bodySmall" color={colors.onPrimarySoft} style={styles.flex}>
                        {bookingSummary({
                          roomName: selectedRoom.spaceName,
                          date,
                          slotLabel: selectedSlot.label,
                          durationHours,
                          remainingMinutes,
                        })}
                      </AppText>
                    </View>
                  ) : null}

                  {formError ? <Banner tone="danger" message={formError} /> : null}

                  <Button
                    title="Book with free hours"
                    leftIcon="checkmark-circle-outline"
                    fullWidth
                    haptic
                    loading={submitting}
                    disabled={!canSubmit}
                    onPress={submit}
                  />
                </>
              ) : null}
            </>
          )}
        </View>
      </Card>

      <SectionHeader title="Your free meeting-room bookings" />
      {bookingList}
    </>
  );

  return (
    <Screen>
      <AppHeader title={title} />
      {!entitlementLoaded ? (
        <View style={styles.content} accessibilityLabel="Loading your meeting-room hours">
          <KpiSkeleton count={4} />
          <ListSkeleton rows={2} avatar={false} />
        </View>
      ) : loadError ? (
        <ScrollableState>
          <ErrorState
            title="Meeting rooms are not available right now"
            message={loadError}
            onRetry={reloadAll}
            retrying={entitlementLoading}
          />
        </ScrollableState>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
                progressBackgroundColor={colors.surfaceRaised}
              />
            }
          >
            <AppText variant="bodySmall" color="textSecondary">
              Free meeting-room hours that come with your private office, every calendar month. All times are Pakistan
              time.
            </AppText>
            {hasEntitlement && entitlement ? bookingForm(entitlement) : noOffice}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {cancelTarget ? (
        <CancelFreeBookingSheet booking={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={onCancelled} />
      ) : null}
    </Screen>
  );
}

/** A labelled group of choices (room, duration, start time) with an optional hint below. */
function Group({ label, helperText, children }: { label: string; helperText?: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.group}>
      <FieldLabel label={label} />
      {children}
      {helperText ? <FieldMessage helperText={helperText} /> : null}
    </View>
  );
}

/** A short line in place of a part that is loading or empty. */
function InlineNote({ text, busy = false }: { text: string; busy?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.note} accessibilityLiveRegion="polite">
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      <AppText variant="bodySmall" color="textMuted" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    fields: { gap: t.spacing.lg },
    group: { gap: t.spacing.sm },
    tiles: { gap: t.spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    list: { gap: t.spacing.md },
    note: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    summary: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radii.control,
      backgroundColor: c.primarySoft,
    },
  });
