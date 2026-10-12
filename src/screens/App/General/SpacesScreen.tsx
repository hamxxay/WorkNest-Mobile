import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AsyncList,
  FilterChips,
  Screen,
  SelectField,
  TextField,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { errorMessage } from "../../../services/apiClient";
import { getWorkspaces, type Workspace } from "../../../services/workspaceService";
import { WorkspaceCard } from "../../Home/WorkspaceCard";
import type { AppStackParamList, SpaceTypeFilter } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

const TYPE_OPTIONS: { label: string; value: SpaceTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Private office", value: "office" },
  { label: "Shared desk", value: "shared" },
  { label: "Meeting room", value: "meeting" },
];

const ALL_LOCATIONS = "__all__";

function matchesType(ws: Workspace, type: SpaceTypeFilter): boolean {
  if (type === "all") return true;
  if (type === "meeting") return ws.type === "Meeting Room";
  if (type === "shared") return ws.type === "Co-Working Space";
  return ws.type === "Private Office" || ws.type === "Event Space";
}

/** All spaces open for booking (GET /space/available) with search, type and location filters. */
export default function SpacesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "Spaces">>();
  const styles = useThemedStyles(createStyles);

  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(route.params?.initialSearch ?? "");
  const [type, setType] = useState<SpaceTypeFilter>(route.params?.initialType ?? "all");
  const [location, setLocation] = useState<string>(ALL_LOCATIONS);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError("");
    try {
      setSpaces(await getWorkspaces());
    } catch (err) {
      setError(errorMessage(err, "Spaces could not be loaded. Please try again."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locations = useMemo(
    () => Array.from(new Set(spaces.map((s) => s.location).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [spaces],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spaces.filter(
      (ws) =>
        matchesType(ws, type) &&
        (location === ALL_LOCATIONS || ws.location === location) &&
        (!q || `${ws.name} ${ws.type} ${ws.location}`.toLowerCase().includes(q)),
    );
  }, [spaces, query, type, location]);

  const filtersActive = !!query.trim() || type !== "all" || location !== ALL_LOCATIONS;

  return (
    <Screen>
      <AppHeader title="Book a space" subtitle="Spaces open for booking now" />
      <AsyncList
        data={filtered}
        keyExtractor={(ws) => `${ws.id}-${ws.location}-${ws.type}`}
        renderItem={({ item }) => (
          <WorkspaceCard workspace={item} onPress={() => navigation.navigate("SpaceDetail", { workspace: item })} />
        )}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        error={error}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.filters}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, type or location"
              leftIcon="search-outline"
              returnKeyType="search"
              accessibilityLabel="Search spaces"
              rightIcon={query ? "close-circle" : undefined}
              rightIconLabel="Clear search"
              onRightIconPress={() => setQuery("")}
            />
            <FilterChips value={type} onChange={setType} options={TYPE_OPTIONS} accessibilityLabel="Space type" />
            {locations.length > 1 ? (
              <SelectField
                label="Location"
                value={location}
                onChange={setLocation}
                leftIcon="location-outline"
                options={[
                  { label: "All locations", value: ALL_LOCATIONS },
                  ...locations.map((l) => ({ label: l, value: l })),
                ]}
              />
            ) : null}
          </View>
        }
        empty={
          filtersActive
            ? {
                icon: "search-outline",
                title: "No spaces match",
                message: "Try another type or location, or clear the search.",
                actionLabel: "Clear filters",
                onAction: () => {
                  setQuery("");
                  setType("all");
                  setLocation(ALL_LOCATIONS);
                },
              }
            : {
                icon: "business-outline",
                title: "No spaces open right now",
                message: "Book a tour and our team will show you what fits.",
                actionLabel: "Book a tour",
                onAction: () => navigation.navigate("BookTour"),
              }
        }
      />
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    filters: { gap: t.spacing.md, marginBottom: t.spacing.md },
  });
