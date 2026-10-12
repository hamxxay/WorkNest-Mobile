import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Card, SmartImage, StatusPill } from "../../components/ui";
import { useThemeColors, useThemedStyles, type AppColors, type Theme } from "../../theme";
import { formatMoney } from "../../utils/format";
import { priceUnitLabel, type Workspace } from "../../services/workspaceService";

/** "PKR 25,000 / month" from the API's listed rate, or "Price on request" when the API has none. */
export function listedRate(workspace: Pick<Workspace, "price" | "priceUnit">): string {
  if (!(workspace.price > 0)) return "Price on request";
  const unit = priceUnitLabel(workspace);
  return `${formatMoney(workspace.price)}${unit ? ` / ${unit}` : ""}`;
}

/** Spaces still free of this type at this location, as reported by GET /space/available. */
export function availabilityOf(workspace: Workspace): { label: string; tone: "success" | "warning" | "danger" } {
  if (!workspace.available || workspace.availableCount <= 0) return { label: "Fully booked", tone: "danger" };
  if (workspace.availableCount <= 2) return { label: `${workspace.availableCount} left`, tone: "warning" };
  return { label: `${workspace.availableCount} available`, tone: "success" };
}

/** A space card (photo, type, location, capacity, listed rate, availability). */
export function WorkspaceCard({ workspace, onPress }: { workspace: Workspace; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const availability = availabilityOf(workspace);
  return (
    <Card
      padding={0}
      onPress={onPress}
      accessibilityLabel={`${workspace.name}, ${workspace.type}${workspace.location ? `, ${workspace.location}` : ""}, ${listedRate(workspace)}, ${availability.label}`}
    >
      <SmartImage uri={workspace.image} style={styles.image} resizeMode="cover" />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="subheading" numberOfLines={1} style={styles.flex}>
            {workspace.name}
          </AppText>
          <StatusPill tone={availability.tone} label={availability.label} />
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted">
            {workspace.type}
          </AppText>
          {workspace.location ? (
            <>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} style={styles.metaGap} />
              <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.shrink}>
                {workspace.location}
              </AppText>
            </>
          ) : null}
          {workspace.capacity ? (
            <>
              <Ionicons name="people-outline" size={14} color={colors.textMuted} style={styles.metaGap} />
              <AppText variant="caption" color="textMuted">
                {workspace.capacity}
              </AppText>
            </>
          ) : null}
        </View>
        <AppText variant="bodyStrong" color="primary">
          {listedRate(workspace)}
        </AppText>
      </View>
    </Card>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    image: {
      width: "100%",
      height: 150,
      backgroundColor: c.surfaceAlt,
      borderTopLeftRadius: t.radii.card,
      borderTopRightRadius: t.radii.card,
    },
    body: { padding: t.spacing.lg, gap: t.spacing.sm },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    metaRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, flexWrap: "wrap" },
    metaGap: { marginLeft: t.spacing.sm },
    flex: { flex: 1 },
    shrink: { flexShrink: 1 },
  });
