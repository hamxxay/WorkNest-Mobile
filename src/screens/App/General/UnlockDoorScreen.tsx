import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SuccessCheck,
} from "../../../components/ui";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import {
  getDoorAccess,
  getDoors,
  isDoorRefusal,
  notifyDoorAccessChanged,
  unlockDoor,
  type DoorAccess,
  type DoorInfo,
} from "../../../services/doorAccessService";
import { errorMessage } from "../../../services/apiClient";
import { haptics } from "../../../utils/haptics";
import { ScrollableState } from "./shared/ScrollableState";
import { stackSideAction, useContentWidth } from "./shared/layout";

type Status = { kind: "ok" | "error"; text: string } | null;

/** Icon well (44) and the two row gaps (12 + 12): the part of a door row without text. */
const DOOR_ROW_RESERVED = 44 + 12 + 12;

/**
 * Unlock Door: opens the verified access user's room door only (entrances use card, fingerprint or face).
 * Tapping Unlock asks the API to open it on the machine; the result shows under the door.
 * When the server refuses (access turned off, suspended for an unpaid bill, booking ended) its own message is shown
 * without a retry, and the door buttons elsewhere in the app re-check access (notifyDoorAccessChanged).
 */
export default function UnlockDoorScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { fontScale } = useWindowDimensions();
  // Inside the card (16dp padding each side). On a narrow phone, the Fold cover screen or with large text the
  // Unlock button gets its own full-width line under the door name instead of squeezing it.
  const unlockBelow = stackSideAction(useContentWidth() - 2 * 16, DOOR_ROW_RESERVED, "Unlock", fontScale, true);
  const [access, setAccess] = useState<DoorAccess | null>(null);
  const [doors, setDoors] = useState<DoorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The server's refusal (no retry offered: trying again would not change its answer). */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [status, setStatus] = useState<Record<number, Status>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRefusal(null);
    setNeedsVerification(false);
    try {
      const current = typeof user?.email === "string" ? await getDoorAccess(user.email) : null;
      setAccess(current);
      if (!current?.canOpenDoor || !current.selectedSpace) {
        setDoors([]);
        setNeedsVerification(true);
        return;
      }
      const result = await getDoors(current);
      setDoors(result.doors ?? []);
      if (!result.doors?.length) setRefusal(result.message || "No door machine is set up for your room yet. Please contact reception.");
    } catch (err) {
      setDoors([]);
      if (isDoorRefusal(err)) {
        setRefusal(errorMessage(err, "Door access is not available right now. Please contact reception."));
        notifyDoorAccessChanged();
      } else {
        setError(errorMessage(err, "Could not load your doors. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onUnlock = async (door: DoorInfo) => {
    if (!access || unlocking !== null) return;
    setUnlocking(door.deviceId);
    setStatus((prev) => ({ ...prev, [door.deviceId]: null }));
    haptics.medium();
    try {
      const message = await unlockDoor(access, door.deviceId);
      setStatus((prev) => ({ ...prev, [door.deviceId]: { kind: "ok", text: message } }));
      haptics.success();
    } catch (err) {
      haptics.error();
      if (isDoorRefusal(err)) {
        // Access changed since the screen loaded (turned off, suspended, ended): show why, no retry.
        notifyDoorAccessChanged();
        setRefusal(errorMessage(err, "Door access is not available right now. Please contact reception."));
        return;
      }
      setStatus((prev) => ({
        ...prev,
        [door.deviceId]: { kind: "error", text: errorMessage(err, "The door did not unlock. Please try again.") },
      }));
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <Screen>
      <AppHeader title="Unlock door" subtitle={access?.selectedSpace?.spaceName ? `Room: ${access.selectedSpace.spaceName}` : undefined} />
      {loading ? (
        <LoadingState message="Loading your doors" />
      ) : needsVerification ? (
        <ScrollableState>
          <EmptyState
            illustration="door"
            title="Verify your access first"
            message="Confirm your details once (Access Request) and you can unlock your room door from the app."
            actionLabel="Access request"
            onAction={() => navigation.navigate("AccessRequest")}
          />
        </ScrollableState>
      ) : refusal ? (
        <ScrollableState>
          <EmptyState
            illustration="door"
            title="Door can't be unlocked from the app"
            message={refusal}
            actionLabel="Contact us"
            onAction={() => navigation.navigate("ContactUs")}
          />
        </ScrollableState>
      ) : error ? (
        <ScrollableState>
          <ErrorState message={error} onRetry={load} />
        </ScrollableState>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {doors.map((door) => {
            const s = status[door.deviceId];
            const unlockButton = (
              <Button
                title="Unlock"
                size={unlockBelow ? "md" : "sm"}
                fullWidth={unlockBelow}
                leftIcon="lock-open-outline"
                accessibilityLabel={`Unlock ${door.name}`}
                loading={unlocking === door.deviceId}
                disabled={unlocking !== null}
                onPress={() => onUnlock(door)}
                style={unlockBelow ? styles.unlockBelow : undefined}
              />
            );
            return (
              <Card key={door.deviceId}>
                <View style={styles.doorRow}>
                  <View style={styles.iconWell}>
                    <Ionicons name={door.kind === "room" ? "business-outline" : "enter-outline"} size={22} color={colors.onPrimarySoft} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="subheading">{door.name}</AppText>
                    <AppText variant="caption" color="textMuted">
                      Your room door{door.online ? "" : ". May be offline"}
                    </AppText>
                  </View>
                  {unlockBelow ? null : unlockButton}
                </View>
                {unlockBelow ? unlockButton : null}
                {s?.kind === "ok" ? (
                  <View style={[styles.status, styles.okRow]}>
                    <SuccessCheck size={24} accessibilityLabel={null} />
                    <AppText variant="bodySmall" color="success" style={styles.flex} accessibilityLiveRegion="polite">
                      {s.text}
                    </AppText>
                  </View>
                ) : s ? (
                  <AppText variant="bodySmall" color="danger" style={styles.status} accessibilityLiveRegion="polite">
                    {s.text}
                  </AppText>
                ) : null}
              </Card>
            );
          })}
          <AppText variant="caption" color="textMuted" align="center">
            The app unlocks your room door only. Use your card, fingerprint or face at the building entrances. Every unlock
            is recorded with your name.
          </AppText>
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.md, paddingBottom: t.spacing.xxl },
    doorRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    iconWell: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" },
    flex: { flex: 1 },
    status: { marginTop: t.spacing.sm },
    unlockBelow: { marginTop: t.spacing.md },
    okRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  });
