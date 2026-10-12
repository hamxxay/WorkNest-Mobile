import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AsyncList, Card, ListRow, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { getLocations } from "../../../../services/staff";
import { StaffScreen } from "../shared/StaffScreen";
import { usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;

/** Locations, read-only (GET location): admins see their own, super admins every location. */
export default function LocationListScreen() {
  const navigation = useNavigation<Nav>();
  const fetchPage = useCallback(async () => {
    const items = await getLocations();
    return { items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }, []);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader title="Locations" subtitle={list.total ? `${list.total} locations` : undefined} />
      <AsyncList
        data={list.items}
        keyExtractor={(l) => String(l.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        gap={8}
        empty={{ illustration: "building", title: "No locations" }}
        renderItem={({ item }) => (
          <Card padding={0}>
            <ListRow
              leftIcon="location-outline"
              title={item.name}
              subtitle={[item.address, item.cityName, item.openingTime && item.closingTime ? `${item.openingTime} - ${item.closingTime}` : null]
                .filter(Boolean)
                .join(" · ")}
              right={item.isActive ? undefined : <StatusPill status="Inactive" />}
              onPress={() => navigation.navigate("Spaces", { locationId: item.id })}
              accessibilityHint="Shows the spaces at this location"
            />
          </Card>
        )}
      />
    </StaffScreen>
  );
}
