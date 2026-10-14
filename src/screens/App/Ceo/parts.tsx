import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppText,
  Banner,
  Card,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  SectionHeader,
  SkeletonBlock,
  SkeletonGroup,
} from "../../../components/ui";
import { ceoErrorView, trailForSpeech, type CeoErrorView } from "../../../services/ceo";
import { spacing, useThemeColors } from "../../../theme";

// Building blocks shared by the CEO and Sales Manager screens: data loading with stale-answer protection, error /
// empty / loading states and the drill-down breadcrumb. Read-only: nothing here offers an action other than
// "Try again".

// ─── Loading ──────────────────────────────────────────────────────────────────────────────────────────────

export type CeoQuery<T> = {
  data: T | null;
  error: unknown;
  /** First load (or a new scope): show skeletons. */
  loading: boolean;
  /** Pull to refresh: keep the figures, show the spinner. */
  refreshing: boolean;
  /** Load again (after an error). */
  reload: () => void;
  /** Pull to refresh. */
  refresh: () => void;
};

/**
 * Runs `load` now and whenever it changes (a new period / location / drill query: the old figures are cleared,
 * so they are never shown under the new labels). Answers to an older request are ignored.
 */
export function useCeoQuery<T>(load: () => Promise<T>): CeoQuery<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean; refreshing: boolean }>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  });
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    (mode: "new" | "retry" | "refresh") => {
      const gen = ++generation.current;
      setState((prev) => ({
        data: mode === "new" ? null : prev.data,
        error: mode === "refresh" ? prev.error : null,
        loading: mode === "refresh" ? prev.loading : !(mode === "retry" && prev.data),
        refreshing: mode === "refresh",
      }));
      const current = () => alive.current && generation.current === gen;
      load().then(
        (data) => {
          if (current()) setState({ data, error: null, loading: false, refreshing: false });
        },
        (error) => {
          if (current()) setState((prev) => ({ data: prev.data, error, loading: false, refreshing: false }));
        },
      );
    },
    [load],
  );

  useEffect(() => {
    run("new");
  }, [run]);

  const reload = useCallback(() => run("retry"), [run]);
  const refresh = useCallback(() => run("refresh"), [run]);
  return { ...state, reload, refresh };
}

// ─── States ───────────────────────────────────────────────────────────────────────────────────────────────

/** Turns an error into its title / message / icon (ceoErrorView for the CEO; the Sales Manager has its own). */
export type DescribeError = (error: unknown) => CeoErrorView;

/**
 * Error state for a dashboard screen or section: the 503 "database update" case, no access, offline, or the API's
 * message. `describe` picks the wording (default: the CEO's).
 */
export function CeoErrorState({
  error,
  onRetry,
  compact = false,
  describe = ceoErrorView,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  describe?: DescribeError;
}) {
  const view = describe(error);
  return (
    <ErrorState
      compact={compact}
      icon={view.icon}
      title={view.title}
      message={view.message}
      onRetry={onRetry}
      retryLabel={view.databaseUpdate ? "Check again" : "Try again"}
    />
  );
}

/** A section with nothing to show yet (the server sent no figures for it). */
export function SectionEmpty({ title = "No figures yet", message }: { title?: string; message: string }) {
  return (
    <Card>
      <EmptyState compact icon="bar-chart-outline" title={title} message={message} />
    </Card>
  );
}

/** Placeholder for a chart card while it loads. */
export function ChartSkeleton({ height = 160 }: { height?: number }) {
  return (
    <Card>
      <SkeletonGroup style={styles.skeleton}>
        <SkeletonBlock width="45%" height={14} radius={5} />
        <SkeletonBlock width="100%" height={height} radius={8} />
      </SkeletonGroup>
    </Card>
  );
}

/** "The figures below are from the last update." warning over figures kept after a failed refresh. */
export function StaleBanner({ error, describe = ceoErrorView, what = "The figures below are" }: { error: unknown; describe?: DescribeError; what?: string }) {
  const view = describe(error);
  return <Banner tone="warning" title={view.title} message={`${view.message} ${what} from the last update.`} />;
}

/** A dashboard section: heading, then skeletons while loading, the content, or the empty state. */
export function CeoSection({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  /** True when the server sent nothing for this section. */
  empty: boolean;
  emptyMessage: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <SectionHeader title={title} subtitle={subtitle} />
      {loading ? (
        <>
          <KpiSkeleton count={4} />
          <ChartSkeleton />
        </>
      ) : empty ? (
        <SectionEmpty message={emptyMessage} />
      ) : (
        children
      )}
    </View>
  );
}

/** A card with a title (and optional caption) above a chart or list. */
export function ChartCard({
  title,
  caption,
  children,
  padding,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  padding?: number;
}) {
  return (
    <Card padding={padding}>
      <View style={padding === 0 ? styles.cardHeadPadded : styles.cardHead}>
        <AppText variant="subheading" accessibilityRole="header">
          {title}
        </AppText>
        {caption ? (
          <AppText variant="caption" color="textMuted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** Muted line inside a card when one chart or list of a section is empty. */
export function InlineEmpty({ text }: { text: string }) {
  return (
    <AppText variant="bodySmall" color="textMuted" style={styles.inlineEmpty}>
      {text}
    </AppText>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────────────────────────────────

/** "Revenue > Oct 2026 > I-8" with chevrons, plus the scope line; read as one sentence by screen readers. */
export function Breadcrumb({ trail, scopeLabel }: { trail: readonly string[]; scopeLabel?: string }) {
  const colors = useThemeColors();
  if (!trail.length && !scopeLabel) return null;
  const speech = [trail.length ? `Path: ${trailForSpeech(trail)}` : null, scopeLabel].filter(Boolean).join(". ");
  return (
    <View style={styles.crumbs} accessible accessibilityLabel={speech}>
      {trail.length ? (
        <View style={styles.crumbRow}>
          {trail.map((part, i) => (
            <Fragment key={`${part}-${i}`}>
              {i > 0 ? <Ionicons name="chevron-forward" size={12} color={colors.textMuted} /> : null}
              <AppText
                variant={i === trail.length - 1 ? "captionStrong" : "caption"}
                color={i === trail.length - 1 ? "text" : "textMuted"}
                numberOfLines={1}
                style={styles.crumb}
              >
                {part}
              </AppText>
            </Fragment>
          ))}
        </View>
      ) : null}
      {scopeLabel ? (
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {scopeLabel}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  skeleton: { gap: spacing.md },
  cardHead: { gap: 2, marginBottom: spacing.md },
  cardHeadPadded: { gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  inlineEmpty: { paddingVertical: spacing.sm },
  crumbs: { gap: 2 },
  crumbRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 4, rowGap: 2 },
  crumb: { flexShrink: 1 },
});
