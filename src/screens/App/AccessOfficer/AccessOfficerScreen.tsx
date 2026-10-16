import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  Screen,
  SectionHeader,
  TextField,
  useConfirm,
  useToast,
} from "../../../components/ui";
import { useAuth } from "../../../context/AuthContext";
import type { AccessOfficerStackParamList } from "../../../navigation/accessOfficerTypes";
import {
  accessOfficerActionMessage,
  accessOfficerEnrolMessage,
  accessOfficerErrorView,
  addToRoom,
  checkAoId,
  clampFinger,
  createActionLock,
  enrol,
  formatAoIdInput,
  getMyLocationNames,
  lookupByCnic,
  personIdFor,
  removeAccess,
  removeAccessQuestion,
  restoreAccess,
  switchAoIdMode,
  withUpdatedMatch,
  writeNotice,
  type AoActionKind,
  type AoCardNotice,
  type AoIdMode,
  type AoLookupOutcome,
  type AoMatch,
  type AoWriteResult,
} from "../../../services/accessOfficer";
import { statusOf } from "../../../services/ceo/errors";
import { spacing, useThemeColors } from "../../../theme";
import { haptics } from "../../../utils/haptics";
import { MAX_CONTENT_WIDTH, textScale } from "../../../utils/responsive";
import { CeoErrorState } from "../Ceo/parts";
import { useRefreshColors } from "../Staff/shared/refresh";
import { EnrolSheet, type EnrolFlow } from "./EnrolSheet";
import { MatchCard, PersonCard } from "./MatchCard";

type Nav = NativeStackNavigationProp<AccessOfficerStackParamList, "AccessOfficerAccess">;

/** Card padding + border on each side (dp): Card's default padding 16 and its 1dp border. */
const CARD_INSET = 17;

/** Rough width of a small Button with an icon (14sp label capped at 1.4x, 14dp side padding, 16dp icon + gap). */
function smallButtonWidth(title: string, fontScale: number): number {
  return Math.ceil(title.length * 0.6 * 14 * Math.min(textScale(fontScale), 1.4) + 2 * 14 + 16 + 8);
}

/** The lookup on screen: nothing asked yet, loading, an answer (found / not found) or an error. */
type LookupState =
  | { status: "idle" }
  | { status: "loading"; cnic: string }
  | { status: "done"; cnic: string; outcome: AoLookupOutcome }
  | { status: "error"; cnic: string; error: unknown };

/**
 * The Access Officer's one screen (role "access_officer"): door access by CNIC.
 *
 * One field (CNIC 12345-1234567-1 on the number pad, or a passport number as typed) + Find -> who was found and one
 * card per room they are on or waiting for at the officer's locations (GET api/access-officer/lookup), each with:
 *   pending          Add to room
 *   access on        Enrol face, Enrol fingerprint (finger 1-10), Remove access (confirm first)
 *   access removed   Restore access
 * Every action takes the match's own personId (one CNIC can be on several rooms). Enrolment is off, with the reason,
 * while the room machine is offline or missing. An enrolment waits (the request allows 120 s) for the person at the
 * room machine, then shows each machine's result; Add to room / Remove / Restore leave their outcome on the card (with
 * the machines that were offline or failed). Not found, the 503 "needs the database update AO_01" and other errors are
 * shown in plain words. Pull to refresh runs the last lookup again. Names and the role label come from auth/me; the
 * locations from the API (location/all, narrowed to the officer's). This screen calls nothing else.
 */
export default function AccessOfficerScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useThemeColors();
  const refreshColors = useRefreshColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { roleDisplayLabel } = useAuth();

  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<AoIdMode>("cnic");
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ bookingDetailId: number; kind: AoActionKind } | null>(null);
  const [flow, setFlow] = useState<EnrolFlow | null>(null);
  /** The last write's outcome per room (bookingDetailId), shown on its card until dismissed or a new Find. */
  const [notices, setNotices] = useState<Record<number, AoCardNotice>>({});
  /** One write or enrolment at a time, checked at once (a fast double tap must not start two). */
  const [actionLock] = useState(createActionLock);

  // Answers to an older lookup are ignored (a newer Find or refresh replaced it).
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadLocations = useCallback(() => {
    getMyLocationNames().then((names) => {
      if (alive.current && names.length) setLocations(names);
    });
  }, []);
  useEffect(loadLocations, [loadLocations]);

  /**
   * Looks `cnic` up. "new": a fresh Find (skeleton, old result cleared). "refresh": pull to refresh (spinner, the
   * result kept on failure). "silent": after a write, to show the server's latest state (failures ignored).
   */
  const runLookup = useCallback(
    async (cnic: string, how: "new" | "refresh" | "silent") => {
      const gen = ++generation.current;
      const current = () => alive.current && generation.current === gen;
      if (how === "new") setState({ status: "loading", cnic });
      if (how === "refresh") setRefreshing(true);
      try {
        const outcome = await lookupByCnic(cnic);
        if (current()) setState({ status: "done", cnic, outcome });
      } catch (error) {
        if (!current()) return;
        if (how === "new") setState({ status: "error", cnic, error });
        else if (how === "refresh") {
          setState((prev) => (prev.status === "done" ? prev : { status: "error", cnic, error }));
          toast.error(accessOfficerErrorView(error).message, { title: "Could not refresh" });
        }
      } finally {
        if (how === "refresh" && alive.current) setRefreshing(false);
      }
    },
    [toast],
  );

  const lastCnic = state.status === "idle" ? null : state.cnic;

  const find = () => {
    const check = checkAoId(text, mode);
    if (!check.ok) {
      setFieldError(check.error);
      haptics.error();
      return;
    }
    setFieldError(null);
    setNotices({});
    setText(check.value);
    // A passport number pasted into the CNIC field: say what it is.
    if (check.kind !== mode) setMode(check.kind);
    Keyboard.dismiss();
    runLookup(check.value, "new");
  };

  const onRefresh = () => {
    loadLocations();
    if (lastCnic) runLookup(lastCnic, "refresh");
  };

  const switchMode = () => {
    const next: AoIdMode = mode === "cnic" ? "passport" : "cnic";
    setMode(next);
    setText((t) => switchAoIdMode(t, next));
    setFieldError(null);
    // Let the new keyboard come up.
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ─── Actions ───────────────────────────────────────────────────────────────────────────────────────────

  const outcome = state.status === "done" ? state.outcome : null;
  const lookup = outcome?.found ? outcome.lookup : null;
  const personName = lookup?.person?.name?.trim() ?? "";

  /**
   * Shows a write's answer at once (the updated match, or `patch`; the outcome on the card), then asks the server for
   * the latest state. `enable`: the access change (true restore, false remove), null for Add to room.
   */
  const afterWrite = (match: AoMatch, result: AoWriteResult, patch: Partial<AoMatch>, enable: boolean | null) => {
    setState((prev) => {
      if (prev.status !== "done" || !prev.outcome.found) return prev;
      const next = withUpdatedMatch(prev.outcome.lookup, match.bookingDetailId, result.match ?? patch);
      return { ...prev, outcome: { found: true, lookup: next } };
    });
    const notice = writeNotice(result, match.roomMachine?.name, enable);
    setNotices((prev) => ({ ...prev, [match.bookingDetailId]: notice }));
    if (notice.tone === "success") haptics.success();
    else haptics.warning();
    if (lastCnic) runLookup(lastCnic, "silent");
  };

  const dismissNotice = (bookingDetailId: number) =>
    setNotices((prev) => {
      const next = { ...prev };
      delete next[bookingDetailId];
      return next;
    });

  const run = async (
    match: AoMatch,
    kind: AoActionKind,
    call: () => Promise<AoWriteResult>,
    patch: Partial<AoMatch>,
    enable: boolean | null,
  ) => {
    if (!actionLock.take()) return;
    setBusy({ bookingDetailId: match.bookingDetailId, kind });
    try {
      const result = await call();
      if (alive.current) afterWrite(match, result, patch, enable);
    } catch (error) {
      toast.error(accessOfficerActionMessage(error));
      // Already done / gone: show what the server has now.
      const status = statusOf(error);
      if ((status === 409 || status === 404) && lastCnic) runLookup(lastCnic, "silent");
    } finally {
      actionLock.release();
      if (alive.current) setBusy(null);
    }
  };

  const onAction = (kind: AoActionKind, match: AoMatch) => {
    // Always the match's own person (one CNIC can be on several rooms).
    const personId = personIdFor(match);
    switch (kind) {
      case "addToRoom": {
        const cnic = lookup?.cnic || lastCnic || "";
        run(match, kind, () => addToRoom({ bookingDetailId: match.bookingDetailId, cnic, room: match.room }), { state: "assigned", accessEnabled: true }, null);
        return;
      }
      case "restoreAccess":
        if (personId == null) return;
        run(match, kind, () => restoreAccess({ bookingDetailId: match.bookingDetailId, personId, room: match.room }), { accessEnabled: true }, true);
        return;
      case "removeAccess": {
        if (personId == null) return;
        let result: AoWriteResult | null = null;
        confirm({
          title: "Remove door access?",
          message: removeAccessQuestion(personName, match),
          confirmLabel: "Remove access",
          cancelLabel: "Keep access",
          destructive: true,
          icon: "lock-closed-outline",
          onConfirm: async () => {
            result = await removeAccess({ bookingDetailId: match.bookingDetailId, personId, room: match.room });
          },
        }).then(
          (ok) => {
            if (!ok || !result || !alive.current) return;
            afterWrite(match, result, { accessEnabled: false }, false);
          },
          (error) => {
            toast.error(accessOfficerActionMessage(error));
            const status = statusOf(error);
            if ((status === 409 || status === 404) && lastCnic) runLookup(lastCnic, "silent");
          },
        );
        return;
      }
      case "enrolFace":
      case "enrolFingerprint":
        if (personId == null) return;
        setFlow({
          kind: kind === "enrolFace" ? "face" : "fingerprint",
          match,
          personId,
          name: personName,
          fingerNo: 1,
          phase: "ready",
        });
        return;
    }
  };

  // ─── Enrolment ─────────────────────────────────────────────────────────────────────────────────────────

  const startEnrol = async () => {
    if (!flow || flow.phase !== "ready") return;
    // `flow` is this render's: a second tap before the re-render still sees "ready". The lock is taken at once.
    if (!actionLock.take()) return;
    const started: EnrolFlow = { ...flow, phase: "waiting", startedAt: Date.now(), result: undefined, error: undefined };
    setFlow(started);
    try {
      const result = await enrol({
        kind: started.kind,
        bookingDetailId: started.match.bookingDetailId,
        personId: started.personId,
        fingerNo: started.fingerNo,
      });
      if (!alive.current) return;
      if (result.ok) haptics.success();
      else haptics.error();
      setFlow({ ...started, phase: "done", result });
    } catch (error) {
      if (!alive.current) return;
      haptics.error();
      setFlow({ ...started, phase: "done", error: accessOfficerEnrolMessage(error) });
    } finally {
      actionLock.release();
    }
    // Enrolled chips (and anything else) as the server has them now.
    if (lastCnic) runLookup(lastCnic, "silent");
  };

  const closeFlow = () => setFlow((f) => (f?.phase === "waiting" ? f : null));

  // ─── Render ────────────────────────────────────────────────────────────────────────────────────────────

  const locked = busy != null || flow?.phase === "waiting";
  const openProfile = () => navigation.navigate("AccessOfficerProfile", { locations });
  const isCnic = mode === "cnic";
  // The CNIC / passport switch: its full label when it fits the card (one line), else the short one (320dp phone,
  // Fold cover screen, large text).
  const { width, fontScale } = useWindowDimensions();
  const cardInner = Math.min(width, MAX_CONTENT_WIDTH) - 2 * spacing.screen - 2 * CARD_INSET;
  const switchFull = isCnic ? "Use a passport number instead" : "Use a CNIC instead";
  const switchLabel = smallButtonWidth(switchFull, fontScale) <= cardInner ? switchFull : isCnic ? "Use a passport" : "Use a CNIC";

  return (
    <Screen>
      <AppHeader
        variant="dashboard"
        overline={roleDisplayLabel}
        title="Door access"
        subtitle="Enrol or remove door access by CNIC"
        actions={[{ icon: "person-circle-outline", accessibilityLabel: "Profile", onPress: openProfile }]}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...refreshColors} />}
        >
          {locations.length ? (
            <View style={styles.locations} accessible accessibilityLabel={`Your locations: ${locations.join(", ")}`}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <AppText variant="bodySmall" color="textMuted" style={styles.flex}>
                {locations.join(", ")}
              </AppText>
            </View>
          ) : null}

          <Card>
            <View style={styles.search}>
              <TextField
                ref={inputRef}
                label={isCnic ? "CNIC" : "Passport number"}
                value={text}
                onChangeText={(t) => {
                  setText(formatAoIdInput(t, mode));
                  if (fieldError) setFieldError(null);
                }}
                placeholder={isCnic ? "12345-1234567-1" : "AB1234567"}
                keyboardType={isCnic ? "number-pad" : "default"}
                autoCapitalize={isCnic ? "none" : "characters"}
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="search"
                onSubmitEditing={find}
                leftIcon="id-card-outline"
                error={fieldError ?? undefined}
                helperText={isCnic ? "13 digits; the dashes are added for you." : "As printed on the passport."}
              />
              <Button title="Find" leftIcon="search" onPress={find} loading={state.status === "loading"} fullWidth />
              <Button
                title={switchLabel}
                variant="ghost"
                size="sm"
                leftIcon={isCnic ? "document-text-outline" : "id-card-outline"}
                onPress={switchMode}
                accessibilityLabel={switchFull}
                textStyle={styles.shrink}
              />
            </View>
          </Card>

          <Results
            state={state}
            notices={notices}
            onDismissNotice={dismissNotice}
            busy={busy}
            locked={locked}
            onAction={onAction}
            onRetry={() => lastCnic && runLookup(lastCnic, "new")}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <EnrolSheet
        flow={flow}
        onClose={closeFlow}
        onFingerChange={(n) => setFlow((f) => (f && f.phase === "ready" ? { ...f, fingerNo: clampFinger(n) } : f))}
        onStart={startEnrol}
        onRetry={() => setFlow((f) => (f ? { ...f, phase: "ready", result: undefined, error: undefined, startedAt: undefined } : f))}
      />
    </Screen>
  );
}

function Results({
  state,
  notices,
  onDismissNotice,
  busy,
  locked,
  onAction,
  onRetry,
}: {
  state: LookupState;
  notices: Record<number, AoCardNotice>;
  onDismissNotice: (bookingDetailId: number) => void;
  busy: { bookingDetailId: number; kind: AoActionKind } | null;
  locked: boolean;
  onAction: (kind: AoActionKind, match: AoMatch) => void;
  onRetry: () => void;
}) {
  if (state.status === "idle") {
    return (
      <EmptyState
        illustration="door"
        title="Find a person by CNIC"
        message="Type the CNIC of someone a customer has added to a confirmed booking at your locations, then press Find."
      />
    );
  }
  if (state.status === "loading") return <ListSkeleton rows={2} />;
  if (state.status === "error") {
    return <CeoErrorState error={state.error} onRetry={onRetry} describe={(e) => accessOfficerErrorView(e)} />;
  }
  const { outcome } = state;
  if (!outcome.found) {
    return (
      <Card>
        <EmptyState compact illustration="search" title={`No match for ${outcome.cnic}`} message={outcome.message} />
      </Card>
    );
  }
  const { lookup } = outcome;
  const count = lookup.matches.length;
  return (
    <View style={styles.results}>
      <PersonCard person={lookup.person} cnic={lookup.cnic} />
      <SectionHeader
        title={count === 1 ? "Room" : `Rooms (${count})`}
        subtitle={count === 1 ? undefined : "Each room has its own door access."}
      />
      {lookup.matches.map((match) => (
        <MatchCard
          key={match.bookingDetailId}
          match={match}
          notice={notices[match.bookingDetailId] ?? null}
          onDismissNotice={() => onDismissNotice(match.bookingDetailId)}
          busy={busy?.bookingDetailId === match.bookingDetailId ? busy.kind : null}
          locked={locked && busy?.bookingDetailId !== match.bookingDetailId}
          onAction={onAction}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // A button label that ends in "..." instead of being cut at both sides if it is still too long.
  shrink: { flexShrink: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: spacing.xxxl },
  locations: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  search: { gap: spacing.sm },
  results: { gap: spacing.md },
});
