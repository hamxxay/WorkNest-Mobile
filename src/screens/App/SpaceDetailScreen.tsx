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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      setBookingError("Start date should be greater than or equal to the current date.");
      return;
    }

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      setBookingError("Start date should be greater than or equal to the current date.");
      return;
    }

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
  const isReadyToBook = isOffice
    ? !!(selectedMonth && selectedMonthEnd)
    : !!(selectedDates.length && selectedSlot);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Full-width hero with overlaid back button */}
        <View style={styles.heroWrap}>
          <SmartImage uri={workspace.image} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroScrim} pointerEvents="none" />
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={[styles.heroBadge, workspace.available ? styles.heroBadgeAvail : styles.heroBadgeOccupied]}>
            <View style={[styles.heroDot, { backgroundColor: workspace.available ? "#10b981" : "#ef4444" }]} />
            <Text style={[styles.heroBadgeText, { color: workspace.available ? "#10b981" : "#ef4444" }]}>
              {workspace.available ? "Available" : "Occupied"}
            </Text>
          </View>
          <View style={styles.heroTitleWrap} pointerEvents="none">
            <Text style={styles.heroTitle} numberOfLines={2}>{workspace.name}</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroMetaText}>{workspace.location}</Text>
            </View>
          </View>
        </View>

        {/* Info strip */}
        <View style={styles.infoStrip}>
          {[
            { icon: "people-outline" as const, label: "Capacity", value: workspace.capacity },
            { icon: "pricetag-outline" as const, label: "Per Day", value: `PKR ${workspace.price}` },
            { icon: "business-outline" as const, label: "Type", value: workspace.type.replace(" Space", "") },
          ].map((item, idx) => (
            <View key={item.label} style={[styles.infoItem, idx === 2 && { borderRightWidth: 0 }]}>
              <View style={styles.infoIconWell}>
                <Ionicons name={item.icon} size={16} color={colors.primary} />
              </View>
              <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
              <Text style={styles.infoLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

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
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "description" ? (
          <View style={styles.descCard}>
            <Text style={styles.bodyText}>
              {workspace.name} is a modern workspace located in {workspace.location}. It offers
              flexible seating, reliable internet, and a calm atmosphere tailored for focused work.
            </Text>
          </View>
        ) : null}

        {activeTab === "amenities" ? (
          <View style={styles.amenitiesGrid}>
            {workspace.amenities.length > 0
              ? workspace.amenities.map((item: string) => (
                <View key={item} style={styles.amenityChip}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.amenityChipText}>{item}</Text>
                </View>
              ))
              : <Text style={styles.bodyText}>Amenities information coming soon.</Text>}
          </View>
        ) : null}

        {activeTab === "reviews" ? (
          <View style={styles.reviewList}>
            {[
              { name: "Sarah K.", text: "Quiet and productive atmosphere. Love it!", stars: 5 },
              { name: "Ahmed R.", text: "Great location and very helpful staff.", stars: 5 },
              { name: "Priya M.", text: "Loved the amenities and seating options.", stars: 4 },
            ].map((r) => (
              <View key={r.name} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{r.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewName}>{r.name}</Text>
                    <View style={styles.starsRow}>
                      {Array.from({ length: r.stars }).map((_, i) => (
                        <Ionicons key={i} name="star" size={11} color="#F59E0B" />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewText}>{r.text}</Text>
              </View>
            ))}
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
                        const today = new Date();
                        const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        if (monthDate < currentMonthDate) {
                          setBookingError("Start month should be greater than or equal to the current month.");
                          return;
                        }
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

        {bookingError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{bookingError}</Text>
          </View>
        ) : null}

        {/* spacer so content isn't hidden behind fixed CTA */}
        <View style={{ height: 88 }} />
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={styles.ctaBar}>
        <View style={styles.ctaPriceBlock}>
          <Text style={styles.ctaPrice}>PKR {workspace.price}</Text>
          <Text style={styles.ctaPriceSub}>{isOffice ? "/month" : "/day"}</Text>
        </View>
        <Pressable
          style={[styles.ctaBtn, !isReadyToBook && styles.ctaBtnDisabled]}
          onPress={onBookNow}
          disabled={!isReadyToBook}
        >
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>Book Now</Text>
        </Pressable>
      </View>

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
    paddingBottom: 24,
    gap: 14,
  },
  // Hero
  heroWrap: {
    position: "relative",
    height: 280,
  },
  heroImage: {
    width: "100%",
    height: 280,
    backgroundColor: colors.muted,
  },
  heroScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeAvail: { backgroundColor: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.4)" },
  heroBadgeOccupied: { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.35)" },
  heroDot: { width: 7, height: 7, borderRadius: 4 },
  heroBadgeText: { fontSize: 12, fontWeight: "700" },
  heroTitleWrap: {
    position: "absolute",
    bottom: 18,
    left: 18,
    right: 18,
    gap: 5,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroMetaText: { color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: "500" },
  // Info strip
  infoStrip: {
    flexDirection: "row",
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 5,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  infoIconWell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  infoValue: { color: colors.foreground, fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  infoLabel: { color: colors.mutedForeground, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  // Tabs
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
  },
  tabChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: colors.white },
  // Tab content
  descCard: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyText: { color: colors.mutedForeground, fontSize: 14, lineHeight: 22 },
  amenitiesGrid: {
    marginHorizontal: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityChipText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  reviewList: { marginHorizontal: 18, gap: 12 },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  reviewAvatarText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  reviewName: { color: colors.foreground, fontSize: 14, fontWeight: "700" },
  starsRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  reviewText: { color: colors.mutedForeground, fontSize: 13, lineHeight: 20 },
  // Section / availability
  section: { gap: 12, paddingHorizontal: 18 },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  sectionHint: { color: colors.mutedForeground, fontSize: 13 },
  pickerActionRow: { gap: 10 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.muted,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 12 },
  modeChipTextActive: { color: colors.white },
  pickerField: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { color: colors.foreground, fontWeight: "700", fontSize: 13 },
  pickerPlaceholder: { color: colors.mutedForeground, fontWeight: "600", fontSize: 13 },
  calendarCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  calendarTitle: { color: colors.foreground, fontWeight: "800", fontSize: 15 },
  calendarSummary: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarSummaryLabel: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  weekdayRow: { flexDirection: "row", justifyContent: "space-between" },
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
  dayCellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayCellMeeting: {
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dayCellInRange: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.border,
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
  dayTextSelected: { color: colors.white },
  slotCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    alignItems: "center",
  },
  slotChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { color: colors.mutedForeground, fontWeight: "700", fontSize: 13 },
  slotTextActive: { color: colors.white },
  monthCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthYearButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthYearText: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell: {
    width: "30%",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: "transparent",
  },
  monthCellInRange: { backgroundColor: colors.primaryMuted, borderColor: colors.border },
  monthCellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthText: { color: colors.foreground, fontWeight: "700" },
  monthTextSelected: { color: colors.white },
  // Error
  errorBanner: {
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: "#ef4444", fontWeight: "600", fontSize: 13, flex: 1 },
  // Fixed CTA bar
  ctaBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  ctaPriceBlock: { gap: 2 },
  ctaPrice: { color: colors.foreground, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  ctaPriceSub: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 28,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctaBtnDisabled: { backgroundColor: colors.muted, shadowOpacity: 0 },
  ctaBtnText: { color: colors.white, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  // icon btn
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.muted,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "800" },
  modalPrimary: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalPrimaryText: { color: colors.white, fontWeight: "700" },
  // legacy (kept for bookNow disabled state fallback)
  bookNow: { display: "none" },
  bookNowDisabled: { display: "none" },
  bookNowText: {},
  list: { gap: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.foreground },
});
function getRangeLabel(sharedRangeStart: Date | null, sharedRangeEnd: Date | null) {
  if (!sharedRangeStart) return "";
  if (!sharedRangeEnd) return formatDate(sharedRangeStart);
  return `${formatDate(sharedRangeStart)} - ${formatDate(sharedRangeEnd)}`;
}
