import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../theme";
import { SkeletonBlock, SkeletonGroup } from "../Skeleton";
import { Button } from "./Button";

// ─── LoadingState ─────────────────────────────────────────────────────────────

export type LoadingStateProps = {
  /** Optional line under the spinner, e.g. "Loading bookings". */
  message?: string;
  /** Fill the available space and centre (default true). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Centred spinner. Prefer ListSkeleton / KpiSkeleton when the layout is known. */
export function LoadingState({ message, fill = true, style }: LoadingStateProps) {
  const { colors, typography } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? "Loading"}
      style={[styles.center, fill && styles.fill, style]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{message}</Text> : null}
    </View>
  );
}

// ─── ListSkeleton ─────────────────────────────────────────────────────────────

export type ListSkeletonProps = {
  /** Number of placeholder rows. Default 6. */
  rows?: number;
  /** Leading circle (avatar / icon). Default true. */
  avatar?: boolean;
  /** "card": each row is a separate card (default). "rows": flat rows divided by hairlines. */
  variant?: "card" | "rows";
  style?: StyleProp<ViewStyle>;
};

/** Placeholder for a loading list. */
export function ListSkeleton({ rows = 6, avatar = true, variant = "card", style }: ListSkeletonProps) {
  const { colors, radii } = useTheme();
  const card = variant === "card";
  return (
    <SkeletonGroup style={[card && styles.gap12, style]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.skRow,
            card
              ? [styles.skCard, { backgroundColor: colors.surface, borderRadius: radii.card, borderColor: colors.border }]
              : [styles.skFlat, { borderBottomColor: colors.border }],
          ]}
        >
          {avatar ? <SkeletonBlock width={40} height={40} radius={20} /> : null}
          <View style={styles.skBody}>
            <SkeletonBlock width={i % 2 ? "55%" : "70%"} height={14} radius={5} />
            <SkeletonBlock width={i % 2 ? "80%" : "45%"} height={11} radius={5} />
          </View>
          <SkeletonBlock width={54} height={20} radius={10} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

// ─── KpiSkeleton ──────────────────────────────────────────────────────────────

export type KpiSkeletonProps = {
  /** Number of tiles. Default 4. */
  count?: number;
  /** Tiles per row. Default 2. */
  columns?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder grid for StatCards. */
export function KpiSkeleton({ count = 4, columns = 2, style }: KpiSkeletonProps) {
  const { colors, radii } = useTheme();
  const rows: number[][] = [];
  for (let i = 0; i < count; i += columns) rows.push(Array.from({ length: Math.min(columns, count - i) }, (_, k) => i + k));
  return (
    <SkeletonGroup style={[styles.gap12, style]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.kpiRow}>
          {row.map(i => (
            <View
              key={i}
              style={[
                styles.kpiTile,
                { backgroundColor: colors.surface, borderRadius: radii.card, borderColor: colors.border },
              ]}
            >
              <SkeletonBlock width="60%" height={12} radius={5} />
              <SkeletonBlock width="45%" height={24} radius={6} />
              <SkeletonBlock width="70%" height={10} radius={5} />
            </View>
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, k) => <View key={`pad${k}`} style={styles.kpiPad} />)
            : null}
        </View>
      ))}
    </SkeletonGroup>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export type EmptyStateProps = {
  /** Ionicons name. Default "file-tray-outline". */
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Smaller paddings for use inside a card. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Nothing to show yet: icon, title, message and an optional action. */
export function EmptyState({ icon = "file-tray-outline", title, message, actionLabel, onAction, compact = false, style }: EmptyStateProps) {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.center, compact ? styles.compact : styles.roomy, style]}>
      <View style={[styles.iconWell, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={colors.onPrimarySoft} />
      </View>
      <Text accessibilityRole="header" style={[typography.subheading, styles.textCenter, { color: colors.text }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[typography.bodySmall, styles.textCenter, styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────

export type ErrorStateProps = {
  title?: string;
  /** What went wrong, in plain words. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Show the retry button as loading. */
  retrying?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Load failed: message and a Retry button. */
export function ErrorState({
  title = "Could not load this",
  message = "Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  compact = false,
  style,
}: ErrorStateProps) {
  const { colors, typography } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.center, compact ? styles.compact : styles.roomy, style]}>
      <View style={[styles.iconWell, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      </View>
      <Text style={[typography.subheading, styles.textCenter, { color: colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[typography.bodySmall, styles.textCenter, styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}
      {onRetry ? (
        <Button
          title={retryLabel}
          onPress={onRetry}
          loading={retrying}
          variant="outline"
          size="sm"
          leftIcon="refresh"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 8 },
  fill: { flex: 1, padding: 24 },
  roomy: { paddingVertical: 48, paddingHorizontal: 24 },
  compact: { paddingVertical: 24, paddingHorizontal: 16 },
  iconWell: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  textCenter: { textAlign: "center" },
  message: { maxWidth: 320 },
  action: { marginTop: 8 },
  skRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skCard: { borderWidth: 1, padding: 14 },
  skFlat: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  gap12: { gap: 12 },
  skBody: { flex: 1, gap: 8 },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiTile: { flex: 1, borderWidth: 1, padding: 14, gap: 10 },
  kpiPad: { flex: 1 },
});
