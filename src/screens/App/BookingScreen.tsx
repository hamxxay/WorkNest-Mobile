import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { createBooking, getWorkspaces } from "../../services/workspaceService";
import { SmartImage } from "../../components/SmartImage";

type Workspace = {
  id: number;
  name: string;
  type: "Private Office" | "Co-Working Space" | "Meeting Room" | "Event Space";
  location: string;
  capacity: string;
  price: number;
  amenities: string[];
  image: string;
  available: boolean;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

const typeOptions = ["", "private", "co-working", "meeting", "event"] as const;
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function BookingScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceType, setWorkspaceType] = useState<string>("");
  const [selectedSpace, setSelectedSpace] = useState<Workspace | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingEndTime, setBookingEndTime] = useState("17:00");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");

  const [rangeStart, setRangeStart] = useState<Date | null>(new Date());
  const [rangeEnd, setRangeEnd] = useState<Date | null>(new Date());
  const [rangeMonth, setRangeMonth] = useState<Date>(startOfMonth(new Date()));
  const [rangePickerOpen, setRangePickerOpen] = useState(false);

  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredWorkspaces = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const type = workspaceType.toLowerCase();

    return workspaces.filter((workspace) => {
      const matchesQuery =
        query.length === 0 ||
        workspace.name.toLowerCase().includes(query) ||
        workspace.location.toLowerCase().includes(query);

      const matchesType =
        !type || workspace.type.toLowerCase().includes(type.replace("-", " "));

      return matchesQuery && matchesType;
    });
  }, [searchQuery, workspaceType, workspaces]);

  const calendarDays = useMemo(() => buildCalendarDays(rangeMonth), [rangeMonth]);

  const openBookingModal = (workspace: Workspace) => {
    const today = new Date();
    setSelectedSpace(workspace);
    setBookingError("");
    setBookingSuccess("");
    setBookingNotes("");
    setBookingStartTime("09:00");
    setBookingEndTime("17:00");
    setRangeStart(today);
    setRangeEnd(today);
    setRangeMonth(startOfMonth(today));
  };

  const closeBookingModal = () => {
    setSelectedSpace(null);
    setBookingNotes("");
    setBookingError("");
    setBookingSuccess("");
    setRangePickerOpen(false);
  };

  const submitBooking = async () => {
    if (!selectedSpace || !rangeStart || !rangeEnd) {
      setBookingError("Please select a date range.");
      return;
    }

    const startDateTime = `${formatDate(rangeStart)}T${bookingStartTime}:00`;
    const endDateTime = `${formatDate(rangeEnd)}T${bookingEndTime}:00`;

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setBookingError("End date/time must be after start date/time.");
      return;
    }

    setBookingError("");
    setBookingInProgress(true);

    try {
      await createBooking(
        selectedSpace.id,
        startDateTime,
        endDateTime,
        bookingNotes
      );
      setBookingSuccess("Booking created successfully!");
      setTimeout(() => {
        closeBookingModal();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create booking.";
      setBookingError(message);
    } finally {
      setBookingInProgress(false);
    }
  };

  const onSelectRangeDate = (date: Date) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }

    if (rangeStart && !rangeEnd) {
      if (date < rangeStart) {
        setRangeStart(date);
        return;
      }
      setRangeEnd(date);
    }
  };

  const dateRangeLabel = rangeStart && rangeEnd
    ? `${formatDate(rangeStart)}  ${formatDate(rangeEnd)}`
    : rangeStart
      ? `${formatDate(rangeStart)}  Select end date`
      : "Select date range";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.logoText}>LOGO</Text>
          <Pressable
            style={styles.menuButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <Text style={styles.pageTitle}>Book Your Workspace</Text>

        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="Search for a coworking space"
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            <Pressable style={styles.dropdown}>
              <Text style={styles.dropdownText}>Location</Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={styles.dropdown}>
              <Text style={styles.dropdownText}>Date</Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          <Text style={styles.filterLabel}>Workspace Type</Text>
          <View style={styles.chipRow}>
            {typeOptions.map((option) => {
              const active = workspaceType === option;
              return (
                <Pressable
                  key={option || "all"}
                  onPress={() => setWorkspaceType(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option ? option : "all"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterHint}>Filter by name, location, or workspace type.</Text>
        </View>

        <View style={styles.galleryHeader}>
          <Text style={styles.galleryTitle}>Workspace Listings</Text>
          <Text style={styles.gallerySubtitle}>
            Browse available workspaces and find your perfect fit.
          </Text>
        </View>

        {loading ? <Text style={styles.helperText}>Loading workspaces...</Text> : null}
        {!loading && filteredWorkspaces.length === 0 ? (
          <Text style={styles.helperText}>No workspaces found. Try adjusting filters.</Text>
        ) : null}

        {filteredWorkspaces.map((workspace, index) => (
          <View
            key={`workspace-${String(workspace.id ?? "missing")}-${index}`}
            style={styles.workspaceCard}
          >
            <SmartImage uri={workspace.image} style={styles.image} />

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{workspace.name}</Text>
              <Text style={styles.metaText}>{workspace.location}</Text>
              <Text style={styles.metaText}>Type: {workspace.type}</Text>
              <Text style={styles.metaText}>Capacity: {workspace.capacity}</Text>
              {workspace.amenities.length > 0 ? (
                <Text style={styles.metaText}>{workspace.amenities.slice(0, 3).join(", ")}</Text>
              ) : null}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.priceText}>${workspace.price}/day</Text>
              <Pressable
                style={[styles.bookButton, !workspace.available && styles.bookButtonDisabled]}
                onPress={() => openBookingModal(workspace)}
                disabled={!workspace.available}
              >
                <Text style={styles.bookButtonText}>
                  {workspace.available ? "Book Now" : "Unavailable"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!selectedSpace} transparent animationType="slide" onRequestClose={closeBookingModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Booking</Text>
            {!!selectedSpace && <Text style={styles.modalSpace}>{selectedSpace.name}</Text>}

            {!!bookingError && <Text style={styles.errorText}>{bookingError}</Text>}
            {!!bookingSuccess && <Text style={styles.successText}>{bookingSuccess}</Text>}

            <Text style={styles.label}>Date Range</Text>
            <Pressable style={styles.rangeField} onPress={() => setRangePickerOpen(true)}>
              <Text style={rangeStart ? styles.rangeText : styles.rangePlaceholder}>{dateRangeLabel}</Text>
              <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
            </Pressable>

            <Text style={styles.label}>Start Time</Text>
            <TextInput style={styles.inputPlain} value={bookingStartTime} onChangeText={setBookingStartTime} placeholder="HH:mm" />

            <Text style={styles.label}>End Time</Text>
            <TextInput style={styles.inputPlain} value={bookingEndTime} onChangeText={setBookingEndTime} placeholder="HH:mm" />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.inputPlain, styles.notesInput]}
              value={bookingNotes}
              onChangeText={setBookingNotes}
              placeholder="Any special requirements..."
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalOutline} onPress={closeBookingModal}>
                <Text style={styles.modalOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={submitBooking} disabled={bookingInProgress}>
                <Text style={styles.modalPrimaryText}>{bookingInProgress ? "Booking..." : "Confirm Booking"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={rangePickerOpen} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => setRangeMonth((prev) => addMonths(prev, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[rangeMonth.getMonth()]} {rangeMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => setRangeMonth((prev) => addMonths(prev, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const isSelectedStart = rangeStart ? isSameDay(day.date, rangeStart) : false;
                const isSelectedEnd = rangeEnd ? isSameDay(day.date, rangeEnd) : false;
                const isInRange = rangeStart && rangeEnd
                  ? day.date > rangeStart && day.date < rangeEnd
                  : false;
                return (
                  <Pressable
                    key={`${day.date.toISOString()}-${index}`}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.dayCellMuted,
                      isInRange && styles.dayCellInRange,
                      (isSelectedStart || isSelectedEnd) && styles.dayCellSelected,
                    ]}
                    onPress={() => onSelectRangeDate(day.date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.dayTextMuted,
                        (isSelectedStart || isSelectedEnd) && styles.dayTextSelected,
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rangeFooter}>
              <Text style={styles.rangeFooterText}>{dateRangeLabel}</Text>
              <Pressable style={styles.pickerDone} onPress={() => setRangePickerOpen(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(baseMonth: Date): CalendarDay[] {
  const year = baseMonth.getFullYear();
  const month = baseMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  const startDate = new Date(year, month, 1 - startDay);
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    days.push({
      date,
      isCurrentMonth: date.getMonth() === month,
    });
  }

  return days;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  topBar: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.foreground,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.foreground, marginTop: 10, marginBottom: 12 },
  filterCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 18,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.muted,
  },
  searchInput: { flex: 1, color: colors.foreground, fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8 },
  dropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  dropdownText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  filterLabel: { marginTop: 4, color: colors.foreground, fontWeight: "700", fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.mutedForeground, fontWeight: "600", textTransform: "capitalize" },
  chipTextActive: { color: colors.background },
  filterHint: { color: colors.mutedForeground, fontSize: 12 },
  galleryHeader: { marginBottom: 12 },
  galleryTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  gallerySubtitle: { color: colors.mutedForeground, marginTop: 4, fontSize: 14 },
  helperText: { color: colors.mutedForeground, marginBottom: 12 },
  workspaceCard: {
    borderRadius: radii.lg,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: colors.background,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  image: { width: "100%", height: 180 },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  metaText: { color: colors.mutedForeground, fontSize: 14 },
  cardFooter: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceText: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  bookButton: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.md },
  bookButtonDisabled: { backgroundColor: colors.muted },
  bookButtonText: { color: colors.background, fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: colors.foreground },
  modalSpace: { color: colors.mutedForeground, marginBottom: 2 },
  label: { color: colors.foreground, fontWeight: "600", fontSize: 14 },
  rangeField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.muted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeText: { color: colors.foreground, fontWeight: "600", fontSize: 13 },
  rangePlaceholder: { color: colors.mutedForeground, fontWeight: "600", fontSize: 13 },
  inputPlain: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: colors.muted,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalOutlineText: { color: colors.foreground, fontWeight: "700" },
  modalPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryText: { color: colors.background, fontWeight: "700" },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  successText: { color: "#059669", fontSize: 13, fontWeight: "600" },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pickerNav: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  pickerTitle: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellMuted: {
    opacity: 0.4,
  },
  dayCellInRange: {
    backgroundColor: "rgba(74, 125, 255, 0.15)",
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: { color: colors.foreground, fontWeight: "600" },
  dayTextMuted: { color: colors.mutedForeground },
  dayTextSelected: { color: colors.background },
  rangeFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rangeFooterText: { color: colors.mutedForeground, fontWeight: "600", fontSize: 12 },
  pickerDone: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  pickerDoneText: { color: colors.background, fontWeight: "700" },
});
