import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { createBooking, getWorkspaces } from "../../services/workspaceService";
import { SmartImage } from "../../components/SmartImage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Header } from "../../components/Header";
import { INPUT_LIMITS, sanitizeNotesInput, sanitizeSearchInput, sanitizeTextForState } from "../../utils/inputSanitizer";

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

type PickerType = "office" | null;

type RangeTarget = "meeting" | "shared" | null;

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
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const colorScheme = useColorScheme();
  const route = useRoute<RouteProp<MainTabParamList, "Booking">>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceType, setWorkspaceType] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [quickMeetingRangeStart, setQuickMeetingRangeStart] = useState<Date | null>(null);
  const [quickMeetingRangeEnd, setQuickMeetingRangeEnd] = useState<Date | null>(null);
  const [quickMeetingStartTime, setQuickMeetingStartTime] = useState("09:00");
  const [quickSharedRangeStart, setQuickSharedRangeStart] = useState<Date | null>(null);
  const [quickSharedRangeEnd, setQuickSharedRangeEnd] = useState<Date | null>(null);
  const [quickOfficeRangeStart, setQuickOfficeRangeStart] = useState<Date | null>(null);
  const [quickOfficeRangeEnd, setQuickOfficeRangeEnd] = useState<Date | null>(null);
  const [quickActivePicker, setQuickActivePicker] = useState<PickerType>(null);
  const [quickPickerMonth, setQuickPickerMonth] = useState<Date>(new Date());
  const [quickRangePickerOpen, setQuickRangePickerOpen] = useState(false);
  const [quickRangeTarget, _setQuickRangeTarget] = useState<RangeTarget>(null);
  const [quickRangeMonth, setQuickRangeMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedSpace, setSelectedSpace] = useState<Workspace | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingEndTime, setBookingEndTime] = useState("17:00");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<
    "quickMeeting" | "bookingStart" | "bookingEnd" | null
  >(null);
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());

  const [bookingRangeStart, setBookingRangeStart] = useState<Date | null>(new Date());
  const [bookingRangeEnd, setBookingRangeEnd] = useState<Date | null>(new Date());
  const [bookingRangeMonth, setBookingRangeMonth] = useState<Date>(startOfMonth(new Date()));
  const [bookingRangePickerOpen, setBookingRangePickerOpen] = useState(false);

  useEffect(() => {
    getWorkspaces()
      .then((items) => {
        setWorkspaces(items);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const initialLocation = route.params?.initialLocation?.trim() ?? "";
    setSelectedLocation(initialLocation);
  }, [route.params?.initialLocation]);

  const quickMeetingRangeLabel = getRangeLabel(quickMeetingRangeStart, quickMeetingRangeEnd);
  const quickSharedRangeLabel = getRangeLabel(quickSharedRangeStart, quickSharedRangeEnd);

  const locationOptions = useMemo(() => {
    return Array.from(
      new Set(
        workspaces
          .map((workspace) => workspace.location.trim())
          .filter((location) => location.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [workspaces]);

  const filteredWorkspaces = useMemo(() => {
    const query = sanitizeSearchInput(searchQuery).toLowerCase();
    const type = normalizeFilterValue(workspaceType);
    const location = selectedLocation.toLowerCase();

    return workspaces.filter((workspace) => {
      const matchesQuery =
        query.length === 0 ||
        workspace.name.toLowerCase().includes(query) ||
        workspace.location.toLowerCase().includes(query);

      const matchesType =
        !type || normalizeFilterValue(workspace.type).includes(type);

      const matchesLocation =
        !location || workspace.location.toLowerCase() === location;

      const matchesAvailability = !availableOnly || workspace.available;

      return matchesQuery && matchesType && matchesLocation && matchesAvailability;
    });
  }, [availableOnly, searchQuery, selectedLocation, workspaceType, workspaces]);

  const cycleLocationFilter = () => {
    if (locationOptions.length === 0) {
      return;
    }

    if (!selectedLocation) {
      setSelectedLocation(locationOptions[0]);
      return;
    }

    const currentIndex = locationOptions.findIndex((location) => location === selectedLocation);
    if (currentIndex === -1 || currentIndex === locationOptions.length - 1) {
      setSelectedLocation("");
      return;
    }

    setSelectedLocation(locationOptions[currentIndex + 1]);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setWorkspaceType("");
    setSelectedLocation("");
    setAvailableOnly(false);
  };

  const quickCalendarDays = useMemo(() => buildCalendarDays(quickRangeMonth), [quickRangeMonth]);
  const bookingCalendarDays = useMemo(() => buildCalendarDays(bookingRangeMonth), [bookingRangeMonth]);

  const onSelectQuickRangeDate = (date: Date) => {
    if (quickRangeTarget === "meeting") {
      setQuickMeetingRangeStart((prev) => {
        if (!prev || (prev && quickMeetingRangeEnd)) {
          setQuickMeetingRangeEnd(null);
          return date;
        }
        if (date < prev) {
          return date;
        }
        setQuickMeetingRangeEnd(date);
        return prev;
      });
    }

    if (quickRangeTarget === "shared") {
      setQuickSharedRangeStart((prev) => {
        if (!prev || (prev && quickSharedRangeEnd)) {
          setQuickSharedRangeEnd(null);
          return date;
        }
        if (date < prev) {
          return date;
        }
        setQuickSharedRangeEnd(date);
        return prev;
      });
    }
  };

  const closeQuickRangePicker = () => {
    setQuickRangePickerOpen(false);
  };

  const onSelectQuickMonth = (monthIndex: number) => {
    const year = quickPickerMonth.getFullYear();
    const date = new Date(year, monthIndex, 1);
    setQuickOfficeRangeStart((prev) => {
      if (!prev || quickOfficeRangeEnd) {
        setQuickOfficeRangeEnd(null);
        return date;
      }
      if (date < prev) {
        return date;
      }
      setQuickOfficeRangeEnd(date);
      setQuickActivePicker(null);
      return prev;
    });
  };

  const moveQuickMonth = (delta: number) => {
    setQuickPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const openTimePicker = (target: "quickMeeting" | "bookingStart" | "bookingEnd") => {
    const currentValue = getTimePickerTargetValue(target, {
      quickMeetingStartTime,
      bookingStartTime,
      bookingEndTime,
    });
    setTimePickerValue(timeStringToDate(currentValue));
    setTimePickerTarget(target);
    setTimePickerOpen(true);
  };

  const applyTimePickerValue = () => {
    if (!timePickerTarget) {
      setTimePickerOpen(false);
      return;
    }

    const nextValue = formatTimeHHmm(timePickerValue);
    if (timePickerTarget === "quickMeeting") {
      setQuickMeetingStartTime(nextValue);
    } else if (timePickerTarget === "bookingStart") {
      setBookingStartTime(nextValue);
    } else {
      setBookingEndTime(nextValue);
    }

    setTimePickerOpen(false);
  };

  const closeBookingModal = () => {
    setSelectedSpace(null);
    setBookingNotes("");
    setBookingError("");
    setBookingSuccess("");
    setBookingRangePickerOpen(false);
  };

  const submitBooking = async () => {
    if (!selectedSpace || !bookingRangeStart || !bookingRangeEnd) {
      setBookingError("Please select a date range.");
      return;
    }

    const startDateTime = `${formatDate(bookingRangeStart)}T${bookingStartTime}:00`;
    const endDateTime = `${formatDate(bookingRangeEnd)}T${bookingEndTime}:00`;

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
        sanitizeNotesInput(bookingNotes)
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

  const onSelectBookingRangeDate = (date: Date) => {
    if (!bookingRangeStart || (bookingRangeStart && bookingRangeEnd)) {
      setBookingRangeStart(date);
      setBookingRangeEnd(null);
      return;
    }

    if (bookingRangeStart && !bookingRangeEnd) {
      if (date < bookingRangeStart) {
        setBookingRangeStart(date);
        return;
      }
      setBookingRangeEnd(date);
    }
  };

  const bookingDateRangeLabel = bookingRangeStart && bookingRangeEnd
    ? `${formatDate(bookingRangeStart)}  ${formatDate(bookingRangeEnd)}`
    : bookingRangeStart
      ? `${formatDate(bookingRangeStart)}  Select end date`
      : "Select date range";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <Text style={styles.pageTitle}>Book Your Workspace</Text>

        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="Search for a coworking space"
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={(value) =>
                setSearchQuery(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.search }))
              }
              maxLength={INPUT_LIMITS.search}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.filterRow}>
            <Pressable style={styles.dropdown} onPress={cycleLocationFilter}>
              <Text style={styles.dropdownText}>
                {selectedLocation || (locationOptions.length ? "All Locations" : "No Locations")}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              style={[styles.dropdown, availableOnly && styles.dropdownActive]}
              onPress={() => setAvailableOnly((current) => !current)}
            >
              <Text style={[styles.dropdownText, availableOnly && styles.dropdownTextActive]}>
                {availableOnly ? "Available Only" : "All Spaces"}
              </Text>
              <Ionicons
                name={availableOnly ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={availableOnly ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            <Pressable style={styles.searchButton} onPress={resetFilters}>
              <Text style={styles.searchButtonText}>Reset</Text>
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

          <Text style={styles.filterHint}>
            Search updates live. Tap `Location` to cycle locations, toggle availability, or reset all filters.
          </Text>
        </View>

        {/* <View style={styles.bookingCard}>
          <Text style={styles.sectionTitle}>Book Now</Text>
          <View style={styles.typeRow}>
            {(["Meeting/Conference", "Shared Space", "Office"] as RoomType[]).map((type) => {
              const filterValue =
                type === "Meeting/Conference"
                  ? "meeting"
                  : type === "Shared Space"
                    ? "co-working"
                    : "private";
              const active = workspaceType === filterValue;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setWorkspaceType((current) => (current === filterValue ? "" : filterValue))}
                >
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{type}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            Filter the list by room type here. Date, time, duration, and month selection now happen
            inside each space detail screen.
          </Text>
        </View> */}

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
          <Pressable
            key={`workspace-${String(workspace.id ?? "missing")}-${index}`}
            style={styles.workspaceCard}
            onPress={() => navigation.navigate("SpaceDetail", { workspace })}
          >
            <SmartImage uri={workspace.image} style={styles.image} />

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{workspace.name}</Text>
              <Text style={styles.metaText}>Type: {workspace.type}</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.priceText}>PKR {workspace.price}/day</Text>
            </View>
          </Pressable>
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
            <Pressable style={styles.rangeField} onPress={() => setBookingRangePickerOpen(true)}>
              <Text style={bookingRangeStart ? styles.rangeText : styles.rangePlaceholder}>{bookingDateRangeLabel}</Text>
              <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
            </Pressable>

            <Text style={styles.label}>Start Time</Text>
            <Pressable style={styles.inputPlain} onPress={() => openTimePicker("bookingStart")}>
              <Text style={styles.timeValue}>{bookingStartTime}</Text>
            </Pressable>

            <Text style={styles.label}>End Time</Text>
            <Pressable style={styles.inputPlain} onPress={() => openTimePicker("bookingEnd")}>
              <Text style={styles.timeValue}>{bookingEndTime}</Text>
            </Pressable>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.inputPlain, styles.notesInput]}
              value={bookingNotes}
              onChangeText={(value) =>
                setBookingNotes(
                  sanitizeTextForState(value, {
                    maxLength: INPUT_LIMITS.notes,
                    multiline: true,
                  })
                )
              }
              placeholder="Any special requirements..."
              multiline
              maxLength={INPUT_LIMITS.notes}
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

      <Modal transparent visible={bookingRangePickerOpen} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => setBookingRangeMonth((prev) => addMonths(prev, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[bookingRangeMonth.getMonth()]} {bookingRangeMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => setBookingRangeMonth((prev) => addMonths(prev, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {bookingCalendarDays.map((day, index) => {
                const isSelectedStart = bookingRangeStart ? isSameDay(day.date, bookingRangeStart) : false;
                const isSelectedEnd = bookingRangeEnd ? isSameDay(day.date, bookingRangeEnd) : false;
                const isInRange = bookingRangeStart && bookingRangeEnd
                  ? day.date > bookingRangeStart && day.date < bookingRangeEnd
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
                    onPress={() => onSelectBookingRangeDate(day.date)}
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
              <Text style={styles.rangeFooterText}>{bookingDateRangeLabel}</Text>
              <Pressable style={styles.pickerDone} onPress={() => setBookingRangePickerOpen(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={quickRangePickerOpen} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => setQuickRangeMonth((prev) => addMonths(prev, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[quickRangeMonth.getMonth()]} {quickRangeMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => setQuickRangeMonth((prev) => addMonths(prev, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {quickCalendarDays.map((day, index) => {
                const rangeStart = quickRangeTarget === "meeting" ? quickMeetingRangeStart : quickSharedRangeStart;
                const rangeEnd = quickRangeTarget === "meeting" ? quickMeetingRangeEnd : quickSharedRangeEnd;
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
                    onPress={() => onSelectQuickRangeDate(day.date)}
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
              <Text style={styles.rangeFooterText}>
                {quickRangeTarget === "meeting" ? quickMeetingRangeLabel : quickSharedRangeLabel}
              </Text>
              <Pressable style={styles.pickerDone} onPress={closeQuickRangePicker}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={quickActivePicker !== null} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => moveQuickMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[quickPickerMonth.getMonth()]} {quickPickerMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => moveQuickMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_LABELS.map((label, index) => {
                const monthDate = new Date(quickPickerMonth.getFullYear(), index, 1);
                const isStart = isSameMonth(monthDate, quickOfficeRangeStart);
                const isEnd = isSameMonth(monthDate, quickOfficeRangeEnd);
                const isInRange = isMonthInRange(monthDate, quickOfficeRangeStart, quickOfficeRangeEnd);
                return (
                  <Pressable
                    key={label}
                    style={[
                      styles.monthCell,
                      isInRange && styles.monthCellInRange,
                      (isStart || isEnd) && styles.monthCellSelected,
                    ]}
                    onPress={() => onSelectQuickMonth(index)}
                  >
                    <Text
                      style={[
                        styles.monthText,
                        (isStart || isEnd) && styles.monthTextSelected,
                      ]}
                    >
                      {label.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.pickerDone} onPress={() => setQuickActivePicker(null)}>
              <Text style={styles.pickerDoneText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={timePickerOpen} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select time</Text>
            <DateTimePicker
              value={timePickerValue}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              design={Platform.OS === "android" ? "material" : undefined}
              themeVariant={colorScheme === "dark" ? "dark" : "light"}
              accentColor={colors.primary}
              textColor={colors.foreground}
              onChange={(_, date) => {
                if (date) {
                  setTimePickerValue(date);
                }
              }}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalOutline} onPress={() => setTimePickerOpen(false)}>
                <Text style={styles.modalOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={applyTimePickerValue}>
                <Text style={styles.modalPrimaryText}>Done</Text>
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

function formatTimeHHmm(value: Date) {
  const h = String(value.getHours()).padStart(2, "0");
  const m = String(value.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function timeStringToDate(value: string) {
  const [h, m] = value.split(":").map((part) => Number(part));
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

function getTimePickerTargetValue(
  target: "quickMeeting" | "bookingStart" | "bookingEnd",
  values: {
    quickMeetingStartTime: string;
    bookingStartTime: string;
    bookingEndTime: string;
  },
) {
  if (target === "quickMeeting") return values.quickMeetingStartTime;
  if (target === "bookingStart") return values.bookingStartTime;
  return values.bookingEndTime;
}

function formatRangeDate(value: Date) {
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

function isSameMonth(a: Date, b: Date | null) {
  if (!b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isMonthInRange(month: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const startKey = start.getFullYear() * 12 + start.getMonth();
  const endKey = end.getFullYear() * 12 + end.getMonth();
  const monthKey = month.getFullYear() * 12 + month.getMonth();
  return monthKey > startKey && monthKey < endKey;
}

function getRangeLabel(start: Date | null, end: Date | null) {
  if (start && end) {
    return `${formatRangeDate(start)} to ${formatRangeDate(end)}`;
  }
  if (start) {
    return `${formatRangeDate(start)} to Select end date`;
  }
  return "Select date range";
}

function normalizeFilterValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 24 },
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
  dropdownActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(74, 125, 255, 0.08)",
  },
  dropdownText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
  dropdownTextActive: { color: colors.foreground },
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
  bookingCard: {
    marginTop: 10,
    marginBottom: 18,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    gap: 10,
  },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.muted,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
  typeTextActive: { color: colors.background },
  formBlock: { gap: 8 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: colors.muted,
    color: colors.foreground,
  },
  inlineRow: { flexDirection: "row", gap: 8 },
  inlineInput: { flex: 1 },
  timeValue: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  pickerContainer: {
    flex: 1,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    height: 50,
  },
  picker: {
    color: colors.foreground,
    height: 50,
    width: "100%",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthCell: {
    width: "30%",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.muted,
  },
  monthText: { color: colors.foreground, fontWeight: "700" },
  monthCellSelected: {
    backgroundColor: colors.primary,
  },
  monthCellInRange: {
    backgroundColor: "rgba(74, 125, 255, 0.18)",
  },
  monthTextSelected: {
    color: colors.background,
  },
  pickerField: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  pickerPlaceholder: { color: colors.mutedForeground, fontSize: 13, fontWeight: "600" },
  slotRow: { flexDirection: "row", gap: 8 },
  slotChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.muted,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground },
  slotTextActive: { color: colors.background },
  summaryText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
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
  dayText: {
    color: colors.foreground,
    fontWeight: "600",
    transform: [{ translateY: -10 }],
  },
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
