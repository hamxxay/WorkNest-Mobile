import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  AppText,
  Banner,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  ResponsiveGrid,
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
  /** When the figures on screen arrived (ms since epoch); null before the first answer. */
  loadedAt: number | null;
  /** Load again (after an error). */
  reload: () => void;
  /** Pull to refresh. */
  refresh: () => void;
  /** The auto refresh: load again without a skeleton or a spinner; the figures stay until the new ones arrive. */
  quietRefresh: () => void;
};

type QueryState<T> = { data: T | null; error: unknown; loading: boolean; refreshing: boolean; loadedAt: number | null };

/**
 * Runs `load` now and whenever it changes (a new period / location / drill query: the old figures are cleared,
 * so they are never shown under the new labels). Answers to an older request are ignored.
 */
export function useCeoQuery<T>(load: () => Promise<T>): CeoQuery<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
    loadedAt: null,
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
    (mode: "new" | "retry" | "refresh" | "quiet") => {
      const gen = ++generation.current;
      // Quiet (the auto refresh): nothing on screen changes until the answer arrives.
      if (mode !== "quiet") {
        setState((prev) => ({
          data: mode === "new" ? null : prev.data,
          error: mode === "refresh" ? prev.error : null,
          loading: mode === "refresh" ? prev.loading : !(mode === "retry" && prev.data),
          refreshing: mode === "refresh",
          loadedAt: mode === "new" ? null : prev.loadedAt,
        }));
      }
      const current = () => alive.current && generation.current === gen;
      load().then(
        (data) => {
          if (current()) setState({ data, error: null, loading: false, refreshing: false, loadedAt: Date.now() });
        },
        (error) => {
          if (current()) setState((prev) => ({ data: prev.data, error, loading: false, refreshing: false, loadedAt: prev.loadedAt }));
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
  const quietRefresh = useCallback(() => run("quiet"), [run]);
  return { ...state, reload, refresh, quietRefresh };
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

/** Placeholder for a chart card while it loads: the card's title and caption lines, then the plot. */
export function ChartSkeleton({ height = 160 }: { height?: number }) {
  return (
    <Card>
      <SkeletonGroup>
        <View style={styles.skeletonHead}>
          <SkeletonBlock width="45%" height={14} radius={5} />
          <SkeletonBlock width="70%" height={10} radius={5} />
        </View>
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

/** A small muted line with an info icon under a section heading (e.g. what the section's scope includes). */
export function SectionNote({ text }: { text: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.note} accessible accessibilityLabel={`Note: ${text}.`}>
      <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
      <AppText variant="caption" color="textMuted" style={styles.flexShrink}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * The line under a dashboard's period and location pickers: the period shown ("October 2026") on the left, when the
 * figures arrived on the right with a dot (green: up to date; amber: the last refresh failed, the figures are older).
 * A placeholder of the same height while the first answer loads, so the sections below do not move when it arrives.
 */
export function ScopeLine({
  text,
  updated,
  loading = false,
  stale = false,
}: {
  /** The period (and anything else) shown, e.g. "October 2026". */
  text?: string;
  /** "Updated 2 min ago" (empty before the first answer). */
  updated?: string;
  loading?: boolean;
  /** The last refresh failed: the figures on screen are from an earlier update. */
  stale?: boolean;
}) {
  const colors = useThemeColors();
  if (loading && !updated) {
    return (
      <SkeletonGroup style={styles.scope}>
        <SkeletonBlock width="40%" height={12} radius={5} />
        <SkeletonBlock width="28%" height={12} radius={5} />
      </SkeletonGroup>
    );
  }
  if (!text && !updated) return null;
  return (
    <View style={styles.scope} accessible accessibilityLabel={[text, updated].filter(Boolean).join(". ")}>
      {text ? (
        <View style={styles.scopeSide}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <AppText variant="captionStrong" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
            {text}
          </AppText>
        </View>
      ) : null}
      {updated ? (
        <View style={[styles.scopeSide, styles.scopeEnd]}>
          <View style={[styles.dot, { backgroundColor: stale ? colors.warning : colors.success }]} />
          <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.flexShrink}>
            {updated}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** A dashboard section: heading (and note), then skeletons while loading, the content, or the empty state. */
export function CeoSection({
  title,
  subtitle,
  note,
  loading,
  empty,
  emptyMessage,
  skeletonTiles = 4,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  /** A short scope note under the heading (shown while loading too). */
  note?: string;
  loading: boolean;
  /** True when the server sent nothing for this section. */
  empty: boolean;
  emptyMessage: string;
  /** KPI tiles the loading skeleton shows (the section's own tile count, so nothing moves when they arrive). Default 4. */
  skeletonTiles?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <SectionHeader variant="section" title={title} subtitle={subtitle} />
      {note ? <SectionNote text={note} /> : null}
      {loading ? (
        <>
          <KpiSkeleton count={skeletonTiles} />
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

/**
 * A card with a title (and optional caption) above a chart or list. The title is one step below the section heading
 * (15 semibold); a list card (`padding={0}`) gets a hairline under its heading, so its rows read as a table.
 */
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
  const list = padding === 0;
  return (
    <Card padding={padding} style={styles.chartCard}>
      <View style={list ? styles.cardHeadPadded : styles.cardHead}>
        <AppText variant="bodyStrong" accessibilityRole="header">
          {title}
        </AppText>
        {caption ? (
          <AppText variant="caption" color="textMuted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {list ? <Divider /> : null}
      {children}
    </Card>
  );
}

/** Narrowest a chart card gets before chart cards go one per row (dp). */
const CHART_CARD_MIN_WIDTH = 420;

/**
 * Chart cards of one section: one per row on phones and the Fold, two side by side on a wide window (a tablet in
 * landscape) instead of charts stretched across the whole screen. An odd last card takes the full width.
 */
export function ChartGrid({ children }: { children: ReactNode }) {
  return (
    <ResponsiveGrid minItemWidth={CHART_CARD_MIN_WIDTH} maxColumns={2} balanced={false} fontWeight={0.25} gap={spacing.md}>
      {children}
    </ResponsiveGrid>
  );
}

/** Muted line inside a card when one chart or list of a section is empty: centred, with a small icon. */
export function InlineEmpty({ text }: { text: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.inlineEmpty} accessible accessibilityLabel={text}>
      <Ionicons name="remove-circle-outline" size={16} color={colors.textMuted} />
      <AppText variant="bodySmall" color="textMuted" align="center" style={styles.flexShrink}>
        {text}
      </AppText>
    </View>
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
  section: { gap: spacing.md },
  skeletonHead: { gap: 6, marginBottom: spacing.lg },
  // Side by side on a wide window: both cards of a row take its full height.
  chartCard: { flexGrow: 1 },
  cardHead: { gap: 2, marginBottom: spacing.lg },
  cardHeadPadded: { gap: 2, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  inlineEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.lg },
  crumbs: { gap: 2 },
  crumbRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 4, rowGap: 2 },
  crumb: { flexShrink: 1 },
  note: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Wraps on a narrow phone or with large text: "Updated ..." goes under the period, still at the end.
  scope: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: spacing.md, rowGap: 4, minHeight: 20 },
  scopeSide: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  scopeEnd: { marginLeft: "auto" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  flexShrink: { flexShrink: 1 },
});
