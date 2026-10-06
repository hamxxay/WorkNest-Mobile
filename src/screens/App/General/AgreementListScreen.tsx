import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Screen } from "../../../components/Screen";
import { DashboardHeader } from "../../../components/DashboardHeader";
import { radii, shadows, useThemeColors, useThemedStyles } from "../../../theme";
import { getMyAgreements, type AgreementRecord, type AgreementStatus } from "../../../services/agreementService";
import type { AppStackParamList } from "../../../navigation/types";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; bg: string; border: string; text: string }
> = {
  pending: {
    label: "Pending",
    icon: "time-outline",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.4)",
    text: "#d97706",
  },
  sent: {
    label: "Sent",
    icon: "paper-plane-outline",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.4)",
    text: "#2563eb",
  },
  signeduploaded: {
    label: "Signed (Under Review)",
    icon: "cloud-upload-outline",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.4)",
    text: "#6366f1",
  },
  signed: {
    label: "Signed",
    icon: "checkmark-circle-outline",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.4)",
    text: "#059669",
  },
  expired: {
    label: "Expired",
    icon: "alert-circle-outline",
    bg: "rgba(100,116,139,0.12)",
    border: "rgba(100,116,139,0.4)",
    text: "#64748b",
  },
  cancelled: {
    label: "Cancelled",
    icon: "close-circle-outline",
    bg: "rgba(220,38,38,0.12)",
    border: "rgba(220,38,38,0.4)",
    text: "#dc2626",
  },
};

function getStatusConfig(status?: AgreementStatus) {
  const key = (status ?? "pending").toLowerCase().replace(/\s/g, "");
  return STATUS_CONFIG[key] ?? STATUS_CONFIG.pending;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function AgreementCard({
  agreement,
  onPress,
  colors,
}: {
  agreement: AgreementRecord;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const sc = getStatusConfig(agreement.status);

  const fmt = (iso: string | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWell}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={[styles.cardNumber, { color: colors.foreground }]} numberOfLines={1}>
            Agreement #{agreement.id ?? "—"}
          </Text>
          {agreement.quotationNumber ? (
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              Quotation: {agreement.quotationNumber}
            </Text>
          ) : null}
        </View>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Ionicons name={sc.icon} size={11} color={sc.text} />
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={styles.cardMeta}>
        {agreement.spaceName ? (
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {agreement.spaceName}
            </Text>
          </View>
        ) : null}
        {agreement.contractStartDate ? (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {fmt(agreement.contractStartDate)} – {fmt(agreement.contractEndDate)}
            </Text>
          </View>
        ) : null}
        {agreement.feeAmount ? (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              PKR {agreement.feeAmount.toLocaleString()}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action hint */}
      <View style={[styles.cardAction, { borderTopColor: colors.border }]}>
        <Text style={[styles.cardActionText, { color: colors.primary }]}>
          {agreement.status?.toLowerCase() === "sent"
            ? "Review & Upload Signed Copy"
            : "View Details"}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<AppStackParamList>;

export default function AgreementListScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await getMyAgreements();
      setAgreements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agreements.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <DashboardHeader role="Customer" title="My Agreements" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading agreements…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => load()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : agreements.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Agreements Yet</Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            When a sales agent sends you a lease agreement it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={agreements}
          keyExtractor={(item) => String(item.id ?? Math.random())}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <AgreementCard
              agreement={item}
              colors={colors}
              onPress={() =>
                navigation.navigate("AgreementDetail", { agreementId: item.id! })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  list: { padding: 16, paddingBottom: 40 },
  // Card
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  cardIconWell: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(13,91,95,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleBlock: { flex: 1 },
  cardNumber: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  cardSub: { fontSize: 11, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  cardMeta: { gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12 },
  cardAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardActionText: { fontSize: 12, fontWeight: "700" },
});

const createStyles = (_colors: ReturnType<typeof useThemeColors>) => styles;

