import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Card, SmartImage, StatusPill } from "../../components/ui";
import { useThemeColors, useThemedStyles, type AppColors, type Theme } from "../../theme";
import { capacityLabel, listedRate, type Workspace } from "../../services/workspaceService";
import { TitleRow } from "../App/General/shared/TitleRow";

// Re-exported for the screens that import it from here.
export { listedRate };

/**
 * Narrowest a space card gets in a grid at the default font size (dp): one per row on phones, two on tablets and
 * unfolded foldables.
 */
export const SPACE_CARD_MIN_WIDTH = 300;

/**
 * Spaces of this type at this location free right now (GET /space/available). "Fully booked now" is not "can't be
 * booked": a later period may be free, which the booking screen checks for the dates chosen.
 */
export function availabilityOf(workspace: Workspace): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (!workspace.bookable) return { label: "Price on request", tone: "neutral" };
  if (!workspace.available || workspace.availableCount <= 0) return { label: "Fully booked now", tone: "warning" };
  if (workspace.availableCount <= 2) return { label: `${workspace.availableCount} left`, tone: "warning" };
  return { label: `${workspace.availableCount} available`, tone: "success" };
}

/**
 * A space category card (photo, type, location, seats across its spaces, lowest listed rate, availability). One
 * card stands for all the spaces of that type at a location: the booking assigns one of them.
 */
export function WorkspaceCard({
  workspace,
  onPress,
  style,
}: {
  workspace: Workspace;
  onPress: () => void;
  /** E.g. flexGrow: 1 to fill a grid cell. */
  style?: StyleProp<ViewStyle>;
}) {
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
      style={style}
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
        <TitleRow title={workspace.name} right={<StatusPill tone={availability.tone} label={availability.label} />} />
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
    // A fixed shape instead of a fixed height: ~150dp tall on a phone, not a thin strip on a tablet or an unfolded
    // foldable, never taller than 240dp (a phone in landscape).
    image: {
      width: "100%",
      aspectRatio: 2.4,
      maxHeight: 240,
      backgroundColor: c.surfaceAlt,
      borderTopLeftRadius: t.radii.card,
      borderTopRightRadius: t.radii.card,
    },
    body: { padding: t.spacing.lg, gap: t.spacing.sm },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: t.spacing.xs },
    metaItem: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, flexShrink: 1 },
    metaGap: { marginLeft: t.spacing.sm },
    shrink: { flexShrink: 1 },
  });
