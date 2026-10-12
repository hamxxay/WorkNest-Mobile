import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Screen } from "../../../components/Screen";
import { radii, useThemeColors, useThemedStyles } from "../../../theme";
import { errorMessage } from "../../../services/apiClient";
import {
  categoryCodeForMode,
  createSmartBooking,
  CustomerProfileRequiredError,
  type BookingCustomerProfile,
  type SmartBookingInput,
} from "../../../services/bookingService";
import { priceUnitLabel } from "../../../services/workspaceService";
import type { AppStackParamList, BookingSelection } from "../../../navigation/types";

// Review and confirm a booking. Payment is by bank challan only (like worknestpk.com): confirming creates the
// booking (POST /booking/smart); the API prices it and issues the challan, which opens next. There is no card,
// wallet or bank-transfer form, and nothing is marked paid by the app.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The booking's start / end as local date-times, from what the customer picked. */
export function bookingPeriod(booking: BookingSelection): { startDateTime: string; endDateTime: string } {
  if (booking.mode === "office") {
    const parts = booking.month ? booking.month.split(" to ") : [];
    const startMonth = parts[0]?.trim();
    const endMonth = (parts[1] || parts[0])?.trim();
    if (startMonth) {
      const [sy, sm] = startMonth.split("-").map(Number);
      const [ey, em] = (endMonth || startMonth).split("-").map(Number);
      const start = new Date(sy, sm - 1, 1);
      const end = new Date(ey, em, 0); // last day of the end month
      return { startDateTime: `${isoDate(start)}T09:00:00`, endDateTime: `${isoDate(end)}T17:00:00` };
    }
    const today = isoDate(new Date());
    return { startDateTime: `${today}T09:00:00`, endDateTime: `${today}T17:00:00` };
  }
  const startDate = booking.dates[0] ?? isoDate(new Date());
  const endDate = booking.dates[booking.dates.length - 1] ?? startDate;
  const [slotStart, slotEnd] = booking.slot.includes(" - ")
    ? booking.slot.split(" - ").map((t) => t.trim())
    : ["09:00", "17:00"];
  return { startDateTime: `${startDate}T${slotStart}:00`, endDateTime: `${endDate}T${slotEnd}:00` };
}

function profileFromGuest(guest: { name: string; phone: string }): BookingCustomerProfile {
  const [firstName, ...rest] = guest.name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined, phoneNumber: guest.phone };
}

export default function BookingConfirmScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingConfirm">>();
  const { workspace, booking } = route.params;

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const period = useMemo(() => bookingPeriod(booking), [booking]);
  const unit = priceUnitLabel(workspace);
  const summary =
    booking.mode === "office"
      ? booking.month ?? "Monthly booking"
      : `${booking.dates.join(", ")}  ${booking.slot}`;

  const confirm = async () => {
    if (!termsAccepted || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    const input: SmartBookingInput = {
      categoryCode: categoryCodeForMode(booking.mode),
      startDateTime: period.startDateTime,
      endDateTime: period.endDateTime,
      notes: "Booked in the WorkNest app. Payment by bank challan.",
    };
    try {
      let created;
      try {
        created = await createSmartBooking(input);
      } catch (err) {
        // First booking: the API needs the customer's details, which BookingInfo already collected.
        if (!(err instanceof CustomerProfileRequiredError)) throw err;
        created = await createSmartBooking({ ...input, profile: profileFromGuest(booking.guest) });
      }
      navigation.replace("Challan", {
        bookingId: created.bookingId!,
        challanNumber: created.challanNumber ?? undefined,
      });
    } catch (err) {
      setError(errorMessage(err, "Your booking could not be created. Please try again."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={styles.title}>Confirm Booking</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Booking summary</Text>
          <Row label="Space" value={workspace.name} />
          <Row label="Type" value={workspace.type} />
          {workspace.location ? <Row label="Location" value={workspace.location} /> : null}
          <Row label={booking.mode === "office" ? "Months" : "Dates"} value={summary} />
          {workspace.price > 0 ? (
            <Row label="Listed rate" value={`PKR ${workspace.price.toLocaleString("en-PK")}${unit ? ` per ${unit}` : ""}`} />
          ) : null}
          <View style={styles.divider} />
          <Row label="Name" value={booking.guest.name} />
          <Row label="Email" value={booking.guest.email} />
          <Row label="Phone" value={booking.guest.phone} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment by bank challan</Text>
          <Text style={styles.bodyText}>
            When you confirm, WorkNest assigns your space and issues a bank challan with the exact amount payable
            (rent, tax and any security deposit). Pay it at any HBL branch, ATM or in your mobile banking app under
            1Bill / Bill Payment. Your booking is confirmed once the payment reaches us.
          </Text>
          <Text style={styles.hint}>You can find the challan any time under My Bookings and Payments.</Text>
        </View>

        <Pressable
          style={styles.termsRow}
          onPress={() => setTermsAccepted((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
          </View>
          <Text style={styles.termsText}>
            I agree to the WorkNest terms and conditions and understand the booking is confirmed after the challan is paid.
          </Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.confirmBtn, (!termsAccepted || submitting) && styles.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!termsAccepted || submitting}
          accessibilityRole="button"
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={styles.confirmBtnText}>{submitting ? "Creating your booking..." : "Confirm booking and get challan"}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={3}>{value}</Text>
      </View>
    );
  }
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: { paddingHorizontal: 18, paddingBottom: 32, gap: 14 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnSpacer: { width: 36 },
    title: { color: colors.foreground, fontSize: 17, fontWeight: "800" },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
    sectionTitle: { color: colors.foreground, fontSize: 15, fontWeight: "800", marginBottom: 4 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
    rowLabel: { color: colors.mutedForeground, fontSize: 13, flex: 1 },
    rowValue: { color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 2, textAlign: "right" },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
    bodyText: { color: colors.foreground, fontSize: 13, lineHeight: 19 },
    hint: { color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
    termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    termsText: { color: colors.foreground, fontSize: 13, lineHeight: 19, flex: 1 },
    errorBox: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
    errorText: { color: colors.danger, fontSize: 13, fontWeight: "600", flex: 1 },
    confirmBtn: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 15,
    },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  });
