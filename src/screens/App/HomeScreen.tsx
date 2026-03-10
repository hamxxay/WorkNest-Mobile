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
import { DrawerActions, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";
import { getPricingPlans, PricingPlan } from "../../services/pricingService";
import { GalleryImage, getGalleryImages } from "../../services/galleryService";
import { SmartImage } from "../../components/SmartImage";
import Ionicons from "react-native-vector-icons/Ionicons";

type RoomType = "Meeting/Conference" | "Shared Space" | "Office";

type SharedSlot = "9 AM - 5 PM" | "6 PM - 3 AM" | "";

type PickerType = "office" | null;

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

type RangeTarget = "meeting" | "shared" | null;

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

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [roomType, setRoomType] = useState<RoomType>("Meeting/Conference");
  const [meetingRangeStart, setMeetingRangeStart] = useState<Date | null>(null);
  const [meetingRangeEnd, setMeetingRangeEnd] = useState<Date | null>(null);
  const [meetingStartTime, setMeetingStartTime] = useState("09:00");
  const [meetingHours, setMeetingHours] = useState("1");

  const [sharedRangeStart, setSharedRangeStart] = useState<Date | null>(null);
  const [sharedRangeEnd, setSharedRangeEnd] = useState<Date | null>(null);
  const [sharedSlot, setSharedSlot] = useState<SharedSlot>("");
  const [sharedRepeatWeeks, setSharedRepeatWeeks] = useState("0");

  const [officeStartDate, setOfficeStartDate] = useState<Date | null>(null);
  const [officeMonths, setOfficeMonths] = useState("1");
  const [officeChairs, setOfficeChairs] = useState("1");

  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [rangeTarget, setRangeTarget] = useState<RangeTarget>(null);
  const [rangeMonth, setRangeMonth] = useState<Date>(startOfMonth(new Date()));

  useEffect(() => {
    getPricingPlans()
      .then((items) => setPlans(items.slice(0, 3)))
      .catch(() => {
        setPlans([]);
      });

    getGalleryImages()
      .then((items) => setGalleryImages(items.slice(0, 4)))
      .catch(() => {
        setGalleryImages([]);
      });
  }, []);

  const meetingRangeLabel = getRangeLabel(meetingRangeStart, meetingRangeEnd);
  const sharedRangeLabel = getRangeLabel(sharedRangeStart, sharedRangeEnd);
  const officeMonthValue = officeStartDate ? formatMonth(officeStartDate) : "";

  const validation = useMemo(() => {
    if (roomType === "Meeting/Conference") {
      const hours = Number(meetingHours);
      if (!meetingRangeStart || !meetingRangeEnd) {
        return "Select a date range.";
      }
      if (!isValidTime(meetingStartTime)) {
        return "Select a valid start time (HH:mm).";
      }
      if (!Number.isFinite(hours) || hours < 1) {
        return "Minimum booking is 1 hour.";
      }
      return "";
    }

    if (roomType === "Shared Space") {
      const repeatWeeks = Number(sharedRepeatWeeks);
      if (!sharedRangeStart || !sharedRangeEnd) {
        return "Select a date range.";
      }
      if (!sharedSlot) {
        return "Select a time slot.";
      }
      if (!Number.isFinite(repeatWeeks) || repeatWeeks < 0 || repeatWeeks > 4) {
        return "Repeat can be 0 to 4 weeks (up to one month).";
      }
      return "";
    }

    const months = Number(officeMonths);
    const chairs = Number(officeChairs);
    if (!officeMonthValue) {
      return "Select a start month.";
    }
    if (!Number.isFinite(months) || months < 1) {
      return "Office booking must be at least 1 month.";
    }
    if (!Number.isFinite(chairs) || chairs < 1 || chairs > 5) {
      return "Chairs must be between 1 and 5.";
    }
    return "";
  }, [
    roomType,
    meetingRangeStart,
    meetingRangeEnd,
    meetingStartTime,
    meetingHours,
    sharedRangeStart,
    sharedRangeEnd,
    sharedSlot,
    sharedRepeatWeeks,
    officeMonthValue,
    officeMonths,
    officeChairs,
  ]);

  const summary = useMemo(() => {
    if (roomType === "Meeting/Conference") {
      return `Meeting ${meetingRangeLabel} at ${meetingStartTime || "-"} for ${meetingHours || "-"} hour(s).`;
    }
    if (roomType === "Shared Space") {
      const repeat = Number(sharedRepeatWeeks) > 0 ? `, repeat ${sharedRepeatWeeks} week(s)` : "";
      return `Shared space ${sharedRangeLabel}, ${sharedSlot || "-"}${repeat}.`;
    }
    return `Office from ${officeMonthValue || "-"} for ${officeMonths || "-"} month(s), ${officeChairs || "-"} chair(s). Deposit: 1 month.`;
  }, [
    roomType,
    meetingRangeLabel,
    meetingStartTime,
    meetingHours,
    sharedRangeLabel,
    sharedSlot,
    sharedRepeatWeeks,
    officeMonthValue,
    officeMonths,
    officeChairs,
  ]);

  const calendarDays = useMemo(() => buildCalendarDays(rangeMonth), [rangeMonth]);

  const openRangePicker = (target: RangeTarget) => {
    const baseDate = target === "meeting"
      ? meetingRangeStart ?? new Date()
      : sharedRangeStart ?? new Date();
    setRangeTarget(target);
    setRangeMonth(startOfMonth(baseDate));
    setRangePickerOpen(true);
  };

  const openMonthPicker = () => {
    setActivePicker("office");
    const baseDate = officeStartDate ?? new Date();
    setPickerMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  };

  const onSelectRangeDate = (date: Date) => {
    if (rangeTarget === "meeting") {
      setMeetingRangeStart((prev) => {
        if (!prev || (prev && meetingRangeEnd)) {
          setMeetingRangeEnd(null);
          return date;
        }
        if (date < prev) {
          return date;
        }
        setMeetingRangeEnd(date);
        return prev;
      });
    }

    if (rangeTarget === "shared") {
      setSharedRangeStart((prev) => {
        if (!prev || (prev && sharedRangeEnd)) {
          setSharedRangeEnd(null);
          return date;
        }
        if (date < prev) {
          return date;
        }
        setSharedRangeEnd(date);
        return prev;
      });
    }
  };

  const closeRangePicker = () => {
    setRangePickerOpen(false);
  };

  const onSelectMonth = (monthIndex: number) => {
    const year = pickerMonth.getFullYear();
    const date = new Date(year, monthIndex, 1);
    setOfficeStartDate(date);
    setActivePicker(null);
  };

  const moveMonth = (delta: number) => {
    setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const openDrawer = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.dispatch(DrawerActions.openDrawer());
      return;
    }
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const goTo = (route: keyof MainTabParamList) => {
    const parent = navigation.getParent();
    if (parent && "navigate" in parent) {
      parent.navigate(route as never);
      return;
    }
    navigation.navigate(route);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.logoText}>LOGO</Text>
          <Pressable
            style={styles.menuButton}
            onPress={openDrawer}
          >
            <Ionicons name="menu" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <SmartImage
            uri="https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&auto=format&fit=crop"
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Find Your Perfect Workspace</Text>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a coworking space"
              placeholderTextColor={colors.mutedForeground}
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
            <Pressable style={styles.searchButton} onPress={() => goTo("Booking")}> 
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <Pressable style={[styles.actionButton, styles.blueButton]} onPress={() => goTo("Booking")}>
              <Text style={styles.blueButtonText}>Explore Spaces</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.blueButton]} onPress={() => goTo("Booking")}>
              <Text style={styles.blueButtonText}>Book a Room</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.orangeButton]} onPress={() => goTo("Pricing")}>
              <Text style={styles.orangeButtonText}>View Pricing</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bookingCard}>
          <Text style={styles.sectionTitle}>Booking Inputs</Text>
          <View style={styles.typeRow}>
            {(["Meeting/Conference", "Shared Space", "Office"] as RoomType[]).map((type) => {
              const active = roomType === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setRoomType(type)}
                >
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>{type}</Text>
                </Pressable>
              );
            })}
          </View>

          {roomType === "Meeting/Conference" ? (
            <View style={styles.formBlock}>
              <Pressable style={styles.rangeField} onPress={() => openRangePicker("meeting")}>
                <Text style={meetingRangeStart ? styles.rangeText : styles.rangePlaceholder}>
                  {meetingRangeLabel}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.inlineRow}>
                <TextInput
                  value={meetingStartTime}
                  onChangeText={setMeetingStartTime}
                  placeholder="Start (HH:mm)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, styles.inlineInput]}
                />
                <TextInput
                  value={meetingHours}
                  onChangeText={setMeetingHours}
                  placeholder="Hours"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={[styles.input, styles.inlineInput]}
                />
              </View>
              <Text style={styles.helperText}>Minimum 1 hour, same-day booking.</Text>
            </View>
          ) : null}

          {roomType === "Shared Space" ? (
            <View style={styles.formBlock}>
              <Pressable style={styles.rangeField} onPress={() => openRangePicker("shared")}>
                <Text style={sharedRangeStart ? styles.rangeText : styles.rangePlaceholder}>
                  {sharedRangeLabel}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.slotRow}>
                {(["9 AM - 5 PM", "6 PM - 3 AM"] as SharedSlot[]).map((slot) => {
                  const active = sharedSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                      onPress={() => setSharedSlot(slot)}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={sharedRepeatWeeks}
                onChangeText={setSharedRepeatWeeks}
                placeholder="Repeat weeks (0-4)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                style={styles.input}
              />
              <Text style={styles.helperText}>Repeats up to one month for the same slot.</Text>
            </View>
          ) : null}

          {roomType === "Office" ? (
            <View style={styles.formBlock}>
              <Pressable style={styles.pickerField} onPress={openMonthPicker}>
                <Text style={officeMonthValue ? styles.pickerText : styles.pickerPlaceholder}>
                  {officeMonthValue || "Select start month"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.inlineRow}>
                <TextInput
                  value={officeMonths}
                  onChangeText={setOfficeMonths}
                  placeholder="Months"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={[styles.input, styles.inlineInput]}
                />
                <TextInput
                  value={officeChairs}
                  onChangeText={setOfficeChairs}
                  placeholder="Chairs (1-5)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={[styles.input, styles.inlineInput]}
                />
              </View>
              <Text style={styles.helperText}>Security deposit: 1 month.</Text>
            </View>
          ) : null}

          {validation ? <Text style={styles.errorText}>{validation}</Text> : null}
          {!validation ? <Text style={styles.summaryText}>{summary}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Gallery Preview</Text>
          </View>
          <View style={styles.galleryGrid}>
            {galleryImages.map((img, index) => (
              <View key={`gallery-${String(img.id ?? "missing")}-${index}`} style={styles.galleryCard}>
                <SmartImage uri={img.src} style={styles.galleryImage} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Plans for every work style</Text>
            <Pressable onPress={() => navigation.navigate("Pricing")}>
              <Text style={styles.linkText}>See All Plans</Text>
            </Pressable>
          </View>

          {plans.map((plan, index) => (
            <View key={`plan-${String(plan.id ?? "missing")}-${plan.name}-${index}`} style={[styles.planCard, plan.popular && styles.popularCard]}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>${Number(plan.price).toFixed(0)}/mo</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

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
                const rangeStart = rangeTarget === "meeting" ? meetingRangeStart : sharedRangeStart;
                const rangeEnd = rangeTarget === "meeting" ? meetingRangeEnd : sharedRangeEnd;
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
              <Text style={styles.rangeFooterText}>
                {rangeTarget === "meeting" ? meetingRangeLabel : sharedRangeLabel}
              </Text>
              <Pressable style={styles.pickerDone} onPress={closeRangePicker}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={activePicker !== null} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Pressable style={styles.pickerNav} onPress={() => moveMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </Pressable>
              <Text style={styles.pickerTitle}>
                {MONTH_LABELS[pickerMonth.getMonth()]} {pickerMonth.getFullYear()}
              </Text>
              <Pressable style={styles.pickerNav} onPress={() => moveMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_LABELS.map((label, index) => (
                <Pressable
                  key={label}
                  style={styles.monthCell}
                  onPress={() => onSelectMonth(index)}
                >
                  <Text style={styles.monthText}>{label.slice(0, 3)}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.pickerDone} onPress={() => setActivePicker(null)}>
              <Text style={styles.pickerDoneText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function formatMonth(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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

function getRangeLabel(start: Date | null, end: Date | null) {
  if (start && end) {
    return `${formatRangeDate(start)} to ${formatRangeDate(end)}`;
  }
  if (start) {
    return `${formatRangeDate(start)} to Select end date`;
  }
  return "Select date range";
}

function formatRangeDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingBottom: 24 },
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
  heroCard: {
    marginTop: 12,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.background,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    minHeight: 170,
    justifyContent: "flex-end",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.25)",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    padding: 16,
  },
  searchCard: {
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
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
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
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
  dropdownText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  actionButtons: {
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  blueButton: {
    backgroundColor: colors.primary,
  },
  orangeButton: {
    backgroundColor: colors.accent,
  },
  blueButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  orangeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  bookingCard: {
    marginTop: 18,
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
  helperText: { color: colors.mutedForeground, fontSize: 12 },
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
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
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
  rangeField: {
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
  rangeText: { color: colors.foreground, fontSize: 13, fontWeight: "600" },
  rangePlaceholder: { color: colors.mutedForeground, fontSize: 13, fontWeight: "600" },
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
  pickerDone: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  pickerDoneText: { color: colors.background, fontWeight: "700" },
  section: { marginTop: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryCard: {
    width: "48%",
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.muted,
    height: 100,
  },
  galleryImage: { width: "100%", height: "100%" },
  planCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  popularCard: { borderColor: colors.primary },
  planName: { color: colors.foreground, fontWeight: "700", fontSize: 16 },
  planPrice: { color: colors.primary, fontWeight: "800", fontSize: 20, marginTop: 6 },
  planDescription: { color: colors.mutedForeground, fontSize: 14, marginTop: 6 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
