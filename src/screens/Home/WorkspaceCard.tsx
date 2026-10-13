import { StyleSheet, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Card, SmartImage, StatusPill } from "../../components/ui";
import { useThemeColors, useThemedStyles, type AppColors, type Theme } from "../../theme";
import { capacityLabel, listedRate, type Workspace } from "../../services/workspaceService";

// Re-exported for the screens that import it from here.
export { listedRate };

/** Spaces still free of this type at this location, as reported by GET /space/available. */
export function availabilityOf(workspace: Workspace): { label: string; tone: "success" | "warning" | "danger" } {
  if (!workspace.available || workspace.availableCount <= 0) return { label: "Fully booked", tone: "danger" };
  if (workspace.availableCount <= 2) return { label: `${workspace.availableCount} left`, tone: "warning" };
  return { label: `${workspace.availableCount} available`, tone: "success" };
}

/**
 * A space category card (photo, type, location, seats across its spaces, lowest listed rate, availability). One
 * card stands for all the spaces of that type at a location: the booking assigns one of them.
 */
export function WorkspaceCard({ workspace, onPress }: { workspace: Workspace; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const availability = availabilityOf(workspace);
  const seats = capacityLabel(workspace);
  const showType = workspace.type !== workspace.name;
  const meta = [
    showType ? { icon: "business-outline", text: workspace.type } : null,
    workspace.location ? { icon: "location-outline", text: workspace.location } : null,
    seats ? { icon: "people-outline", text: seats } : null,
  ].filter((item): item is { icon: string; text: string } => item !== null);
  return (
    <Card
      padding={0}
      onPress={onPress}
      accessibilityLabel={[
        workspace.name,
        showType ? workspace.type : "",
        workspace.location,
        seats,
        listedRate(workspace),
        availability.label,
      ]
        .filter(Boolean)
        .join(", ")}
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
          {meta.map((item, i) => (
            <View key={item.icon} style={[styles.metaItem, i > 0 && styles.metaGap]}>
              <Ionicons name={item.icon} size={14} color={colors.textMuted} />
              <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.shrink}>
                {item.text}
              </AppText>
            </View>
          ))}
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
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: t.spacing.xs },
    metaItem: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, flexShrink: 1 },
    metaGap: { marginLeft: t.spacing.sm },
    flex: { flex: 1 },
    shrink: { flexShrink: 1 },
  });
