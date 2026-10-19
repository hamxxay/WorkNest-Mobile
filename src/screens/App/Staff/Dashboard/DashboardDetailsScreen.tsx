import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, Card, EmptyState, ListRow, ListSkeleton } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { getOverviewDetails } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { Breadcrumb, CeoErrorState, StaleBanner, useCeoQuery } from "../../Ceo/parts";
import { RecordCard } from "../../Ceo/RecordsView";
import { StaffScreen } from "../shared/StaffScreen";
import { useRefreshColors } from "../shared/refresh";
import { detailCards, detailsTotalsLine, overviewDetailsErrorView, relatedTarget, type DetailCard, type DetailTarget } from "./drill";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "DashboardDetails">;

/**
 * Dashboard chart drill-down (GET dashboard/overview-details/{kind}): the invoices, bookings or spaces behind one
 * bar / slice / point of the overview, with the totals line as the chart counts them (the API sends at most 200
 * rows; spaces 500). Same period and locations as the dashboard. An invoice opens the invoice; a booking or a
 * booked space opens the booking. Before the database update DASH_02 the API's own message is shown.
 */
export default function DashboardDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { request, scope, trail, scopeLabel, title, related } = params;
  const refreshColors = useRefreshColors();
  const load = useCallback(() => getOverviewDetails(request, scope), [request, scope]);
  const q = useCeoQuery(load);
  const d = q.data;
  const cards = useMemo(() => (d ? detailCards(d) : []), [d]);
  const link = relatedTarget(request, trail, d, !!related);

  const open = useCallback(
    (target: DetailTarget) => {
      if (target.route === "BookingDetail") navigation.navigate("BookingDetail", { bookingId: target.bookingId });
      else navigation.navigate("InvoiceDetail", { invoiceId: target.invoiceId });
    },
    [navigation],
  );

  const header = (
    <View style={styles.header}>
      <Breadcrumb trail={trail} scopeLabel={scopeLabel} />
      {d ? (
        <AppText variant="captionStrong" color="textSecondary" accessibilityLiveRegion="polite">
          {detailsTotalsLine(request.kind, d)}
        </AppText>
      ) : null}
      {d && q.error && !q.refreshing ? <StaleBanner error={q.error} describe={overviewDetailsErrorView} what="The list below is" /> : null}
      {link ? (
        <Card padding={0}>
          <ListRow
            leftIcon="swap-horizontal-outline"
            title={link.label}
            accessibilityHint="Opens that list"
            onPress={() =>
              navigation.push("DashboardDetails", { request: link.request, scope, trail: link.trail, scopeLabel, title: link.title, related: true })
            }
          />
        </Card>
      ) : null}
    </View>
  );

  const empty = q.loading ? (
    <ListSkeleton rows={5} avatar={false} />
  ) : q.error && !d ? (
    <CeoErrorState error={q.error} onRetry={q.reload} describe={overviewDetailsErrorView} />
  ) : (
    <Card>
      <EmptyState compact illustration="inbox" title="Nothing to show" message="There are no records for this choice." />
    </Card>
  );

  const renderItem = useCallback(
    ({ item }: { item: DetailCard }) => {
      const target = item.target;
      return <RecordCard item={item} onPress={target ? () => open(target) : undefined} accessibilityHint={item.hint} />;
    },
    [open],
  );

  return (
    <StaffScreen>
      <AppHeader title={d?.title || title || "Records"} />
      <FlatList
        data={cards}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} {...refreshColors} />}
        initialNumToRender={8}
        windowSize={7}
      />
    </StaffScreen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, paddingBottom: spacing.xxxl, flexGrow: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  separator: { height: spacing.md },
});
