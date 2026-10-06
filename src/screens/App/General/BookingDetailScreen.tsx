import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Header } from "../../../components/Header";
import { Screen } from "../../../components/Screen";
import { getBookingById } from "../../../services/bookingService";
import type { AppStackParamList } from "../../../navigation/types";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";

type BookingDetailResponse = {
  bookingId?: number | string;
  bookingPublicId?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  spaceCode?: string | null;
  spaceName?: string | null;
  spaceNumber?: string | null;
  spaceCapacity?: number | null;
  spaceTypeName?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  cityName?: string | null;
  branchName?: string | null;
  companyName?: string | null;
  bookingStatusCode?: string | null;
  bookingStatusLabel?: string | null;
  bookingStatus?: string | null;
  startOn?: string | null;
  endOn?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  numberOfMonths?: number | null;
  monthlyRent?: number | null;
  billingPeriod?: string | null;
  billingPeriodLabel?: string | null;
  billingPeriodMonths?: number | null;
  currentCycleAmount?: number | null;
  firstCycleRent?: number | null;
  totalContractAmount?: number | null;
  nextBillDueDate?: string | null;
  nextBillingDate?: string | null;
  balanceLeft?: number | null;
  securityDeposit?: number | null;
  totalAmount?: number | null;
  totalPayable?: number | null;
  totalPaidAmount?: number | null;
  bookedOn?: string | null;
  contract?: {
    contractStartDate?: string | null;
    contractEndDate?: string | null;
    numberOfMonths?: number | null;
    monthlyRent?: number | null;
    billingPeriod?: string | null;
    billingPeriodMonths?: number | null;
    currentCycleAmount?: number | null;
    nextBillingDate?: string | null;
    nextBillDueDate?: string | null;
    balanceLeft?: number | null;
    securityDeposit?: number | null;
    spaceNumber?: string | null;
    appliedTaxPercentage?: number | null;
    taxAmount?: number | null;
    taxAmountOnAdvanceRent?: number | null;
    taxAmountOnContract?: number | null;
  } | null;
  details?: Array<{
    lineId?: number;
    id?: number;
    feeType?: string | null;
    chargeTypeLabel?: string | null;
    description?: string | null;
    amount?: number | null;
    lineTotal?: number | null;
    accountName?: string | null;
  }> | null;
};

export default function BookingDetailScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingDetail">>();
  const bookingId = route.params?.bookingId;

  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
console.log(route, "bookingId");

  useEffect(() => {
    if (!bookingId) {
      setError("Booking id is missing.");
      setLoading(false);
      return;
    }

    let mounted = true;
    getBookingById(bookingId)
      .then((result) => {
        if (!mounted) return;
        setBooking((result ?? null) as BookingDetailResponse | null);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load booking detail.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bookingId]);

  const summary = useMemo(() => [
    { label: "Space", value: booking?.spaceName ?? "—" },
    { label: "Location", value: booking?.locationName ?? "—" },
    { label: "Capacity", value: booking?.spaceCapacity ?? booking?.spaceCapacity ?? "—" },
    { label: "Amount", value: booking ? formatCurrency(booking.totalAmount) : "—" },
  ], [booking]);

  if (loading) {
    return (
      <Screen>
        <Header />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking details…</Text>
        </View>
      </Screen>
    );
  }

  if (error || !booking) {
    return (
      <Screen>
        <Header />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.danger} />
          <Text style={styles.errorTitle}>Unable to load booking</Text>
          <Text style={styles.errorText}>{error ?? "Booking data was not found."}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Booking #{booking.bookingId ?? booking.bookingPublicId ?? "—"}</Text>
              <Text style={styles.title}>{booking.spaceName ?? "Private Office"}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{booking.bookingStatusLabel ?? booking.bookingStatus ?? "Active"}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            {summary.map((item) => (
              <View key={item.label} style={styles.metaBox}>
                <Text style={styles.metaLabel}>{item.label}</Text>
                <Text style={styles.metaValue} numberOfLines={2}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <InfoRow styles={styles} label="Name" value={booking.customerName ?? "—"} />
          <InfoRow styles={styles} label="Email" value={booking.customerEmail ?? "—"} />
          <InfoRow styles={styles} label="Company" value={booking.companyName ?? "—"} />
          <InfoRow styles={styles} label="Address" value={booking.customerAddress ?? "—"} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Space details</Text>
          <InfoRow styles={styles} label="Space code" value={booking.spaceCode ?? "—"} />
          <InfoRow styles={styles} label="Space number" value={booking.spaceNumber ?? "—"} />
          <InfoRow styles={styles} label="Capacity" value={booking.spaceCapacity ? `${booking.spaceCapacity} people` : "—"} />
          <InfoRow styles={styles} label="Type" value={booking.spaceTypeName ?? "—"} />
          <InfoRow styles={styles} label="Branch" value={booking.branchName ?? "—"} />
          <InfoRow styles={styles} label="Location" value={booking.locationName ?? "—"} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contract & billing</Text>
          <InfoRow styles={styles} label="Start" value={formatDateTime(booking.startOn)} />
          <InfoRow styles={styles} label="End" value={formatDateTime(booking.endOn)} />
          <InfoRow styles={styles} label="Contract start" value={formatDateTime(booking.contractStartDate)} />
          <InfoRow styles={styles} label="Contract end" value={formatDateTime(booking.contractEndDate)} />
          <InfoRow styles={styles} label="Billing period" value={booking.billingPeriodLabel ?? booking.billingPeriod ?? "—"} />
          <InfoRow styles={styles} label="Monthly rent" value={formatCurrency(booking.monthlyRent)} />
          <InfoRow styles={styles} label="Security deposit" value={formatCurrency(booking.securityDeposit)} />
          <InfoRow styles={styles} label="Current cycle" value={formatCurrency(booking.currentCycleAmount)} />
          <InfoRow styles={styles} label="Next bill date" value={formatDateTime(booking.nextBillingDate)} />
          <InfoRow styles={styles} label="Balance left" value={formatCurrency(booking.balanceLeft)} />
          <InfoRow styles={styles} label="Total payable" value={formatCurrency(booking.totalPayable)} />
          <InfoRow styles={styles} label="Total paid" value={formatCurrency(booking.totalPaidAmount)} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Charges</Text>
          {(booking.details ?? []).map((line) => (
            <View key={`${line.lineId ?? line.id ?? "line"}-${line.feeType ?? "charge"}`} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineTitle}>{line.feeType ?? line.chargeTypeLabel ?? "Charge"}</Text>
                <Text style={styles.lineSubtitle}>{line.description ?? "Booking charge"}</Text>
              </View>
              <Text style={styles.lineAmount}>{formatCurrency(line.lineTotal ?? line.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "PKR 0.00";
  return `PKR ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, gap: 12 },
  loadingText: { color: colors.mutedForeground, fontSize: 14, fontWeight: "600" },
  errorTitle: { color: colors.foreground, fontSize: 20, fontWeight: "800" },
  errorText: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  primaryBtnText: { color: colors.white, fontWeight: "700" },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    marginTop: 14,
    gap: 14,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryMuted,
  },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.foreground, fontSize: 20, fontWeight: "800", marginTop: 2 },
  statusBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusText: { color: colors.primary, fontWeight: "700", fontSize: 11 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaBox: {
    flexBasis: "48%",
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaLabel: { color: colors.mutedForeground, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" },
  metaValue: { color: colors.foreground, fontSize: 14, fontWeight: "700", marginTop: 4 },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 14,
    gap: 10,
  },
  sectionTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800", marginBottom: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  infoLabel: { fontSize: 12, fontWeight: "600", flex: 1 },
  infoValue: { fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineTitle: { color: colors.foreground, fontWeight: "700" },
  lineSubtitle: { color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  lineAmount: { color: colors.foreground, fontWeight: "800" },
});
