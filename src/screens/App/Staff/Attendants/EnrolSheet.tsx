import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Banner, BottomSheet, Button, Chip, SegmentedControl, TextField } from "../../../../components/ui";
import { ENROL_WAIT_NOTE, FINGER_NUMBERS, machineLines, type AoMachineVerbs } from "../../../../services/accessOfficer";
import {
  STAFF_ENROL_TITLES,
  staffEnrolPrompt,
  staffEnrolSummary,
  type StaffEnrolKind,
  type StaffEnrolResult,
} from "../../../../services/staff";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../../theme";

// Fingerprint / face / card enrolment for one person of a booked room (staff app; same steps as the Access Officer
// sheet, plus cards):
//   ready    what to ask the person (finger 1-10 for a fingerprint; tap or type the number for a card), then Start
//   waiting  the request is open (up to ~90 s) while the room machine waits: the instruction and the seconds so
//            far; the sheet cannot be closed
//   done     the outcome and one line per machine (room machine captured, entrances copied / queued / failed)

export type StaffEnrolFlow = {
  kind: StaffEnrolKind;
  personId: number;
  /** The person's name ("" when unknown). */
  name: string;
  /** The booked room, e.g. "Office 329". */
  roomName: string;
  /** The room machine's name when the server told it. */
  machineName: string | null;
  fingerNo: number;
  /** Card: wait for a tap on the room machine's reader, or save a typed card number. */
  cardMode: "tap" | "type";
  cardNo: string;
  phase: "ready" | "waiting" | "done";
  startedAt?: number;
  result?: StaffEnrolResult;
  /** done: the call failed without an answer. */
  error?: string;
  /** ready: a problem with what was typed (card number). */
  inputError?: string | null;
};

export type StaffEnrolSheetProps = {
  flow: StaffEnrolFlow | null;
  onClose: () => void;
  onChange: (patch: Partial<StaffEnrolFlow>) => void;
  onStart: () => void;
  onRetry: () => void;
};

const ICONS: Record<StaffEnrolKind, string> = { fingerprint: "finger-print-outline", face: "scan-outline", card: "card-outline" };

/** Seconds since `startedAt`, ticking once a second while `active`. */
function useElapsedSeconds(startedAt: number | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, startedAt]);
  return active && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

const typedCard = (f: StaffEnrolFlow) => (f.kind === "card" && f.cardMode === "type" ? f.cardNo.trim() : undefined);

function prompt(f: StaffEnrolFlow): string {
  return staffEnrolPrompt(f.kind, f.name, f.roomName, { machineName: f.machineName, fingerNo: f.fingerNo, cardNo: typedCard(f) });
}

/** "Fingerprint (finger 2)", "Face", "Card 0012345". */
function what(f: StaffEnrolFlow, result?: StaffEnrolResult): string {
  if (f.kind === "face") return "Face";
  if (f.kind === "card") {
    const no = result?.cardNo ?? typedCard(f);
    return no ? `Card ${no}` : "Card";
  }
  return `Fingerprint (finger ${f.fingerNo})`;
}

export function StaffEnrolSheet({ flow, onClose, onChange, onStart, onRetry }: StaffEnrolSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const waiting = flow?.phase === "waiting";
  const elapsed = useElapsedSeconds(flow?.startedAt, waiting);

  // Keep the last flow while the sheet slides out (flow becomes null on close).
  const [shown, setShown] = useState<StaffEnrolFlow | null>(flow);
  useEffect(() => {
    if (flow) setShown(flow);
  }, [flow]);
  const f = flow ?? shown;
  if (!f) return null;

  const icon = ICONS[f.kind];
  const instruction = prompt(f);
  const failed = f.phase === "done" && (!!f.error || !f.result?.ok);

  const footer =
    f.phase === "ready" ? (
      <>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flex} />
        <Button title="Start" leftIcon={icon} onPress={onStart} haptic style={styles.flex} accessibilityHint={instruction} />
      </>
    ) : f.phase === "waiting" ? (
      <Button title="Waiting for the machine" loading disabled fullWidth />
    ) : failed ? (
      <>
        <Button title="Close" variant="outline" onPress={onClose} style={styles.flex} />
        <Button title="Try again" leftIcon="refresh" onPress={onRetry} style={styles.flex} />
      </>
    ) : (
      <Button title="Done" leftIcon="checkmark" onPress={onClose} fullWidth />
    );

  return (
    <BottomSheet
      visible={!!flow}
      onClose={onClose}
      dismissible={!waiting}
      showClose={!waiting}
      title={STAFF_ENROL_TITLES[f.kind]}
      subtitle={[f.name.trim() || null, f.roomName].filter(Boolean).join(" · ")}
      footer={footer}
      error={f.phase === "ready" ? f.inputError : null}
    >
      {f.phase === "ready" ? (
        <View style={styles.stack}>
          {f.kind === "card" ? (
            <SegmentedControl
              accessibilityLabel="How to add the card"
              options={[
                { label: "Tap on the reader", value: "tap" },
                { label: "Type the number", value: "type" },
              ]}
              value={f.cardMode}
              onChange={(v) => onChange({ cardMode: v as "tap" | "type", inputError: null })}
            />
          ) : null}
          {f.kind === "card" && f.cardMode === "type" ? (
            <TextField
              label="Card number"
              required
              value={f.cardNo}
              onChangeText={(t) => onChange({ cardNo: t.replace(/[^0-9A-Za-z]/g, "").slice(0, 32), inputError: null })}
              autoCapitalize="characters"
              autoCorrect={false}
              helperText="As printed on the card: 1 to 32 letters or digits."
            />
          ) : (
            <Instruction icon={icon} text={instruction} />
          )}
          {f.kind === "fingerprint" ? (
            <View style={styles.stack}>
              <AppText variant="label">Finger</AppText>
              <View style={styles.fingers} accessibilityRole="radiogroup" accessibilityLabel="Finger number">
                {FINGER_NUMBERS.map((n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={f.fingerNo === n}
                    onPress={() => onChange({ fingerNo: n })}
                    accessibilityLabel={`Finger ${n}`}
                    style={styles.finger}
                  />
                ))}
              </View>
              <AppText variant="caption" color="textMuted">
                Each finger number is a separate slot on the machines. Enrol a second finger under another number.
              </AppText>
            </View>
          ) : null}
          <AppText variant="bodySmall" color="textMuted">
            {typedCard(f) !== undefined
              ? "The card number is saved on the room machine and every entrance."
              : "Press Start when they are at the machine. The room machine captures it, then every entrance gets a copy."}
          </AppText>
        </View>
      ) : null}

      {f.phase === "waiting" ? (
        <View style={styles.waiting} accessibilityLiveRegion="polite">
          <View style={[styles.waitIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={icon} size={40} color={colors.onPrimarySoft} />
          </View>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="subheading" align="center">
            {instruction}
          </AppText>
          <AppText variant="bodySmall" color="textMuted" align="center" accessibilityLabel={`Waiting for the machine, ${elapsed} seconds`}>
            {`Waiting for the machine: ${elapsed} s`}
          </AppText>
          <AppText variant="caption" color="textMuted" align="center">
            {ENROL_WAIT_NOTE}
          </AppText>
        </View>
      ) : null}

      {f.phase === "done" ? <Outcome flow={f} /> : null}
    </BottomSheet>
  );
}

function Instruction({ icon, text }: { icon: string; text: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.instruction, { backgroundColor: colors.primarySoft }]} accessible accessibilityLabel={text}>
      <Ionicons name={icon} size={28} color={colors.onPrimarySoft} />
      <Text style={[styles.instructionText, { color: colors.onPrimarySoft }]}>{text}</Text>
    </View>
  );
}

function Outcome({ flow }: { flow: StaffEnrolFlow }) {
  const styles = useThemedStyles(createStyles);
  const { tones } = useTheme();
  if (flow.error || !flow.result) {
    return <Banner tone="danger" title={`${what(flow)}: enrolment did not finish`} message={flow.error ?? "Please try again."} />;
  }
  const result = flow.result;
  const summary = staffEnrolSummary(result);
  const verbs: AoMachineVerbs = typedCard(flow) !== undefined ? { room: "Saved", entrance: "Copied" } : { room: "Captured and saved", entrance: "Copied" };
  const lines = machineLines(result.devices, flow.machineName, verbs);
  const who = flow.name.trim() || "the person";
  const message = result.ok
    ? summary ?? "Saved on the machines."
    : [result.error, summary].filter(Boolean).join(" ") || "The machine did not capture it. Please try again.";
  return (
    <View style={styles.stack}>
      <Banner
        tone={result.ok ? "success" : "danger"}
        title={result.ok ? `${what(flow, result)} added for ${who}` : `${what(flow, result)}: enrolment did not finish`}
        message={message}
      />
      {lines.length ? (
        <View style={styles.stack}>
          <AppText variant="overline" color="textMuted">
            Machines
          </AppText>
          {lines.map((line, i) => {
            const tone = tones[line.tone];
            return (
              <View key={`${line.device}-${i}`} style={styles.machine} accessible accessibilityLabel={`${line.role}, ${line.device}: ${line.status}`}>
                <Ionicons name={line.icon} size={20} color={tone.fg} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {line.device}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {`${line.role} · ${line.status}`}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    stack: { gap: t.spacing.md },
    fingers: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    finger: { minWidth: 52 },
    instruction: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      padding: t.spacing.lg,
      borderRadius: t.radii.card,
    },
    instructionText: { ...t.typography.bodyStrong, flex: 1 },
    waiting: { alignItems: "center", gap: t.spacing.md, paddingVertical: t.spacing.lg },
    waitIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
    machine: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
  });
