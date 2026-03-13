import { useMemo, useState } from "react";
import {
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
import { Screen } from "../../components/Screen";
import { SmartImage } from "../../components/SmartImage";
import { colors, radii } from "../../theme";
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

const SHARED_SLOTS = ["09:00 - 17:00", "18:00 - 02:00"] as const;
const MEETING_SLOTS = ["09:00 - 11:00", "11:00 - 13:00", "13:00 - 15:00", "15:00 - 17:00"] as const;

export default function SpaceDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "SpaceDetail">>();
  const { workspace } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>("description");
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [bookingError, setBookingError] = useState("");

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const isShared = workspace.type === "Co-Working Space";
  const isMeeting = workspace.type === "Meeting Room";
  const isOffice = workspace.type === "Private Office";

  const onSelectDay = (date: Date) => {
    const key = formatDate(date);
    if (isShared) {
      setSelectedDates((prev) => {
        const exists = prev.includes(key);
        const next = exists ? prev.filter((item) => item !== key) : [...prev, key];
        if (!exists) {
          setFocusedDate(key);
        }
        return next;
      });
      return;
    }

    if (isMeeting) {
      setSelectedDates([key]);
      setFocusedDate(key);
    }
  };

  const onBookNow = () => {
    if (isOffice) {
      if (!selectedMonth) {
        setBookingError("Select a month to book.");
        return;
      }
      const monthKey = formatMonthKey(selectedMonth);
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
              ? "Shared space: pick dates, then select a shift."
              : isMeeting
                ? "Meeting room: pick a date, then choose a time slot."
                : "Private office: select a month for booking."}
          </Text>

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

              <View style={styles.calendarGrid}>
                {calendarDays.map((day) => {
                  const key = formatDate(day.date);
                  const isSelected = selectedDates.includes(key);
                  return (
                    <Pressable
                      key={key}
                      style={[
                        styles.dayCell,
                        !day.isCurrentMonth && styles.dayCellMuted,
                        isSelected && styles.dayCellSelected,
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
                {selectedDates.length
                  ? `Selected ${selectedDates.length} date(s). Choose a slot:`
                  : "Select one or more dates to see available slots."}
              </Text>
              <View style={styles.slotRow}>
                {SHARED_SLOTS.map((slot) => {
                  const active = selectedSlot === slot;
                  return (
                    <Pressable
                      key={slot}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                      onPress={() => setSelectedSlot(slot)}
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
                {focusedDate ? `Time slots for ${focusedDate}:` : "Select a date to see time slots."}
              </Text>
              {focusedDate ? (
                <View style={styles.slotRow}>
                  {MEETING_SLOTS.map((slot) => {
                    const active = selectedSlot === slot;
                    return (
                      <Pressable
                        key={slot}
                        style={[styles.slotChip, active && styles.slotChipActive]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          {isOffice ? (
            <View style={styles.monthCard}>
              <Text style={styles.bodyText}>Select a month for booking.</Text>
              <View style={styles.monthGrid}>
                {MONTH_LABELS.map((label, index) => {
                  const monthDate = new Date(new Date().getFullYear(), index, 1);
                  const active = selectedMonth
                    ? monthDate.getMonth() === selectedMonth.getMonth()
                      && monthDate.getFullYear() === selectedMonth.getFullYear()
                    : false;
                  return (
                    <Pressable
                      key={label}
                      style={[styles.monthCell, active && styles.monthCellSelected]}
                      onPress={() => setSelectedMonth(monthDate)}
                    >
                      <Text style={[styles.monthText, active && styles.monthTextSelected]}>
                        {label.slice(0, 3)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        <Pressable
          style={styles.bookNow}
          onPress={onBookNow}
        >
          <Text style={styles.bookNowText}>
            Book Now
          </Text>
        </Pressable>
      </ScrollView>
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

const styles = StyleSheet.create({
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
  calendarCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  calendarTitle: { color: colors.foreground, fontWeight: "700" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellMuted: { opacity: 0.4 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayText: { color: colors.foreground, fontWeight: "600" },
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
  bookNowText: { color: colors.background, fontWeight: "800", fontSize: 14 },
  errorText: { color: "#dc2626", fontWeight: "600" },
});
