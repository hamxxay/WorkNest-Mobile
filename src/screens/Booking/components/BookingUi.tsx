import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SmartImage } from "../../../components/SmartImage";
import { radii, shadows, spacing, useThemeColors, useThemedStyles } from "../../../theme";
import type { WorkspaceSummary } from "../../../navigation/types";

type StepKey = "datetime" | "guest" | "payment";

const STEP_COPY: Record<StepKey, string> = {
  datetime: "Booking information",
  guest: "Guest details",
  payment: "Review & confirm",
};

export function BookingProgress({ activeStep }: { activeStep: StepKey }) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const steps: StepKey[] = ["datetime", "guest", "payment"];
  const activeIndex = steps.indexOf(activeStep);
  return <View accessibilityRole="progressbar" accessibilityLabel={`Booking step ${activeIndex + 1} of 3`} style={styles.progress}>
    {steps.map((step, index) => {
      const complete = index < activeIndex;
      const active = index === activeIndex;
      return <View key={step} style={styles.progressItem}>
        <View style={styles.progressLineWrap}>
          {index > 0 ? <View style={[styles.progressLine, index <= activeIndex && styles.progressLineComplete]} /> : null}
          <View style={[styles.progressDot, (active || complete) && styles.progressDotActive]}>
            <Ionicons name={complete ? "checkmark" : "ellipse"} size={complete ? 15 : 7} color={active || complete ? colors.white : colors.mutedForeground} />
          </View>
        </View>
        <Text numberOfLines={1} style={[styles.progressText, active && styles.progressTextActive]}>{STEP_COPY[step]}</Text>
      </View>;
    })}
  </View>;
}

export function WorkspaceSummaryCard({ workspace }: { workspace: WorkspaceSummary }) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const amenities = workspace.amenities.slice(0, 3);
  const availability = getAvailability(workspace);
  return <View style={styles.workspaceCard} accessible accessibilityLabel={`${workspace.name}, ${workspace.location}, PKR ${workspace.price} per day`}>
    <View style={styles.imageWrap}>
      <SmartImage uri={workspace.image} style={styles.image} />
      <View style={styles.imageGradient} />
      <View style={[styles.availableBadge, { backgroundColor: availability.background }]}>
        <View style={[styles.statusDot, { backgroundColor: availability.color }]} />
        <Text style={[styles.availableText, { color: availability.color }]}>{availability.label}</Text>
      </View>
      <View style={styles.ratingBadge}><Ionicons name="star" size={13} color="#FBBF24" /><Text style={styles.ratingText}>{getRating(workspace)}</Text></View>
      <View accessibilityElementsHidden style={styles.favoriteButton}>
        <Ionicons name="heart-outline" size={19} color={colors.white} />
      </View>
      <View style={styles.imageTitle}><Text style={styles.imageTitleText} numberOfLines={1}>{workspace.name}</Text></View>
    </View>
    <View style={styles.workspaceBody}>
      <View style={styles.workspaceMeta}><Ionicons name="location-outline" size={15} color={colors.mutedForeground} /><Text style={styles.workspaceMetaText} numberOfLines={1}>{workspace.location}</Text><Ionicons name="people-outline" size={15} color={colors.mutedForeground} /><Text style={styles.workspaceMetaText}>{workspace.capacity}</Text></View>
      {amenities.length ? <View style={styles.amenities}>{amenities.map((amenity) => <View key={amenity} style={styles.amenity}><Ionicons name="checkmark-circle" size={12} color={colors.primary} /><Text style={styles.amenityText}>{amenity}</Text></View>)}</View> : null}
      <View style={styles.priceRow}><Text style={styles.priceLabel}>Your workspace</Text><Text style={styles.price}>PKR {Number(workspace.price).toLocaleString()}<Text style={styles.priceUnit}> / day</Text></Text></View>
    </View>
  </View>;
}

export function OutlinedField({ icon, label, children, onPress, value, placeholder }: { icon: string; label: string; children?: ReactNode; onPress?: () => void; value?: string; placeholder?: string }) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const content = <View style={styles.field}><View style={styles.fieldIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View><View style={styles.fieldContent}><Text style={styles.fieldLabel}>{label}</Text>{children ?? <Text style={value ? styles.fieldValue : styles.fieldPlaceholder}>{value || placeholder}</Text>}</View>{onPress ? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /> : null}</View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{content}</Pressable> : content;
}

export function ErrorCard({ message }: { message: string }) {
  const styles = useThemedStyles(createStyles);
  return <View accessibilityRole="alert" style={styles.errorCard}><Ionicons name="information-circle" size={20} color="#DC2626" /><Text style={styles.errorText}>{message}</Text></View>;
}

export function BookingSummaryCard({ workspace, dateLabel, timeLabel }: { workspace: WorkspaceSummary; dateLabel: string; timeLabel: string }) {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  return <View style={styles.summary}><View style={styles.summaryHeader}><Text style={styles.summaryTitle}>Booking summary</Text><Ionicons name="receipt-outline" size={19} color={colors.primary} /></View><SummaryLine icon="calendar-outline" label="Date" value={dateLabel} /><SummaryLine icon="time-outline" label="Time" value={timeLabel} /><View style={styles.summaryDivider} /><View style={styles.totalRow}><View><Text style={styles.totalLabel}>Price shown at checkout</Text><Text style={styles.totalNote}>Taxes and payment details are reviewed next</Text></View><Text style={styles.total}>PKR {Number(workspace.price).toLocaleString()}</Text></View></View>;
}

function SummaryLine({ icon, label, value }: { icon: string; label: string; value: string }) {
  const styles = useThemedStyles(createStyles); const colors = useThemeColors();
  return <View style={styles.summaryLine}><View style={styles.summaryKey}><Ionicons name={icon} size={16} color={colors.mutedForeground} /><Text style={styles.summaryLabel}>{label}</Text></View><Text numberOfLines={1} style={styles.summaryValue}>{value}</Text></View>;
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  progress: { flexDirection: "row", paddingVertical: spacing.sm, marginBottom: spacing.sm }, progressItem: { flex: 1, alignItems: "center" }, progressLineWrap: { height: 30, width: "100%", alignItems: "center", justifyContent: "center" }, progressLine: { position: "absolute", height: 2, backgroundColor: colors.border, width: "100%", left: "-50%" }, progressLineComplete: { backgroundColor: colors.primary }, progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }, progressDotActive: { backgroundColor: colors.primary, borderColor: colors.primary }, progressText: { color: colors.mutedForeground, fontSize: 10, fontWeight: "700", marginTop: 5 }, progressTextActive: { color: colors.foreground },
  workspaceCard: { backgroundColor: colors.card, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...shadows.md }, imageWrap: { height: 164, position: "relative", backgroundColor: colors.muted }, image: { width: "100%", height: "100%" }, imageGradient: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(10,22,40,0.27)" }, availableBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 }, statusDot: { width: 7, height: 7, borderRadius: 4 }, availableText: { fontSize: 11, fontWeight: "800" }, ratingBadge: { position: "absolute", right: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(10,22,40,0.78)" }, ratingText: { color: colors.white, fontSize: 11, fontWeight: "800" }, favoriteButton: { position: "absolute", bottom: 12, right: 12, width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(10,22,40,0.48)" }, imageTitle: { position: "absolute", bottom: 13, left: 14, right: 56 }, imageTitleText: { color: colors.white, fontSize: 21, fontWeight: "800" }, workspaceBody: { padding: spacing.lg, gap: spacing.md }, workspaceMeta: { flexDirection: "row", alignItems: "center", gap: 5 }, workspaceMetaText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600", flexShrink: 1 }, amenities: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, amenity: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryMuted, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 5 }, amenityText: { color: colors.foreground, fontSize: 11, fontWeight: "700" }, priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4 }, priceLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" }, price: { color: colors.foreground, fontSize: 18, fontWeight: "800" }, priceUnit: { fontSize: 11, color: colors.mutedForeground, fontWeight: "600" },
  field: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.card }, fieldIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryMuted, alignItems: "center", justifyContent: "center" }, fieldContent: { flex: 1, gap: 2 }, fieldLabel: { color: colors.mutedForeground, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.45 }, fieldValue: { color: colors.foreground, fontSize: 14, fontWeight: "700" }, fieldPlaceholder: { color: colors.mutedForeground, fontSize: 14, fontWeight: "600" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: "#FCA5A5" }, errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: "600", lineHeight: 19 }, summary: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, gap: 12, ...shadows.sm }, summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }, summaryTitle: { color: colors.foreground, fontSize: 17, fontWeight: "800" }, summaryLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, summaryKey: { flexDirection: "row", gap: 7, alignItems: "center" }, summaryLabel: { color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }, summaryValue: { color: colors.foreground, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" }, summaryDivider: { height: 1, backgroundColor: colors.border }, totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, totalLabel: { color: colors.foreground, fontSize: 13, fontWeight: "800" }, totalNote: { color: colors.mutedForeground, fontSize: 10, marginTop: 2 }, total: { color: colors.primary, fontSize: 19, fontWeight: "800" },
});

function getRating(workspace: WorkspaceSummary) {
  return (4.4 + (Math.abs(Number(workspace.id) || workspace.name.length) % 6) / 10).toFixed(1);
}

function getAvailability(workspace: WorkspaceSummary) {
  const availableCount = (workspace as WorkspaceSummary & { availableCount?: number }).availableCount;
  if (!workspace.available) return { label: "Sold Out", color: "#DC2626", background: "#FEE2E2" };
  if (typeof availableCount === "number" && availableCount <= 2) return { label: "Few Left", color: "#D97706", background: "#FEF3C7" };
  return { label: "Available", color: "#059669", background: "#D1FAE5" };
}
