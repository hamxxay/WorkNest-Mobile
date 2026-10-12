import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { resolveColor, type TextColor } from "./AppText";

export type InfoRowProps = {
  label: string;
  /** Text, number or any element (e.g. <StatusPill/>). Empty values show an em dash. */
  value?: ReactNode;
  /** Ionicons name before the label. */
  icon?: string;
  /** "inline" (default): label left, value right. "stacked": label above value (long values, addresses). */
  layout?: "inline" | "stacked";
  /** Bold value (totals). */
  emphasize?: boolean;
  valueColor?: TextColor | (string & {});
  /** Max lines for a text value. Default 3. */
  valueLines?: number;
  style?: StyleProp<ViewStyle>;
};

/** Label / value pair for detail screens (booking detail, invoice, quotation summary). */
export function InfoRow({
  label,
  value,
  icon,
  layout = "inline",
  emphasize = false,
  valueColor,
  valueLines = 3,
  style,
}: InfoRowProps) {
  const { colors, typography } = useTheme();
  const empty = value === null || value === undefined || value === "";
  const isText = typeof value === "string" || typeof value === "number" || empty;
  const stacked = layout === "stacked";

  const valueNode = isText ? (
    <Text
      numberOfLines={valueLines}
      style={[
        emphasize ? typography.subheading : typography.bodyStrong,
        { color: resolveColor(colors, valueColor, colors.text) },
        !stacked && styles.valueInline,
      ]}
      selectable
    >
      {empty ? "—" : String(value)}
    </Text>
  ) : (
    value
  );

  return (
    <View
      accessible={isText}
      accessibilityLabel={isText ? `${label}: ${empty ? "not set" : String(value)}` : undefined}
      style={[stacked ? styles.stacked : styles.inline, style]}
    >
      <View style={styles.labelRow}>
        {icon ? <Ionicons name={icon} size={16} color={colors.textMuted} /> : null}
        <Text style={[typography.bodySmall, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      {valueNode}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  stacked: { gap: 2, paddingVertical: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  valueInline: { flexShrink: 1, textAlign: "right" },
});
