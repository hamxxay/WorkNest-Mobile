import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Header } from "../../components/Header";
import { Screen } from "../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { logoutUser, updateUserProfile } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import type { RootStackParamList } from "../../navigation/types";
import { getMyBookings } from "../../services/workspaceService";

type BookingItem = {
  id: number;
  startDateTime?: string;
  endDateTime?: string;
  bookingStatus?: string;
};

type BookingSummary = {
  upcoming: number;
  completed: number;
  cancelled: number;
};

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clearSession, user, setUser } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [summary, setSummary] = useState<BookingSummary>({
    upcoming: 0,
    completed: 0,
    cancelled: 0,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenEdit = () => {
    setEditName(user?.name || "");
    setEditPhone((user?.phoneNumber as string) || "");
    setErrorMessage("");
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setErrorMessage("Name cannot be empty.");
      return;
    }
    try {
      setIsSavingProfile(true);
      setErrorMessage("");
      const updatedUser = await updateUserProfile(editName.trim(), editPhone.trim());
      setUser(updatedUser);
      setShowEditModal(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutUser();
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "AuthStack", params: { screen: "Login" } }] });
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    let active = true;
    getMyBookings()
      .then((items) => {
        if (!active) return;
        setSummary(buildSummary(items as BookingItem[]));
      })
      .catch(() => {
        if (!active) return;
        setSummary({ upcoming: 0, completed: 0, cancelled: 0 });
      });

    return () => {
      active = false;
    };
  }, [isFocused]);

  const summaryItems = useMemo(
    () => [
      { label: "Upcoming", value: summary.upcoming },
      { label: "Completed", value: summary.completed },
      { label: "Cancelled", value: summary.cancelled },
    ],
    [summary]
  );

  const displayName = user?.name?.trim() || "WorkNest Member";
  const displaySubtitle = user?.email?.trim() || "Signed in with Firebase";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        {/* Hero profile card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBg} />
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={34} color={colors.white} />
            </View>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.subText} numberOfLines={1}>{displaySubtitle}</Text>
          {user?.phoneNumber ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={colors.mutedForeground} />
              <Text style={styles.phoneText} numberOfLines={1}>{user.phoneNumber as string}</Text>
            </View>
          ) : null}
          <Pressable style={styles.editButton} onPress={handleOpenEdit}>
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Booking stats */}
        <View style={styles.statsRow}>
          {summaryItems.map((item, i) => (
            <View key={item.label} style={[styles.statCard, i === 1 && styles.statCardMiddle]}>
              <Text style={[styles.statValue, i === 1 && styles.statValueAccent]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Membership card */}
        <View style={styles.membershipCard}>
          <View style={styles.membershipLeft}>
            <View style={styles.membershipIconWell}>
              <Ionicons name="ribbon" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.membershipTitle}>WorkNest Plus</Text>
              <Text style={styles.membershipSub}>Renews May 2026</Text>
            </View>
          </View>
          <Pressable style={styles.manageBtn}>
            <Text style={styles.manageBtnText}>Manage</Text>
          </Pressable>
        </View>

        {/* Settings menu */}
        <View style={styles.menuCard}>
          {[
            { icon: "person-outline" as const, label: "Edit Profile", onPress: handleOpenEdit },
            { icon: "time-outline" as const, label: "Booking History", onPress: () => {} },
            { icon: "shield-checkmark-outline" as const, label: "Privacy Policy", onPress: () => {} },
            { icon: "information-circle-outline" as const, label: "About WorkNest", onPress: () => {} },
          ].map((item, idx, arr) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                idx < arr.length - 1 && styles.menuItemBorder,
                pressed && { backgroundColor: colors.primaryMuted },
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuIconWell}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <ConfirmModal
        visible={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
        cancelText="Cancel"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          handleLogout().catch(() => {
            setShowLogoutConfirm(false);
          });
        }}
      />

      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.inputLabel}>Contact Number</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Enter your contact number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelBtn]}
                onPress={() => setShowEditModal(false)}
                disabled={isSavingProfile}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.saveBtn]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function buildSummary(bookings: BookingItem[]): BookingSummary {
  const now = new Date();
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;

  bookings.forEach((booking) => {
    const status = (booking.bookingStatus ?? "").toLowerCase();
    if (status.includes("cancel")) {
      cancelled += 1;
      return;
    }
    if (status.includes("complete")) {
      completed += 1;
      return;
    }

    const endDate = booking.endDateTime ? new Date(booking.endDateTime) : null;
    if (endDate && endDate < now) {
      completed += 1;
      return;
    }

    upcoming += 1;
  });

  return { upcoming, completed, cancelled };
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: {
    paddingBottom: 36,
    gap: 14,
  },
  // Hero card
  heroCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    paddingBottom: 22,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  avatarWrap: {
    marginTop: 28,
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.card,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10b981",
    borderWidth: 2.5,
    borderColor: colors.card,
  },
  name: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subText: {
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 3,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  phoneText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  editButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  editText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statCardMiddle: {
    backgroundColor: colors.primaryMuted,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statValueAccent: { color: colors.primary },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Membership
  membershipCard: {
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  membershipLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  membershipIconWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  membershipTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800" },
  membershipSub: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  manageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  manageBtnText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  // Settings menu
  menuCard: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuIconWell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuLabel: { flex: 1, color: colors.foreground, fontSize: 14, fontWeight: "600" },
  // Logout
  logoutButton: {
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: radii.xl,
    paddingVertical: 15,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.foreground,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    backgroundColor: colors.dangerMuted,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "center",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedForeground,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
  saveBtn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  saveBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  // kept for TS compat
  sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
  profileCard: { display: "none" },
  summaryCard: { display: "none" },
  summaryRow: { display: "none" },
  summaryItem: { display: "none" },
  summaryLabel: { display: "none" },
  summaryValue: { display: "none" },
  membershipRow: { display: "none" },
  membershipButton: { display: "none" },
  membershipButtonText: { display: "none" },
});
