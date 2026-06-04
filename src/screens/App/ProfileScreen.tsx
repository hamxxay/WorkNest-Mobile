import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
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
  }, []);

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

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.subText} numberOfLines={1}>{displaySubtitle}</Text>
            {user?.phoneNumber ? (
              <Text style={styles.phoneText} numberOfLines={1}>{user.phoneNumber as string}</Text>
            ) : null}
          </View>
          <Pressable style={styles.editButton} onPress={handleOpenEdit}>
            <Ionicons name="create-outline" size={16} color={colors.white} />
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          <View style={styles.summaryRow}>
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.membershipCard}>
          <Text style={styles.sectionTitle}>Membership</Text>
          <View style={styles.membershipRow}>
            <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.membershipTitle}>WorkNest Plus</Text>
              <Text style={styles.subText}>Renews May 2026</Text>
            </View>
          </View>
          <Pressable style={styles.membershipButton}>
            <Text style={styles.membershipButtonText}>Manage Membership</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
          <Ionicons name="log-out-outline" size={18} color={colors.foreground} />
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
    padding: 20,
    paddingBottom: 24,
    gap: 14,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
  },
  subText: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  membershipCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  membershipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  membershipTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700",
  },
  membershipButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  membershipButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
  },
  logoutText: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 14,
  },
  phoneText: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 22,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#1F2A44",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.foreground,
    marginBottom: 16,
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.mutedForeground,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
});
