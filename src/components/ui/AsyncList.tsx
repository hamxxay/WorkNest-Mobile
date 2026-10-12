import { useCallback, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../theme";
import { Button } from "./Button";
import { EmptyState, ErrorState, ListSkeleton, type EmptyStateProps } from "./States";
import { useTabBarSpace } from "./TabBar";

export type AsyncListProps<T> = Omit<
  FlatListProps<T>,
  "data" | "refreshing" | "onRefresh" | "refreshControl" | "ListEmptyComponent" | "onEndReached"
> & {
  data: ReadonlyArray<T> | null | undefined;
  /** First load in progress: shows the skeleton while there is no data. */
  loading?: boolean;
  /** Pull-to-refresh in progress. */
  refreshing?: boolean;
  /** Enables pull-to-refresh. Also used as the default retry action. */
  onRefresh?: () => void;
  /**
   * Error message. With no data: full ErrorState with Retry. With data (e.g. page 2 failed):
   * a small inline "Could not load more" row with Retry at the end of the list.
   */
  error?: string | null;
  /** Retry action. Default: onRefresh. */
  onRetry?: () => void;
  /** Next page is loading: spinner in the footer. */
  loadingMore?: boolean;
  /** More pages exist. onEndReached only fires while true. Default false. */
  hasMore?: boolean;
  /** Load the next page. Guarded: never fires while loading / loadingMore / error or when !hasMore. */
  onEndReached?: () => void;
  /** Empty state shown when loaded with no rows. */
  empty?: EmptyStateProps;
  /** Custom loading placeholder (default <ListSkeleton/>). */
  skeleton?: ReactNode;
  /** Rows in the default skeleton. Default 6. */
  skeletonRows?: number;
  /** Padding around the list content. Default 16. Use contentContainerStyle for more control. */
  padding?: number;
  /** Gap between rows. Default 12. */
  gap?: number;
};

/**
 * FlatList with the four list states built in: loading (skeleton), empty, error + retry, and paging.
 *
 *   <AsyncList
 *     data={items} loading={loading} refreshing={refreshing} onRefresh={refresh}
 *     error={error} hasMore={hasMore} loadingMore={loadingMore} onEndReached={loadMore}
 *     keyExtractor={x => String(x.id)} renderItem={({ item }) => <BookingCard booking={item} />}
 *     empty={{ icon: "calendar-outline", title: "No bookings yet", actionLabel: "Book a space", onAction: goBook }}
 *   />
 */
export function AsyncList<T>({
  data,
  loading = false,
  refreshing = false,
  onRefresh,
  error,
  onRetry,
  loadingMore = false,
  hasMore = false,
  onEndReached,
  empty,
  skeleton,
  skeletonRows = 6,
  padding = 16,
  gap = 12,
  contentContainerStyle,
  ListFooterComponent,
  ItemSeparatorComponent,
  onEndReachedThreshold = 0.4,
  ...rest
}: AsyncListProps<T>): ReactElement {
  const { colors, typography } = useTheme();
  // Inside the bottom tabs the floating tab bar covers the end of the list: scroll the last row clear of it.
  const tabBarSpace = useTabBarSpace();
  const rows = data ?? [];
  const hasRows = rows.length > 0;
  const retry = onRetry ?? onRefresh;

  // FlatList can call onEndReached several times for one scroll; allow one call per data length.
  // The guard starts over when the list shrinks (new query / filter / reload) and when a page request
  // finishes (loadingMore true -> false), so a failed or empty page can be requested again.
  const lastRequestedAt = useRef(-1);
  const wasLoadingMore = useRef(loadingMore);
  useEffect(() => {
    if (wasLoadingMore.current && !loadingMore) lastRequestedAt.current = -1;
    wasLoadingMore.current = loadingMore;
  }, [loadingMore]);
  useEffect(() => {
    if (rows.length < lastRequestedAt.current) lastRequestedAt.current = -1;
  }, [rows.length]);
  const handleEndReached = useCallback(() => {
    if (!onEndReached || !hasMore || loading || loadingMore || refreshing || error || !hasRows) return;
    if (lastRequestedAt.current === rows.length) return;
    lastRequestedAt.current = rows.length;
    onEndReached();
  }, [onEndReached, hasMore, loading, loadingMore, refreshing, error, hasRows, rows.length]);

  let emptyNode: ReactNode;
  if (loading && !hasRows) {
    emptyNode = skeleton ?? <ListSkeleton rows={skeletonRows} />;
  } else if (error && !hasRows) {
    emptyNode = <ErrorState message={error} onRetry={retry} />;
  } else {
    emptyNode = <EmptyState title="Nothing here yet" {...empty} />;
  }

  const footer = (
    <>
      {loadingMore ? (
        <View style={styles.footer} accessibilityLabel="Loading more">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {error && hasRows ? (
        <View style={[styles.footer, styles.footerError]} accessibilityRole="alert">
          <Text style={[typography.bodySmall, styles.shrink, { color: colors.textMuted }]} numberOfLines={2}>
            {error}
          </Text>
          {retry ? (
            <Button
              title="Retry"
              variant="ghost"
              size="sm"
              leftIcon="refresh"
              onPress={() => {
                lastRequestedAt.current = -1;
                retry();
              }}
            />
          ) : null}
        </View>
      ) : null}
      {typeof ListFooterComponent === "function" ? <ListFooterComponent /> : ListFooterComponent}
    </>
  );

  const Separator = useMemo(
    () => ItemSeparatorComponent ?? (gap ? () => <View style={{ height: gap }} /> : undefined),
    [ItemSeparatorComponent, gap],
  );

  return (
    <FlatList
      {...rest}
      data={rows}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={[
        { padding } as StyleProp<ViewStyle>,
        !hasRows && styles.grow,
        contentContainerStyle,
        tabBarSpace > 0 && { paddingBottom: bottomPadding(contentContainerStyle, padding) + tabBarSpace },
      ]}
      ListEmptyComponent={<>{emptyNode}</>}
      ListFooterComponent={footer}
      onEndReached={handleEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              lastRequestedAt.current = -1;
              onRefresh();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surfaceRaised}
          />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  shrink: { flexShrink: 1 },
  footer: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  footerError: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
});

/** The list's own bottom padding (contentContainerStyle, else the `padding` prop), before the tab-bar space. */
function bottomPadding(style: StyleProp<ViewStyle>, padding: number): number {
  const flat = StyleSheet.flatten(style) ?? {};
  const own = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding;
  return typeof own === "number" ? own : padding;
}
