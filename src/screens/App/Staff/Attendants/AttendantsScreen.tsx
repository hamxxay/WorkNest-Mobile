import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AppText, AsyncList, Card, EmptyState, FilterChips, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import { getCustomer, getCustomerBookedSpaces, isCurrentBookedSpace, type BookedSpace, type StaffCustomer } from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDateRange } from "../../../../utils/format";
import { CustomerPickerField } from "../shared/CustomerPickerField";
import { StaffScreen } from "../shared/StaffScreen";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "Attendants">;

/**
 * Attendants & Access: pick a customer, then one of their booked spaces (GET customers/{id}/active-spaces) to
 * manage the people with door access in it. Coming back from a room reloads quietly, so the seat counts are current.
 */
export default function AttendantsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [customer, setCustomer] = useState<StaffCustomer | null>(null);
  const [spaces, setSpaces] = useState<BookedSpace[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"current" | "all">("current");

  useEffect(() => {
    if (!params?.customerId) return;
    getCustomer(params.customerId)
      .then(setCustomer)
      .catch((err) => setError(errorMessage(err)));
  }, [params?.customerId]);

  const generation = useRef(0);
  const load = useCallback(
    async (mode: "initial" | "refresh" | "quiet") => {
      if (!customer) return;
      // A quick switch to another customer must not show the previous customer's rooms.
      const gen = ++generation.current;
      if (mode === "initial") setLoading(true);
      else if (mode === "refresh") setRefreshing(true);
      if (mode !== "quiet") setError(null);
      try {
        const rows = await getCustomerBookedSpaces(customer.id);
        if (gen === generation.current) {
          setSpaces(rows);
          setError(null);
        }
      } catch (err) {
        // A quiet reload (back from a room) keeps the rows already shown when it fails.
        if (gen === generation.current && mode !== "quiet") setError(errorMessage(err, "Could not load the booked spaces."));
      } finally {
        if (gen === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [customer],
  );

  useEffect(() => {
    setSpaces([]);
    load("initial");
  }, [load]);

  // Back from a room (people added / removed): reload quietly so "x / y seats" is current. Skips the first focus
  // (the effect above loads then); the latest load is read from a ref so a customer change doesn't fire twice.
  const loadRef = useRef(load);
  loadRef.current = load;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      loadRef.current("quiet");
    }, []),
  );

  const current = useMemo(() => spaces.filter((s) => isCurrentBookedSpace(s)), [spaces]);
  // The API now lists current rooms only: the Current / All choice shows only when it would change the list.
  const hasPast = current.length < spaces.length;
  const rows = show === "current" || !hasPast ? current : spaces;

  return (
    <StaffScreen>
      <AppHeader title="Attendants & access" subtitle={customer?.fullName} />
      <View style={styles.top}>
        <CustomerPickerField required value={customer} onChange={setCustomer} />
        {customer && hasPast ? (
          <FilterChips
            value={show}
            onChange={setShow}
            options={[
              { label: "Current", value: "current", count: current.length },
              { label: "All bookings", value: "all", count: spaces.length },
            ]}
            accessibilityLabel="Booked spaces to show"
          />
        ) : null}
      </View>
      {!customer ? (
        <EmptyState illustration="people" title="Choose a customer" message="See the rooms they have booked and who can open the doors." />
      ) : (
        <AsyncList
          data={rows}
          keyExtractor={(s) => String(s.bookingDetailId)}
          loading={loading}
          refreshing={refreshing}
          onRefresh={() => load("refresh")}
          error={error}
          gap={8}
          empty={{ illustration: "building", title: show === "current" || !hasPast ? "No current bookings" : "No bookings", message: "This customer has no booked space to give access to." }}
          renderItem={({ item }) => {
            const full = item.activeAttendantsCount >= item.capacity;
            return (
              <Card
                onPress={() =>
                  navigation.navigate("RoomAccess", { bookingDetailId: item.bookingDetailId, customerId: customer.id, spaceName: item.spaceName })
                }
                accessibilityLabel={`${item.spaceName}, ${item.activeAttendantsCount} of ${item.capacity} seats`}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {[item.spaceName, item.spaceCode].filter(Boolean).join(" · ")}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {[item.spaceCategory, formatDateRange(item.startDateTime, item.endDateTime)].join(" · ")}
                    </AppText>
                  </View>
                  <StatusPill tone={full ? "warning" : "success"} label={`${item.activeAttendantsCount} / ${item.capacity} seats`} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
