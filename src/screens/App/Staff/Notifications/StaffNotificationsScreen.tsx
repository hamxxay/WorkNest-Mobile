import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Badge, Button, Card, Divider, EmptyState, ListRow, useToast } from "../../../../components/ui";
import { NAV_BADGE_ROUTES, moreMenuFor } from "../../../../navigation/staff/access";
import type { StaffRouteName, StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import { spacing, useThemeColors } from "../../../../theme";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** What each waiting count means (CMS sidebar badges, DashboardService.GetNavBadgesAsync). */
const MEANING: Partial<Record<StaffRouteName, string>> = {
  TourInquiries: "New tour inquiries and follow-ups due",
  BookingList: "Bookings waiting for confirmation",
  QuotationList: "Quotations accepted or declined by customers",
  AgreementList: "Signed copies to verify or emails that failed",
  KycList: "Customers with KYC documents to review",
  InvoiceList: "Invoices past their due date",
  Attendants: "Door access suspended (and capacity requests for admins)",
  Complaints: "Open complaints",
  AccessActivity: "Door machines offline",
};

/**
 * Staff notifications: everything waiting on you, from GET admin/nav-badges (the CMS sidebar counts), each
 * opening its screen; "Mark all as read" (POST admin/nav-badges/read) clears the counts on every device.
 * The announcement inbox (GET mobile/announcements) is for customers, so it is not shown here.
 */
export default function StaffNotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const colors = useThemeColors();
  const { role, badges, navBadges, pendingApprovals, refreshBadges, markBadgesRead } = useStaffSession();
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const labels = useMemo(() => {
    const map = new Map<StaffRouteName, { label: string; icon: string }>();
    moreMenuFor(role).forEach((s) => s.items.forEach((i) => map.set(i.route, { label: i.label, icon: i.icon })));
    return map;
  }, [role]);

  const rows = (Object.entries(badges) as [StaffRouteName, number][]).filter(([, n]) => n > 0);
  const approvals = role === "admin" || role === "super_admin" ? pendingApprovals : 0;
  const markable = Object.entries(navBadges)
    .filter(([cms, n]) => n > 0 && NAV_BADGE_ROUTES[cms])
    .map(([cms]) => cms);

  const refresh = () => {
    setRefreshing(true);
    refreshBadges();
    setTimeout(() => setRefreshing(false), 600);
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await markBadgesRead(markable);
      toast.success("Marked as read.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not mark as read."));
    } finally {
      setMarking(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title="Notifications" subtitle="Waiting on you" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {rows.length === 0 && approvals === 0 ? (
          <EmptyState icon="notifications-off-outline" title="You're all caught up" message="New inquiries, bookings to confirm and other items show up here." />
        ) : (
          <>
            <Card padding={0}>
              {approvals > 0 ? (
                <ListRow
                  leftIcon="checkmark-done-circle-outline"
                  title="Capacity requests"
                  subtitle="Sales executives asking to add people to full rooms"
                  right={<Badge count={approvals} />}
                  onPress={() => navigation.navigate("StaffTabs", { screen: "Approvals" })}
                />
              ) : null}
              {rows.map(([route, count], i) => {
                const meta = labels.get(route);
                return (
                  <ListRowWithDivider
                    key={route}
                    divider={i > 0 || approvals > 0}
                    icon={meta?.icon ?? "ellipse-outline"}
                    title={meta?.label ?? route}
                    subtitle={MEANING[route]}
                    count={count}
                    onPress={() => navigation.navigate(route as never)}
                  />
                );
              })}
            </Card>
            {markable.length ? (
              <Button title="Mark all as read" variant="outline" leftIcon="checkmark-done-outline" onPress={markAll} loading={marking} fullWidth />
            ) : null}
          </>
        )}
      </ScrollView>
    </StaffScreen>
  );
}

function ListRowWithDivider({
  divider,
  icon,
  title,
  subtitle,
  count,
  onPress,
}: {
  divider: boolean;
  icon: string;
  title: string;
  subtitle?: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <>
      {divider ? <Divider inset={68} /> : null}
      <ListRow leftIcon={icon} title={title} subtitle={subtitle} right={<Badge count={count} />} onPress={onPress} accessibilityLabel={`${title}, ${count} waiting`} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
});
