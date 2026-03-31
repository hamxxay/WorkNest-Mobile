import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Screen } from "../../components/Screen";
import { SmartImage } from "../../components/SmartImage";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import type { AppStackParamList } from "../../navigation/types";

type TabKey = "description" | "amenities" | "reviews";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

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
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHARED_SLOTS = ["09:00 - 17:00", "18:00 - 02:00"] as const;
type SharedSelectionMode = "range" | "multiple";
export function isMonthInRange(
  date: Date,
  start: Date | null,
  end: Date | null
): boolean {
  if (!start || !end) {
    return false;
  }

  const dYear = date.getFullYear();
  const dMonth = date.getMonth();

  const sYear = start.getFullYear();
  const sMonth = start.getMonth();

  const eYear = end.getFullYear();
  const eMonth = end.getMonth();

  const afterStart =
    dYear > sYear || (dYear === sYear && dMonth >= sMonth);

  const beforeEnd =
    dYear < eYear || (dYear === eYear && dMonth <= eMonth);

  return afterStart && beforeEnd;
}

export function isSameMonth(date1: Date, date2: Date | null): boolean {
  if (!date2) {
    return false;
  }

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}
export default function SpaceDetailScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "SpaceDetail">>();
  const { workspace } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>("description");
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedMonthEnd, setSelectedMonthEnd] = useState<Date | null>(null);
  const [officeYear, setOfficeYear] = useState<number>(new Date().getFullYear());
  const [sharedSelectionMode, setSharedSelectionMode] = useState<SharedSelectionMode>("range");
  const [sharedRangeStart, setSharedRangeStart] = useState<Date | null>(null);
  const [sharedRangeEnd, setSharedRangeEnd] = useState<Date | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const [datePickerMonth, setDatePickerMonth] = useState<Date>(startOfMonth(new Date()));
  const [timePickerValue, setTimePickerValue] = useState<Date>(new Date());

  const setSelectedSlotWithClear = (slot: string) => {
    setSelectedSlot(slot);
    if (selectedDates.length > 0) {
      setBookingError("");
    }
  };

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const roomType = getRoomType(workspace.type);
  const isShared = roomType === "shared";
  const isMeeting = roomType === "meeting";
  const isOffice = roomType === "office";
  const sharedRangeLabel = getRangeLabel(sharedRangeStart, sharedRangeEnd);
  const officeMonthLabel = getMonthRangeLabel(selectedMonth, selectedMonthEnd);

  useEffect(() => {
    if (isOffice) {
      setSelectedSlot("");
      setSelectedDates([]);
      setFocusedDate(null);
      setSharedRangeStart(null);
      setSharedRangeEnd(null);
    }
  }, [isOffice]);

  const openDatePicker = () => {
    const baseDate = isShared && sharedSelectionMode === "range"
      ? sharedRangeEnd ?? sharedRangeStart ?? new Date()
      : focusedDate
        ? parseDate(focusedDate)
        : new Date();
    setDatePickerValue(baseDate);
    setDatePickerMonth(startOfMonth(baseDate));
    setDatePickerOpen(true);
  };

  const openTimePicker = () => {
    const baseTime = selectedSlot ? timeStringToDate(extractStartTime(selectedSlot)) : new Date();
    setTimePickerValue(baseTime);
    setTimePickerOpen(true);
  };

  const applyPickedDate = (date: Date) => {
    const key = formatDate(date);
    setFocusedDate(key);
    setBookingError("");

    if (isMeeting) {
      setSelectedDates([key]);
      return;
    }

    if (isShared) {
      if (sharedSelectionMode === "range") {
        applySharedRangeDate(date);
        return;
      }
      setSelectedDates((prev) => (prev.includes(key) ? prev : [...prev, key]));
    }
  };

  const applySharedRangeDate = (date: Date) => {
    setSharedRangeStart((prevStart) => {
      if (!prevStart || sharedRangeEnd) {
        setSharedRangeEnd(null);
        setSelectedDates([formatDate(date)]);
        return date;
      }

      if (date < prevStart) {
        setSelectedDates(buildDateRange(date, prevStart).map(formatDate));
        return date;
      }

      const rangeDates = buildDateRange(prevStart, date).map(formatDate);
      setSharedRangeEnd(date);
      setSelectedDates(rangeDates);
      return prevStart;
    });
  };


  const onSelectDay = (date: Date) => {
    const key = formatDate(date);
    if (isShared) {
      if (sharedSelectionMode === "range") {
        setFocusedDate(key);
        setBookingError("");
        applySharedRangeDate(date);
        return;
      }
      setSelectedDates((prev) => {
        const exists = prev.includes(key);
        const next = exists ? prev.filter((item) => item !== key) : [...prev, key];
        if (!exists) {
          setFocusedDate(key);
        }
        if (next.length > 0 && selectedSlot) {
          setBookingError("");
        }
        return next;
      });
      return;
    }

    if (isMeeting) {
      setSelectedDates([key]);
      setFocusedDate(key);
      if (selectedSlot) {
        setBookingError("");
      }
    }
  };

  const onBookNow = () => {
    if (isOffice) {
      if (!selectedMonth || !selectedMonthEnd) {
        setBookingError("Select a month range to book.");
        return;
      }
      const monthKey = getMonthRangeLabel(selectedMonth, selectedMonthEnd);
      navigation.navigate("BookingInfo", {
        workspace,
        booking: {
          mode: "office",
          dates: [],
          slot: "",
          month: monthKey,
        },
      });
      return;
    }

    if (!selectedDates.length || !selectedSlot) {
      setBookingError("Select dates and a time slot.");
      return;
    }

      navigation.navigate("BookingInfo", {
        workspace,
        booking: {
          mode: isShared ? "shared" : "meeting",
          dates: selectedDates,
          slot: selectedSlot,
        },
      });
  };

  function isSameDay(date1: Date, date2: Date) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>{workspace.name}</Text>
          <View style={styles.iconButton} />
        </View>

        <SmartImage uri={workspace.image} style={styles.heroImage} />

        <View style={styles.tabs}>
          {(["description", "amenities", "reviews"] as TabKey[]).map((tab) => {
            const active = tab === activeTab;
            return (
              <Pressable
                key={tab}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "description" ? (
          <Text style={styles.bodyText}>
            {workspace.name} is a modern workspace located in {workspace.location}. It offers
            flexible seating, reliable internet, and a calm atmosphere tailored for focused work.
          </Text>
        ) : null}

        {activeTab === "amenities" ? (
          <View style={styles.list}>
            {workspace.amenities.length > 0
              ? workspace.amenities.map((item) => (
                <Text key={item} style={styles.bodyText}>- {item}</Text>
              ))
              : <Text style={styles.bodyText}>Amenities information coming soon.</Text>}
          </View>
        ) : null}

        {activeTab === "reviews" ? (
          <View style={styles.list}>
            <Text style={styles.bodyText}>“Quiet and productive atmosphere.”</Text>
            <Text style={styles.bodyText}>“Great location and helpful staff.”</Text>
            <Text style={styles.bodyText}>“Loved the amenities and seating options.”</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.sectionHint}>
            {isShared
              ? "Shared space: choose either a date range or multiple dates, then select a shift."
              : isMeeting
                ? "Meeting room: pick a date, then choose a time slot."
                : "Private office: select a month for booking."}
          </Text>

          {!isOffice ? (
            <View style={styles.pickerActionRow}>
              <Pressable style={styles.pickerField} onPress={openDatePicker}>
                <Text style={focusedDate ? styles.pickerValue : styles.pickerPlaceholder}>
                  {isShared && sharedSelectionMode === "range"
                    ? sharedRangeStart
                      ? sharedRangeLabel
                      : "Pick a start or end date"
                    : focusedDate ?? "Pick a date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
              </Pressable>

              {isMeeting ? (
                <Pressable style={styles.pickerField} onPress={openTimePicker}>
                  <Text style={selectedSlot ? styles.pickerValue : styles.pickerPlaceholder}>
                    {selectedSlot || "Pick a time"}
                  </Text>
                  <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {isShared ? (
            <View style={styles.modeRow}>
              {(["range", "multiple"] as SharedSelectionMode[]).map((mode) => {
                const active = sharedSelectionMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                    onPress={() => {
                      setSharedSelectionMode(mode);
                      setSelectedDates([]);
                      setFocusedDate(null);
                      setSharedRangeStart(null);
                      setSharedRangeEnd(null);
                      setBookingError("");
                    }}
                  >
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {mode === "range" ? "Date Range" : "Multiple Dates"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!isOffice ? (
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable style={styles.iconButton} onPress={() => setCalendarMonth((prev) => addMonths(prev, -1))}>
                  <Ionicons name="chevron-back" size={18} color={colors.foreground} />
                </Pressable>
                <Text style={styles.calendarTitle}>
                  {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <Pressable style={styles.iconButton} onPress={() => setCalendarMonth((prev) => addMonths(prev, 1))}>
                  <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
                </Pressable>
              </View>

              <View style={styles.calendarSummary}>
                <Text style={styles.calendarSummaryLabel}>
                  {isShared && sharedSelectionMode === "range"
                    ? sharedRangeStart
                      ? sharedRangeLabel
                      : "Choose a start and end date"
                    : selectedDates.length
                      ? `${selectedDates.length} date(s) selected`
                      : isMeeting
                        ? "Choose one date for your session"
                        : "Pick the dates you want to book"}
                </Text>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((day) => {
                  const key = formatDate(day.date);
                  const isSelected = selectedDates.includes(key);
                  const isRangeEndpoint =
                    sharedSelectionMode === "range" &&
                    isShared &&
                    ((sharedRangeStart && isSameDay(day.date, sharedRangeStart)) ||
                      (sharedRangeEnd && isSameDay(day.date, sharedRangeEnd)));
                  return (
                    <Pressable
                      key={key}
                      style={[
                        styles.dayCell,
                        !day.isCurrentMonth && styles.dayCellMuted,
                        isSelected && sharedSelectionMode === "range" && isShared && styles.dayCellInRange,
                        isRangeEndpoint && styles.dayCellSelected,
                        isSelected && (!isShared || sharedSelectionMode === "multiple" || isMeeting) && styles.dayCellSelected,
                        isMeeting && isSelected && styles.dayCellMeeting,
                      ]}
                      onPress={() => onSelectDay(day.date)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !day.isCurrentMonth && styles.dayTextMuted,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day.date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isShared ? (
            <View style={styles.slotCard}>
              <Text style={styles.bodyText}>
                {sharedSelectionMode === "range" && sharedRangeStart
                  ? sharedRangeEnd
                    ? `Selected ${sharedRangeLabel}. Choose a slot:`
                    : "Select an end date to complete the range."
                  : selectedDates.length
                    ? `Selected ${selectedDates.length} date(s). Choose a slot:`
                    : "Select a date range or multiple dates to see available slots."}
              </Text>
              <View style={styles.slotRow}>
                {SHARED_SLOTS.map((slot) => {
                  const active = selectedSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                      onPress={() => setSelectedSlotWithClear(slot)}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isMeeting ? (
            <View style={styles.slotCard}>
              <Text style={styles.bodyText}>
                {selectedSlot
                  ? `Selected time: ${selectedSlot}`
                  : focusedDate
                    ? "Use the time picker above to choose a time."
                    : "Select a date first, then pick a time."}
              </Text>
            </View>
          ) : null}

          {isOffice ? (
            <View style={styles.monthCard}>
              <Text style={styles.bodyText}>
                {officeMonthLabel || "Select a start month and an end month for booking."}
              </Text>
              <View style={styles.monthHeader}>
                <Pressable
                  style={styles.monthYearButton}
                  onPress={() => setOfficeYear((prev) => prev - 1)}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.foreground} />
                </Pressable>
                <Text style={styles.monthYearText}>{officeYear}</Text>
                <Pressable
                  style={styles.monthYearButton}
                  onPress={() => setOfficeYear((prev) => prev + 1)}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {MONTH_LABELS.map((label, index) => {
                  const monthDate = new Date(officeYear, index, 1);
                  const isStart = isSameMonth(monthDate, selectedMonth);
                  const isEnd = isSameMonth(monthDate, selectedMonthEnd);
                  const isInRange = isMonthInRange(monthDate, selectedMonth, selectedMonthEnd);
                  return (
                    <Pressable
                      key={`${label}-${monthDate.getFullYear()}`}
                      style={[
                        styles.monthCell,
                        isInRange && styles.monthCellInRange,
                        (isStart || isEnd) && styles.monthCellSelected,
                      ]}
                      onPress={() => {
                        setSelectedMonth((prev) => {
                          if (!prev || selectedMonthEnd) {
                            setSelectedMonthEnd(null);
                            return monthDate;
                          }

                          if (monthDate < prev) {
                            return monthDate;
                          }

                          setSelectedMonthEnd(monthDate);
                          return prev;
                        });
                        setBookingError("");
                      }}
                    >
                      <Text style={[styles.monthText, (isStart || isEnd) && styles.monthTextSelected]}>
                        {label.slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        {bookingError ? <Text style={styles.errorText}>{bookingError}</Text> : null}

        <Pressable
          style={[styles.bookNow, (isOffice ? (!selectedMonth || !selectedMonthEnd) : (!selectedDates.length || !selectedSlot)) && styles.bookNowDisabled]}
          onPress={onBookNow}
          disabled={isOffice ? (!selectedMonth || !selectedMonthEnd) : (!selectedDates.length || !selectedSlot)}
        >
          <Text style={styles.bookNowText}>
            Book Now
          </Text>
        </Pressable>
      </ScrollView>

      <Modal transparent visible={datePickerOpen} onRequestClose={() => setDatePickerOpen(false)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select date</Text>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable style={styles.iconButton} onPress={() => setDatePickerMonth((prev) => addMonths(prev, -1))}>
                  <Ionicons name="chevron-back" size={18} color={colors.foreground} />
                </Pressable>
                <Text style={styles.calendarTitle}>
                  {MONTH_LABELS[datePickerMonth.getMonth()]} {datePickerMonth.getFullYear()}
                </Text>
                <Pressable style={styles.iconButton} onPress={() => setDatePickerMonth((prev) => addMonths(prev, 1))}>
                  <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={`modal-${label}`} style={styles.weekdayLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {buildCalendarDays(datePickerMonth).map((day) => {
                  const key = formatDate(day.date);
                  const isSelected = formatDate(datePickerValue) === key;
                  return (
                    <Pressable
                      key={`modal-${key}`}
                      style={[
                        styles.dayCell,
                        !day.isCurrentMonth && styles.dayCellMuted,
                        isSelected && styles.dayCellSelected,
                      ]}
                      onPress={() => {
                        setDatePickerValue(day.date);
                        applyPickedDate(day.date);
                        setDatePickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !day.isCurrentMonth && styles.dayTextMuted,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day.date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={timePickerOpen} onRequestClose={() => setTimePickerOpen(false)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select time</Text>
            <DateTimePicker
              value={timePickerValue}
              mode="time"
              minuteInterval={30}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              design={Platform.OS === "android" ? "material" : undefined}
              onChange={(event, date) => {
                if (Platform.OS !== "ios") {
                  setTimePickerOpen(false);
                }
                if (event.type === "set" && date) {
                  const normalizedDate = snapToHalfHour(date);
                  setTimePickerValue(normalizedDate);
                  setSelectedSlot(
                    `${formatTime(normalizedDate)} - ${formatTime(addHours(normalizedDate, 2))}`
                  );
                  setBookingError("");
                }
              }}
            />
            <Pressable style={styles.modalPrimary} onPress={() => setTimePickerOpen(false)}>
              <Text style={styles.modalPrimaryText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
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

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthRangeLabel(start: Date | null, end: Date | null) {
  if (start && end) {
    return `${formatMonthKey(start)} to ${formatMonthKey(end)}`;
  }

  if (start) {
    return `${formatMonthKey(start)} to Select end month`;
  }

  return "";
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function extractStartTime(value: string) {
  return value.split("-")[0]?.trim() ?? "";
}

function timeStringToDate(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  const next = new Date();
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function formatTime(value: Date) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function snapToHalfHour(value: Date) {
  const next = new Date(value);
  const minutes = next.getMinutes();

  if (minutes < 15) {
    next.setMinutes(0, 0, 0);
    return next;
  }

  if (minutes < 45) {
    next.setMinutes(30, 0, 0);
    return next;
  }

  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

function buildDateRange(start: Date, end: Date) {
  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const dates: Date[] = [];
  let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());

  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getRoomType(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("co-working") ||
    normalized.includes("coworking") ||
    normalized.includes("shared") ||
    normalized.includes("hot desk")
  ) {
    return "shared" as const;
  }

  if (
    normalized.includes("meeting") ||
    normalized.includes("conference") ||
    normalized.includes("board") ||
    normalized.includes("event")
  ) {
    return "meeting" as const;
  }

  return "office" as const;
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.foreground,
  },
  heroImage: {
    width: "100%",
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: colors.muted,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
  },
  tabChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.mutedForeground, fontWeight: "700", textTransform: "capitalize" },
  tabTextActive: { color: colors.background },
  bodyText: { color: colors.mutedForeground, fontSize: 14, lineHeight: 20 },
  list: { gap: 6 },
  section: { gap: 12 },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  sectionHint: { color: colors.mutedForeground, fontSize: 13 },
  pickerActionRow: { gap: 10 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.muted,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 12 },
  modeChipTextActive: { color: colors.background },
  pickerField: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { color: colors.foreground, fontWeight: "600" },
  pickerPlaceholder: { color: colors.mutedForeground, fontWeight: "600" },
  calendarCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarTitle: { color: colors.foreground, fontWeight: "700" },
  calendarSummary: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.muted,
  },
  calendarSummaryLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  weekdayLabel: {
    width: "14.2857%",
    textAlign: "center",
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayCellMuted: { opacity: 0.4 },
  dayCellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCellMeeting: {
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dayCellInRange: {
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    borderColor: "rgba(59, 130, 246, 0.18)",
  },
  dayText: {
    color: colors.foreground,
    fontWeight: "600",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    transform: [{ translateY: -10 }],
  },
  dayTextMuted: { color: colors.mutedForeground },
  dayTextSelected: { color: colors.background },
  slotCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 12 },
  slotTextActive: { color: colors.background },
  monthCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthYearButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthYearText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800",
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
  monthCellInRange: {
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    borderColor: "rgba(59, 130, 246, 0.18)",
    borderWidth: 1,
  },
  monthCellSelected: { backgroundColor: colors.primary },
  monthText: { color: colors.foreground, fontWeight: "700" },
  monthTextSelected: { color: colors.background },
  bookNow: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  bookNowDisabled: { backgroundColor: colors.muted },
  bookNowText: { color: colors.background, fontWeight: "800", fontSize: 14 },
  errorText: { color: "#dc2626", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
  },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  modalPrimary: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalPrimaryText: { color: colors.background, fontWeight: "700" },
});
function getRangeLabel(sharedRangeStart: Date | null, sharedRangeEnd: Date | null) {
  if (!sharedRangeStart) return "";
  if (!sharedRangeEnd) return formatDate(sharedRangeStart);
  return `${formatDate(sharedRangeStart)} - ${formatDate(sharedRangeEnd)}`;
}
