import { Fragment } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, Badge, Card, Divider, ListRow, SectionHeader } from "../../../components/ui";
import { useTabBarSpace } from "../../../components/ui/TabBar";
import { useAuth } from "../../../context/AuthContext";
import { roleLabel } from "../../../context/roles";
import { moreMenuFor } from "../../../navigation/staff/access";
import type { StaffStackParamList } from "../../../navigation/staffTypes";
import { spacing } from "../../../theme";
import { StaffScreen, useInTabs } from "./shared/StaffScreen";
import { useStaffSession } from "./shared/StaffSession";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** "More" tab: every other screen the role may open, grouped like the CMS sidebar, with waiting counts. */
export default function StaffMoreScreen() {
  const inTabs = useInTabs();
  const tabBarSpace = useTabBarSpace();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { role, badges, badgeTotal, profile } = useStaffSession();
  const sections = moreMenuFor(role);
  const name = profile?.name || (typeof user?.name === "string" ? user.name : "") || user?.email || "Staff";

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="More"
        actions={[
          {
            icon: "notifications-outline",
            accessibilityLabel: badgeTotal ? `Notifications, ${badgeTotal} waiting` : "Notifications",
            badge: badgeTotal,
            onPress: () => navigation.navigate("StaffNotifications"),
          },
        ]}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: styles.content.paddingBottom + tabBarSpace }]}>
        <Card padding={0}>
          <ListRow
            avatar={{ name }}
            title={name}
            subtitle={`${roleLabel(role)}${profile?.email ? ` · ${profile.email}` : ""}`}
            onPress={() => navigation.navigate("StaffProfile")}
            accessibilityLabel={`${name}, ${roleLabel(role)}. Open profile`}
          />
        </Card>
        {sections
          .map((section) => ({ ...section, items: section.items.filter((i) => i.route !== "StaffProfile") }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <View key={section.title} style={styles.section}>
              <SectionHeader title={section.title} variant="overline" />
              <Card padding={0}>
                {section.items.map((item, index) => {
                  const count = badges[item.route] ?? 0;
                  return (
                    <Fragment key={item.route}>
                      {index > 0 ? <Divider inset={68} /> : null}
                      <ListRow
                        leftIcon={item.icon}
                        title={item.label}
                        right={count > 0 ? <Badge count={count} accessibilityLabel={`${count} waiting`} /> : undefined}
                        onPress={() => navigation.navigate(item.route as never)}
                        accessibilityLabel={count > 0 ? `${item.label}, ${count} waiting` : item.label}
                      />
                    </Fragment>
                  );
                })}
              </Card>
            </View>
          ))}
      </ScrollView>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
});
