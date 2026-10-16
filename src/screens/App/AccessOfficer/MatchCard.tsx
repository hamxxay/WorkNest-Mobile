import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AppText, Avatar, Banner, Button, Card, Divider, InfoRow, useScreenColumnWidth } from "../../../components/ui";
import {
  actionsNote,
  bookingDatesText,
  credentialChips,
  machineStatusChip,
  matchActions,
  matchStatusChip,
  seatsText,
  type AoAction,
  type AoActionKind,
  type AoCardNotice,
  type AoChip,
  type AoMatch,
  type AoPerson,
} from "../../../services/accessOfficer";
import { spacing, useTheme, useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { scaledMinWidth, stackActions, stackLabelValue, textScale, useMeasuredWidth } from "../../../utils/responsive";

// Cards of the Access screen: who was found (PersonCard) and one card per room they are on or waiting for
// (MatchCard), with the status / enrolled / machine chips and the actions services/accessOfficer/rules allows.
// Theme colours only (light + dark); icons and words, no emojis.

/** A small coloured label with an icon. Decorative for screen readers when `hidden` (a parent label reads it). */
export function ToneChip({ chip, hidden = false }: { chip: AoChip; hidden?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { tones } = useTheme();
  const tone = tones[chip.tone];
  return (
    <View
      style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}
      accessible={!hidden}
      accessibilityLabel={hidden ? undefined : chip.label}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={hidden}
    >
      <Ionicons name={chip.icon} size={13} color={tone.fg} />
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.chipText, { color: tone.fg }]}>
        {chip.label}
      </Text>
    </View>
  );
}

/**
 * Label on the left, chips wrapping on the right ("Enrolled", "Room machine"). With large text on a phone the
 * chips go under the label (as InfoRow does), otherwise the label leaves them only a few letters.
 */
function ChipRow({ label, icon, chips, spoken }: { label: string; icon: string; chips: AoChip[]; spoken: string }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = stackLabelValue(width, fontScale);
  return (
    <View style={stacked ? styles.chipRowStacked : styles.chipRow} accessible accessibilityLabel={spoken}>
      <View style={styles.chipRowLabel}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <AppText variant="bodySmall" color="textMuted" style={styles.shrink}>
          {label}
        </AppText>
      </View>
      <View style={stacked ? styles.chipListStacked : styles.chipList}>
        {chips.map((chip) => (
          <ToneChip key={chip.label} chip={chip} hidden />
        ))}
      </View>
    </View>
  );
}

// ─── Person ──────────────────────────────────────────────────────────────────────────────────────────────

/** Who was found: name, CNIC / passport, phone, email. Without a person record yet, the CNIC alone. */
export function PersonCard({ person, cnic }: { person: AoPerson | null; cnic: string }) {
  const styles = useThemedStyles(createStyles);
  const name = person?.name?.trim() || "";
  const idLabel = person?.idType?.trim() || "CNIC";
  return (
    <Card>
      <View style={styles.identity}>
        <Avatar name={name || idLabel} size={48} />
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={2} accessibilityRole="header">
            {name || "Name not on record yet"}
          </AppText>
          {!name ? (
            <AppText variant="caption" color="textMuted">
              A customer added this CNIC. The name shows once the person is added to the room.
            </AppText>
          ) : null}
        </View>
      </View>
      <Divider spacing={10} />
      <InfoRow label={idLabel} value={person?.idNumber || cnic} icon="id-card-outline" />
      {person ? <InfoRow label="Phone" value={person.phone ?? ""} icon="call-outline" /> : null}
      {person ? <InfoRow label="Email" value={person.email ?? ""} icon="mail-outline" layout={(person.email ?? "").length > 22 ? "stacked" : undefined} /> : null}
    </Card>
  );
}

// ─── Match ───────────────────────────────────────────────────────────────────────────────────────────────

export type MatchCardProps = {
  match: AoMatch;
  /** The outcome of the last Add to room / Remove access / Restore access on this room, until dismissed. */
  notice?: AoCardNotice | null;
  onDismissNotice?: () => void;
  /** The action running on this card (its button spins), or null. */
  busy: AoActionKind | null;
  /** Another card (or the enrolment sheet) is busy: every button here is off. */
  locked: boolean;
  onAction: (kind: AoActionKind, match: AoMatch) => void;
};

/** Card padding + border on each side (dp): Card's default padding 16 and its 1dp border. */
const CARD_INSET = 17;
/** Width of the room icon in the card head (dp); styles.roomIcon. */
const HEAD_ICON = 40;
/** Narrowest the room name gets beside the status chip before the chip goes under it (font scale 1, dp). */
const TITLE_MIN_WIDTH = 120;

/** Rough width of a ToneChip (captionStrong 12, text capped at 1.3x, 13dp icon, padding and border). */
export function toneChipWidth(label: string, fontScale: number): number {
  return Math.ceil(label.length * 12 * 0.6 * Math.min(textScale(fontScale), 1.3) + 13 + spacing.xs + 2 * spacing.sm + 2);
}

/**
 * True when the status chip should go under the room name: beside it, the name (in `width`, the card's inner
 * width) would get less than TITLE_MIN_WIDTH (grown with the font size).
 */
export function statusChipBelow(width: number, fontScale: number, label: string): boolean {
  const titleRoom = width - HEAD_ICON - 2 * spacing.md - toneChipWidth(label, fontScale);
  return titleRoom < scaledMinWidth(TITLE_MIN_WIDTH, fontScale);
}

/** One room the person is on (or waiting for): details, chips and the actions the rules allow. */
export function MatchCard({ match, notice, onDismissNotice, busy, locked, onAction }: MatchCardProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // The card's inner width: measured, with a guess from the screen column (minus the screen's and the card's
  // padding) for the first frame. Follows rotation and a foldable being opened.
  const columnWidth = useScreenColumnWidth();
  const [innerWidth, onInnerLayout] = useMeasuredWidth(columnWidth - 2 * spacing.screen - 2 * CARD_INSET);
  const status = matchStatusChip(match);
  const enrolled = credentialChips(match.credentials);
  const machine = machineStatusChip(match.roomMachine);
  const actions = matchActions(match);
  const note = actionsNote(actions);
  const dates = bookingDatesText(match);
  const seats = seatsText(match);
  const enrolledChips: AoChip[] = enrolled.length ? enrolled : [{ label: "Nothing yet", icon: "ellipse-outline", tone: "neutral" }];
  const machineChips: AoChip[] = match.roomMachine?.name && match.roomMachine.name !== match.room
    ? [{ label: match.roomMachine.name, icon: "hardware-chip-outline", tone: "neutral" }, machine]
    : [machine];

  const [first, second, ...rest] = actions;
  // Enrol face + Enrol fingerprint share a row only when both labels fit (tablets, unfolded foldables); on a
  // phone "Enrol fingerprint" would be cut, so they go one above the other like the other actions.
  const pair =
    !!first &&
    !!second &&
    first.kind === "enrolFace" &&
    second.kind === "enrolFingerprint" &&
    !stackActions(innerWidth, fontScale, [
      { title: first.label, icon: true },
      { title: second.label, icon: true },
    ], spacing.sm);
  const chipBelow = statusChipBelow(innerWidth, fontScale, status.label);

  return (
    <Card>
      <View style={styles.head} onLayout={onInnerLayout}>
        <View style={styles.roomIcon}>
          <Ionicons name="business-outline" size={20} color={colors.onPrimarySoft} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading" numberOfLines={2} accessibilityRole="header">
            {match.room}
          </AppText>
          {match.location ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {match.location}
            </AppText>
          ) : null}
          {chipBelow ? (
            <View style={styles.chipBelow}>
              <ToneChip chip={status} />
            </View>
          ) : null}
        </View>
        {chipBelow ? null : <ToneChip chip={status} />}
      </View>

      <Divider spacing={10} />
      <InfoRow label="Customer" value={match.customer ?? ""} icon="briefcase-outline" layout={(match.customer ?? "").length > 22 ? "stacked" : undefined} />
      <InfoRow label="Booking" value={dates ?? ""} icon="calendar-outline" />
      {seats ? <InfoRow label="Seats" value={seats} icon="people-outline" /> : null}
      {match.state === "assigned" ? (
        <ChipRow
          label="Enrolled"
          icon="shield-checkmark-outline"
          chips={enrolledChips}
          spoken={`Enrolled: ${enrolled.length ? enrolled.map((c) => c.label).join(", ") : "nothing yet"}`}
        />
      ) : null}
      <ChipRow
        label="Room machine"
        icon="hardware-chip-outline"
        chips={machineChips}
        spoken={`Room machine: ${match.roomMachine ? `${match.roomMachine.name}, ${machine.label}` : machine.label}`}
      />

      <View style={styles.actions}>
        {pair && first && second ? (
          <View style={styles.actionPair}>
            {[first, second].map((a) => (
              <ActionButton key={a.kind} action={a} match={match} busy={busy} locked={locked} onAction={onAction} style={styles.flex} />
            ))}
          </View>
        ) : null}
        {(pair ? rest : actions).map((a) => (
          <ActionButton key={a.kind} action={a} match={match} busy={busy} locked={locked} onAction={onAction} />
        ))}
        {note ? (
          <View style={styles.note} accessible accessibilityLabel={note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <AppText variant="caption" color="textMuted" style={styles.flex}>
              {note}
            </AppText>
          </View>
        ) : null}
      </View>

      {notice ? <NoticeBlock notice={notice} onDismiss={onDismissNotice} /> : null}
    </Card>
  );
}

/** The last write's outcome on this room, with the machines that were offline or failed. */
function NoticeBlock({ notice, onDismiss }: { notice: AoCardNotice; onDismiss?: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { tones } = useTheme();
  return (
    <View style={styles.notice}>
      <Banner tone={notice.tone} message={notice.message} onDismiss={onDismiss} />
      {notice.lines.map((line, i) => {
        const tone = tones[line.tone];
        return (
          <View
            key={`${line.device}-${i}`}
            style={styles.machine}
            accessible
            accessibilityLabel={`${line.role}, ${line.device}: ${line.status}`}
          >
            <Ionicons name={line.icon} size={18} color={tone.fg} />
            <View style={styles.flex}>
              <AppText variant="label" numberOfLines={1}>
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
  );
}

function ActionButton({
  action,
  match,
  busy,
  locked,
  onAction,
  style,
}: {
  action: AoAction;
  match: AoMatch;
  busy: AoActionKind | null;
  locked: boolean;
  onAction: (kind: AoActionKind, match: AoMatch) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const loading = busy === action.kind;
  return (
    <Button
      title={action.label}
      leftIcon={action.icon}
      variant={action.variant}
      size="md"
      fullWidth
      loading={loading}
      disabled={!!action.disabledReason || locked || (busy != null && !loading)}
      onPress={() => onAction(action.kind, match)}
      accessibilityLabel={`${action.label}, ${match.room}`}
      accessibilityHint={action.disabledReason ?? undefined}
      style={style}
      textStyle={styles.shrink}
    />
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    identity: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    head: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    roomIcon: {
      width: 40,
      height: 40,
      borderRadius: t.radii.sm,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xxs,
      borderRadius: t.radii.pill,
      borderWidth: 1,
      maxWidth: "100%",
    },
    chipText: { ...t.typography.captionStrong, flexShrink: 1 },
    chipRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    chipRowStacked: { gap: t.spacing.xs, paddingVertical: t.spacing.sm },
    chipRowLabel: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2, flexShrink: 1 },
    chipList: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: t.spacing.xs },
    chipListStacked: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.xs },
    chipBelow: { flexDirection: "row", marginTop: t.spacing.xs },
    // A label that ends in "..." instead of being cut at both sides if it is still too long.
    shrink: { flexShrink: 1 },
    actions: { gap: t.spacing.sm, marginTop: t.spacing.md },
    actionPair: { flexDirection: "row", gap: t.spacing.sm },
    note: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    notice: { gap: t.spacing.xs, marginTop: t.spacing.md },
    machine: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.xs },
  });
