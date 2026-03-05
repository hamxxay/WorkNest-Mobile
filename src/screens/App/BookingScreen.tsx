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
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { colors, radii } from "../../theme";

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

const typeOptions = ["", "private", "co-working", "meeting", "event"] as const;

export default function BookingScreen() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceType, setWorkspaceType] = useState<string>("");
  const [selectedSpace, setSelectedSpace] = useState<Workspace | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingStartDate, setBookingStartDate] = useState(todayDate());
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingEndDate, setBookingEndDate] = useState(todayDate());
  const [bookingEndTime, setBookingEndTime] = useState("17:00");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingError, setBookingError] = useState("");

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

  const openBookingModal = (workspace: Workspace) => {
    setSelectedSpace(workspace);
    setBookingError("");
    setBookingSuccess("");
    setBookingNotes("");
    setBookingStartDate(todayDate());
    setBookingEndDate(todayDate());
    setBookingStartTime("09:00");
    setBookingEndTime("17:00");
  };

  const closeBookingModal = () => {
    setSelectedSpace(null);
    setBookingNotes("");
    setBookingError("");
    setBookingSuccess("");
  };

  const submitBooking = async () => {
    if (!selectedSpace || !bookingStartDate || !bookingEndDate) {
      setBookingError("Please select start and end dates.");
      return;
    }

    const startDateTime = `${bookingStartDate}T${bookingStartTime}:00`;
    const endDateTime = `${bookingEndDate}T${bookingEndTime}:00`;

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.galleryTitle}>Workspace Gallery</Text>
          <Text style={styles.gallerySubtitle}>
            Browse available workspaces and find your perfect fit.
          </Text>
        </View>

        {loading ? <Text style={styles.helperText}>Loading workspaces...</Text> : null}
        {!loading && filteredWorkspaces.length === 0 ? (
          <Text style={styles.helperText}>No workspaces found. Try adjusting filters.</Text>
        ) : null}

        {filteredWorkspaces.map((workspace) => (
          <View key={workspace.id} style={styles.workspaceCard}>
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

            <Text style={styles.label}>Start Date</Text>
            <TextInput style={styles.inputPlain} value={bookingStartDate} onChangeText={setBookingStartDate} placeholder="YYYY-MM-DD" />

            <Text style={styles.label}>Start Time</Text>
            <TextInput style={styles.inputPlain} value={bookingStartTime} onChangeText={setBookingStartTime} placeholder="HH:mm" />

            <Text style={styles.label}>End Date</Text>
            <TextInput style={styles.inputPlain} value={bookingEndDate} onChangeText={setBookingEndDate} placeholder="YYYY-MM-DD" />

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
    </Screen>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: colors.foreground, marginBottom: 16 },
  filterCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  filterTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 12 },
  filterLabel: { marginTop: 14, marginBottom: 8, color: colors.foreground, fontWeight: "600", fontSize: 15 },
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
  input: { flex: 1, color: colors.foreground, fontSize: 16 },
  filterHint: { marginTop: 10, color: colors.mutedForeground, fontSize: 13 },
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
  chipText: { fontSize: 13, color: colors.mutedForeground, fontWeight: "600", textTransform: "capitalize" },
  chipTextActive: { color: colors.background },
  galleryHeader: { marginBottom: 12 },
  galleryTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  gallerySubtitle: { color: colors.mutedForeground, marginTop: 4, fontSize: 14 },
  helperText: { color: colors.mutedForeground, marginBottom: 12 },
  workspaceCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: colors.background,
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
});
