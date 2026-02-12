import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";

type DateRange = {
  from: Date | null;
  to: Date | null;
};

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

const workspaces: Workspace[] = [
  {
    id: 1,
    name: "Premium Private Office",
    type: "Private Office",
    location: "Downtown Financial District",
    capacity: "1-2 people",
    price: 45,
    amenities: ["Standing desk", "High-speed WiFi", "Printing access"],
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: 2,
    name: "Co-Working Hot Desk",
    type: "Co-Working Space",
    location: "Creative Arts Quarter",
    capacity: "Open seating",
    price: 25,
    amenities: ["Coffee bar", "Collaborative atmosphere", "Natural light"],
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: 3,
    name: "Executive Meeting Room",
    type: "Meeting Room",
    location: "Tech Innovation Hub",
    capacity: "8-12 people",
    price: 75,
    amenities: ["Video conferencing", "Whiteboard", "Catering available"],
    image:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: 4,
    name: "Modern Startup Space",
    type: "Private Office",
    location: "Innovation District",
    capacity: "4-6 people",
    price: 85,
    amenities: ["24/7 access", "Kitchen", "Phone booths"],
    image:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop",
    available: true,
  },
  {
    id: 5,
    name: "Creative Co-Working Area",
    type: "Co-Working Space",
    location: "Arts and Culture Center",
    capacity: "Open seating",
    price: 30,
    amenities: ["Event space", "Workshops", "Community events"],
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
    available: false,
  },
  {
    id: 6,
    name: "Spacious Conference Room",
    type: "Meeting Room",
    location: "Business District",
    capacity: "15-20 people",
    price: 95,
    amenities: ["Projector", "Conference phone", "Refreshments"],
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=600&fit=crop",
    available: true,
  },
];

const typeOptions = [
  { label: "All", value: "" },
  { label: "Private", value: "private" },
  { label: "Co-Working", value: "coworking" },
  { label: "Meeting", value: "meeting" },
  { label: "Event", value: "event" },
];

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function BookingScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceType, setWorkspaceType] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedType, setAppliedType] = useState("");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>({
    from: null,
    to: null,
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const filteredWorkspaces = useMemo(() => {
    const query = appliedQuery.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchesQuery =
        query.length === 0 ||
        workspace.name.toLowerCase().includes(query) ||
        workspace.location.toLowerCase().includes(query);

      const matchesType = matchesWorkspaceType(workspace.type, appliedType);
      const matchesDate = appliedDateRange.from ? true : true;

      return matchesQuery && matchesType && matchesDate;
    });
  }, [appliedQuery, appliedType, appliedDateRange]);

  const handleSearch = () => {
    setAppliedQuery(searchQuery);
    setAppliedType(workspaceType);
    setAppliedDateRange(dateRange);
  };

  const durationDays =
    dateRange.from && dateRange.to
      ? Math.floor(
          (startOfDay(dateRange.to).getTime() - startOfDay(dateRange.from).getTime()) /
            86400000
        ) + 1
      : null;
  const durationHours = durationDays ? durationDays * 24 : null;
  const calendarDays = getCalendarDays(calendarMonth);

  const handleSelectDate = (day: Date) => {
    const normalized = startOfDay(day);

    setDateRange((prev) => {
      if (!prev.from || (prev.from && prev.to)) {
        return { from: normalized, to: null };
      }

      if (normalized.getTime() < startOfDay(prev.from).getTime()) {
        return { from: normalized, to: prev.from };
      }

      if (normalized.getTime() === startOfDay(prev.from).getTime()) {
        return { from: normalized, to: null };
      }

      return { from: prev.from, to: normalized };
    });
  };

  const clearDateRange = () => {
    setDateRange({ from: null, to: null });
  };

  const handleBookNow = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setBookingConfirmed(false);
  };

  const closeModal = () => {
    setSelectedWorkspace(null);
    setBookingConfirmed(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <Text style={styles.pageTitle}>Book Your Workspace</Text>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Search & Filter Workspaces</Text>

          <View style={styles.inputWrapper}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              placeholder="Enter location or workspace name"
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.input}
            />
          </View>

          <Text style={styles.filterLabel}>Workspace Type</Text>
          <View style={styles.chipRow}>
            {typeOptions.map((option) => {
              const active = workspaceType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setWorkspaceType(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>Date Range</Text>
          <View style={styles.dateRangeWrap}>
            <Pressable
              onPress={() => {
                if (dateRange.from) {
                  setCalendarMonth(
                    new Date(
                      dateRange.from.getFullYear(),
                      dateRange.from.getMonth(),
                      1
                    )
                  );
                }
                setCalendarVisible(true);
              }}
              style={styles.dateTrigger}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.mutedForeground}
              />
              <Text style={styles.dateTriggerText}>
                {formatDateRangeLabel(dateRange)}
              </Text>
            </Pressable>
            <View style={styles.dateMetaRow}>
              {durationDays ? (
                <Text style={styles.dateMetaText}>
                  Duration: {durationDays} {durationDays === 1 ? "day" : "days"} (
                  {durationHours} {durationHours === 1 ? "hour" : "hours"})
                </Text>
              ) : (
                <Text style={styles.dateMetaText}>
                  Select start and end dates to calculate duration
                </Text>
              )}
              {dateRange.from && (
                <Pressable onPress={clearDateRange} style={styles.clearPill}>
                  <Text style={styles.clearPillText}>Clear</Text>
                </Pressable>
              )}
            </View>
          </View>

          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={16} color={colors.background} />
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        <View style={styles.galleryHeader}>
          <Text style={styles.galleryTitle}>Workspace Gallery</Text>
          <Text style={styles.gallerySubtitle}>
            Browse available workspaces and find your perfect fit.
          </Text>
        </View>

        {filteredWorkspaces.map((workspace) => (
          <View
            key={workspace.id}
            style={[
              styles.workspaceCard,
              workspace.available ? styles.cardAvailable : styles.cardUnavailable,
            ]}
          >
            <View style={styles.imageWrap}>
              <Image source={{ uri: workspace.image }} style={styles.image} />
              <View
                style={[
                  styles.badge,
                  workspace.available ? styles.badgeAvailable : styles.badgeBooked,
                ]}
              >
                <Text
                  style={
                    workspace.available ? styles.badgeTextLight : styles.badgeTextDark
                  }
                >
                  {workspace.available ? "Available" : "Booked"}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{workspace.name}</Text>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>{workspace.location}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>Capacity: {workspace.capacity}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="wifi-outline" size={16} color={colors.primary} />
                <Text style={styles.metaText}>
                  {workspace.amenities.slice(0, 2).join(", ")}
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.priceText}>
                ${workspace.price}
                <Text style={styles.priceUnit}>/day</Text>
              </Text>
              <Pressable
                disabled={!workspace.available}
                onPress={() => handleBookNow(workspace)}
                style={
                  workspace.available
                    ? styles.bookButton
                    : styles.bookButtonDisabled
                }
              >
                <Text
                  style={
                    workspace.available ? styles.bookButtonText : styles.bookDisabledText
                  }
                >
                  {workspace.available ? "Book Now" : "Unavailable"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={{ height: 12 }} />
      </ScrollView>

      <Modal
        visible={calendarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <Pressable onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                style={styles.monthNavButton}
              >
                <Ionicons name="chevron-back" size={16} color={colors.foreground} />
              </Pressable>
              <Text style={styles.monthLabel}>{formatMonthLabel(calendarMonth)}</Text>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                style={styles.monthNavButton}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.foreground}
                />
              </Pressable>
            </View>

            <View style={styles.weekdaysRow}>
              {weekdayLabels.map((dayLabel) => (
                <Text key={dayLabel} style={styles.weekdayText}>
                  {dayLabel}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const isStart = !!dateRange.from && isSameDay(day, dateRange.from);
                const isEnd = !!dateRange.to && isSameDay(day, dateRange.to);
                const isInRange = isWithinRange(day, dateRange);

                return (
                  <Pressable
                    key={day.toISOString()}
                    onPress={() => handleSelectDate(day)}
                    style={[
                      styles.dayCell,
                      isInRange && styles.dayCellInRange,
                      (isStart || isEnd) && styles.dayCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isInRange && styles.dayTextInRange,
                        (isStart || isEnd) && styles.dayTextSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalOutline} onPress={clearDateRange}>
                <Text style={styles.modalOutlineText}>Clear</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => setCalendarVisible(false)}
              >
                <Text style={styles.modalPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedWorkspace}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {!bookingConfirmed ? (
              <>
                <Text style={styles.modalTitle}>Confirm Booking</Text>
                <Text style={styles.modalSubtitle}>
                  You are about to book the following workspace:
                </Text>

                {selectedWorkspace && (
                  <View style={styles.modalWorkspace}>
                    <Image
                      source={{ uri: selectedWorkspace.image }}
                      style={styles.modalImage}
                    />
                    <Text style={styles.modalWorkspaceTitle}>
                      {selectedWorkspace.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.metaText}>{selectedWorkspace.location}</Text>
                    </View>
                    <Text style={styles.modalPrice}>${selectedWorkspace.price}/day</Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable style={styles.modalOutline} onPress={closeModal}>
                    <Text style={styles.modalOutlineText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.modalPrimary}
                    onPress={() => setBookingConfirmed(true)}
                  >
                    <Text style={styles.modalPrimaryText}>Confirm Booking</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.confirmIcon}>
                  <Ionicons name="checkmark" size={28} color={colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Booking Confirmed!</Text>
                <Text style={styles.modalSubtitle}>
                  Your workspace has been successfully booked.
                </Text>
                <Pressable style={styles.modalPrimary} onPress={closeModal}>
                  <Text style={styles.modalPrimaryText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function matchesWorkspaceType(type: Workspace["type"], filter: string) {
  if (!filter) return true;
  if (filter === "private") return type === "Private Office";
  if (filter === "coworking") return type === "Co-Working Space";
  if (filter === "meeting") return type === "Meeting Room";
  if (filter === "event") return type === "Event Space";
  return true;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinRange(day: Date, range: DateRange) {
  if (!range.from || !range.to) return false;
  const value = startOfDay(day).getTime();
  const from = startOfDay(range.from).getTime();
  const to = startOfDay(range.to).getTime();
  return value >= from && value <= to;
}

function getCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const result: Array<Date | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    result.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    result.push(new Date(year, monthIndex, day));
  }

  return result;
}

function formatMonthLabel(month: Date) {
  return month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRangeLabel(range: DateRange) {
  if (!range.from) return "Select date range";
  if (!range.to) return formatDateLabel(range.from);
  return `${formatDateLabel(range.from)} - ${formatDateLabel(range.to)}`;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
    marginBottom: 16,
  },
  filterCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.muted,
  },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: 16,
  },
  filterLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 15,
  },
  dateRangeWrap: {
    gap: 8,
  },
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateTriggerText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "500",
  },
  dateMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dateMetaText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  clearPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.background,
  },
  clearPillText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.background,
  },
  searchButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  searchButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 15,
  },
  galleryHeader: {
    marginBottom: 12,
  },
  galleryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  gallerySubtitle: {
    color: colors.mutedForeground,
    marginTop: 4,
    fontSize: 14,
  },
  workspaceCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  cardAvailable: {
    borderColor: colors.primary,
  },
  cardUnavailable: {
    borderColor: colors.border,
    opacity: 0.75,
  },
  imageWrap: {
    position: "relative",
    height: 180,
    width: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeAvailable: {
    backgroundColor: colors.primary,
  },
  badgeBooked: {
    backgroundColor: colors.muted,
  },
  badgeTextLight: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextDark: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: colors.mutedForeground,
    fontSize: 14,
    flex: 1,
    flexWrap: "wrap",
  },
  cardFooter: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  priceUnit: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: "500",
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  bookButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 13,
  },
  bookButtonDisabled: {
    backgroundColor: colors.muted,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  bookDisabledText: {
    color: colors.mutedForeground,
    fontWeight: "700",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 20,
    gap: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayText: {
    width: "14.28%",
    textAlign: "center",
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    marginBottom: 8,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dayCellInRange: {
    backgroundColor: colors.muted,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  dayTextInRange: {
    color: colors.foreground,
  },
  dayTextSelected: {
    color: colors.background,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  modalSubtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  modalWorkspace: {
    gap: 8,
  },
  modalImage: {
    width: "100%",
    height: 160,
    borderRadius: radii.md,
  },
  modalWorkspaceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  modalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalOutlineText: {
    color: colors.foreground,
    fontWeight: "700",
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryText: {
    color: colors.background,
    fontWeight: "700",
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});

