import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { AppHeader, AppText, AsyncList, Card, FilterChips, SelectField, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import {
  getAllSpaces,
  isSpaceBooked,
  spaceInGroup,
  spaceMonthlyPrice,
  type SpaceGroup,
  type StaffSpace,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney } from "../../../../utils/format";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useDebounced, usePagedList } from "../shared/hooks";

type Route = RouteProp<StaffStackParamList, "Spaces">;
type GroupFilter = SpaceGroup | "all";

/** Spaces, read-only (GET space?limit=1000, filtered on the device like the CMS): location, type, status. */
export default function SpaceListScreen() {
  const { params } = useRoute<Route>();
  const { locations, locationsLoading } = useStaffSession();
  const [locationId, setLocationId] = useState<number>(params?.locationId ?? 0);
  const [group, setGroup] = useState<GroupFilter>("all");
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim().toLowerCase(), 200);

  const fetchPage = useCallback(async () => {
    const items = await getAllSpaces();
    return { items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }, []);
  const list = usePagedList<StaffSpace>(fetchPage);

  const rows = useMemo(
    () =>
      list.items.filter(
        (s) =>
          (!locationId || s.locationId === locationId) &&
          (group === "all" || spaceInGroup(s, group)) &&
          (!search || s.name.toLowerCase().includes(search) || (s.code ?? "").toLowerCase().includes(search)),
      ),
    [list.items, locationId, group, search],
  );
  const booked = rows.filter(isSpaceBooked).length;

  return (
    <StaffScreen>
      <AppHeader title="Spaces" subtitle={list.items.length ? `${rows.length} shown · ${booked} booked` : undefined} />
      <View style={styles.filters}>
        <SelectField
          label="Location"
          value={locationId}
          options={[{ label: "All locations", value: 0 }, ...locations.map((l) => ({ label: l.name, value: l.id }))]}
          onChange={setLocationId}
          loading={locationsLoading}
          leftIcon="location-outline"
        />
        <FilterChips
          value={group}
          onChange={setGroup}
          options={[
            { label: "All", value: "all" },
            { label: "Private", value: "private" },
            { label: "Shared", value: "shared" },
            { label: "Meeting", value: "meeting" },
          ]}
          accessibilityLabel="Space type"
          style={styles.chipBar}
        />
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name or code" />
      <AsyncList
        key={list.listKey}
        data={rows}
        keyExtractor={(s) => String(s.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ icon: "business-outline", title: "No spaces found" }}
        renderItem={({ item: s }) => (
          <Card padding={12}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {[s.name, s.code].filter(Boolean).join(" · ")}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {[s.spaceTypeName, s.locationName, s.floor, s.capacity ? `${s.capacity} seats` : null].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              <View style={styles.right}>
                <StatusPill status={isSpaceBooked(s) ? "Booked" : "Available"} />
                {spaceMonthlyPrice(s) ? (
                  <AppText variant="caption" color="textMuted">
                    {formatMoney(spaceMonthlyPrice(s))}
                  </AppText>
                ) : null}
              </View>
            </View>
            {isSpaceBooked(s) && s.bookedTill ? (
              <AppText variant="caption" color="textMuted" style={styles.gapTop}>
                Booked till {formatDate(s.bookedTill)}
              </AppText>
            ) : null}
          </Card>
        )}
      />
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.sm },
  chipBar: { flexGrow: 0, flexShrink: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  right: { alignItems: "flex-end", gap: 4 },
  gapTop: { marginTop: spacing.xs },
});
