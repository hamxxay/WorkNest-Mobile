import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Banner, BottomSheet, Button, Chip } from "../../../components/ui";
import {
  ENROL_TITLES,
  ENROL_WAIT_NOTE,
  FINGER_NUMBERS,
  enrolPrompt,
  enrolResultTitle,
  enrolSummary,
  machineLines,
  type AoEnrolKind,
  type AoEnrolResult,
  type AoMatch,
} from "../../../services/accessOfficer";
import { useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";

// The enrolment sheet of the Access screen. Three steps:
//   ready    what to ask the person (and, for a fingerprint, which finger 1-10), then "Start"
//   waiting  the request is open (up to ~90 s) while the room machine waits for the face / finger: a clear waiting
//            state with the instruction and the seconds so far; the sheet cannot be closed
//   done     the outcome and one line per machine (room machine captured, entrances copied / queued / failed)

export type EnrolFlow = {
  kind: AoEnrolKind;
  match: AoMatch;
  personId: number;
  /** The person's name (for the instruction), "" when unknown. */
  name: string;
  fingerNo: number;
  phase: "ready" | "waiting" | "done";
  /** Set while waiting: when the request started (ms). */
  startedAt?: number;
  /** done: the enrolment's answer (ok or not). */
  result?: AoEnrolResult;
  /** done: the call failed without an answer (offline, no answer in time, AO_01...). */
  error?: string;
};

export type EnrolSheetProps = {
  flow: EnrolFlow | null;
  onClose: () => void;
  onFingerChange: (fingerNo: number) => void;
  onStart: () => void;
  /** Back to "ready" after a failure. */
  onRetry: () => void;
};

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

export function EnrolSheet({ flow, onClose, onFingerChange, onStart, onRetry }: EnrolSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const waiting = flow?.phase === "waiting";
  const elapsed = useElapsedSeconds(flow?.startedAt, waiting);

  // Keep the last flow while the sheet slides out (flow becomes null on close).
  const [shown, setShown] = useState<EnrolFlow | null>(flow);
  useEffect(() => {
    if (flow) setShown(flow);
  }, [flow]);
  const f = flow ?? shown;
  if (!f) return null;

  const icon = f.kind === "face" ? "scan-outline" : "finger-print-outline";
  const prompt = enrolPrompt(f.kind, f.name, f.match, f.fingerNo);
  const failed = f.phase === "done" && (!!f.error || !f.result?.ok);

  const footer =
    f.phase === "ready" ? (
      <>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.flex} />
        <Button title="Start" leftIcon={icon} onPress={onStart} haptic style={styles.flex} accessibilityHint={prompt} />
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
      title={ENROL_TITLES[f.kind]}
      subtitle={[f.name.trim() || null, f.match.room].filter(Boolean).join(" · ")}
      footer={footer}
    >
      {f.phase === "ready" ? (
        <View style={styles.stack}>
          <Instruction icon={icon} text={prompt} />
          {f.kind === "fingerprint" ? (
            <View style={styles.stack}>
              <AppText variant="label">Finger</AppText>
              <View style={styles.fingers} accessibilityRole="radiogroup" accessibilityLabel="Finger number">
                {FINGER_NUMBERS.map((n) => (
                  <Chip
                    key={n}
                    label={String(n)}
                    selected={f.fingerNo === n}
                    onPress={() => onFingerChange(n)}
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
            Press Start when they are at the machine. The room machine captures it, then every entrance gets a copy.
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
            {prompt}
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

function Outcome({ flow }: { flow: EnrolFlow }) {
  const styles = useThemedStyles(createStyles);
  const { tones } = useTheme();
  if (flow.error || !flow.result) {
    return (
      <Banner tone="danger" title={`${flow.kind === "face" ? "Face" : "Fingerprint"} enrolment did not finish`} message={flow.error ?? "Please try again."} />
    );
  }
  const result = flow.result;
  const summary = enrolSummary(result);
  const lines = machineLines(result.devices, flow.match.roomMachine?.name);
  const message = result.ok
    ? summary ?? "Saved on the machines."
    : [result.error, summary].filter(Boolean).join(" ") || "The machine did not capture it. Please try again.";
  return (
    <View style={styles.stack}>
      <Banner tone={result.ok ? "success" : "danger"} title={enrolResultTitle(result, flow.name, flow.fingerNo)} message={message} />
      {lines.length ? (
        <View style={styles.stack}>
          <AppText variant="overline" color="textMuted">
            Machines
          </AppText>
          {lines.map((line, i) => {
            const tone = tones[line.tone];
            return (
              <View
                key={`${line.device}-${i}`}
                style={styles.machine}
                accessible
                accessibilityLabel={`${line.role}, ${line.device}: ${line.status}`}
              >
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
