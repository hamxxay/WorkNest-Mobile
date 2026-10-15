import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  Banner,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  InfoRow,
  ListRow,
  ListSkeleton,
  SectionHeader,
  SegmentedControl,
  SelectField,
  StatusPill,
  Switch,
  TextField,
  useToast,
} from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  addAttendantByCnic,
  addPersonAction,
  approveCapacityRequest,
  assignAttendant,
  canDecideCapacityRequest,
  canWithdrawCapacityRequest,
  cancelCapacityRequest,
  cardNumberError,
  checkRoomCapacity,
  createAttendant,
  enrolAttendant,
  enrolBlockedReason,
  extendDoorAccess,
  getAccessSuspension,
  getCustomerAttendants,
  getRoomAttendants,
  getRoomChallans,
  getRoomMachine,
  listCapacityRequests,
  machineSyncNotice,
  rejectCapacityRequest,
  removeAttendant,
  requestCapacityApproval,
  setDoorAccess,
  toApiDate,
  validateAttendantInput,
  type ByCnicOutcome,
  type CapacityCheck,
  type CapacityRequest,
  type CustomerAttendant,
  type IdType,
  type MachineNotice,
  type RoomAttendant,
  type StaffEnrolKind,
} from "../../../../services/staff";
import { spacing, useTheme } from "../../../../theme";
import { formatDate, formatMoney, formatRelative } from "../../../../utils/format";
import { cnicError, formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput } from "../../../../utils/phone";
import { StaffScreen } from "../shared/StaffScreen";
import { isAdminRole, useStaffSession } from "../shared/StaffSession";
import { useAsyncData } from "../shared/hooks";
import { useRefreshColors } from "../shared/refresh";
import { StaffEnrolSheet, type StaffEnrolFlow } from "./EnrolSheet";

type Route = RouteProp<StaffStackParamList, "RoomAccess">;

/**
 * People and door access of one booked space (AttendantController). Adding a person follows the capacity rule:
 * a free seat = assign; full room = a sales executive asks an admin (capacity request), an admin overfills a
 * private office after confirming the surcharge, never a meeting room / shared space. Sales executives start with
 * the CNIC check of an employee the customer added online (by-cnic); admins start with the full form, the CNIC check
 * one tap away (CMS cnicFirst). Admins approve or reject the room's requests here; the person who asked (or an admin)
 * can withdraw one. Also: fingerprint / face / card enrolment on the room machine, door access on / off and remove
 * (with what the machines did: queued, failed, suspended), the challan-based suspension with temporary access, and the
 * room's challans.
 */
export default function RoomAccessScreen() {
  const { params } = useRoute<Route>();
  const toast = useToast();
  const refreshColors = useRefreshColors();
  const { role, refreshBadges } = useStaffSession();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isAdmin = isAdminRole(role);
  const { bookingDetailId, customerId } = params;

  const fetcher = useCallback(async () => {
    // People and capacity are required; requests, suspension and challans are side cards whose failure is shown in
    // place; the room machine is best effort (null: unknown, the enrolment then reports any problem itself).
    const [capacity, people, requests, suspension, challans, machine] = await Promise.all([
      checkRoomCapacity(bookingDetailId),
      getRoomAttendants(bookingDetailId),
      listCapacityRequests({ status: "Pending", bookingDetailId }).then(
        (value) => ({ value, error: null as string | null }),
        (err) => ({ value: [] as CapacityRequest[], error: errorMessage(err, "Could not load the requests waiting for an admin.") }),
      ),
      getAccessSuspension(bookingDetailId).then(
        (value) => ({ value, error: null as string | null }),
        (err) => ({ value: null, error: errorMessage(err, "Could not check whether door access is suspended.") }),
      ),
      getRoomChallans(bookingDetailId).then(
        (value) => ({ value, error: null as string | null }),
        (err) => ({ value: null, error: errorMessage(err, "Could not load the challans.") }),
      ),
      getRoomMachine(bookingDetailId),
    ]);
    return {
      capacity,
      people,
      requests: requests.value,
      requestsError: requests.error,
      machine,
      suspension: suspension.value,
      suspensionError: suspension.error,
      challans: challans.value,
      challansError: challans.error,
    };
  }, [bookingDetailId]);
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher);

  const [adding, setAdding] = useState(false);
  const [surcharge, setSurcharge] = useState<{ check: CapacityCheck; personId: number } | null>(null);
  const [removing, setRemoving] = useState<RoomAttendant | null>(null);
  const [approving, setApproving] = useState<CapacityRequest | null>(null);
  const [rejecting, setRejecting] = useState<CapacityRequest | null>(null);
  const [extending, setExtending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Errors of actions confirmed in a dialog are shown in the dialog (toasts render under modals).
  const [dialogError, setDialogError] = useState<string | null>(null);
  // What the door machines did when it was not simply "done everywhere" (offline / failed / suspended), or a
  // surcharge invoice that could not be created: stays on screen until dismissed.
  const [notice, setNotice] = useState<MachineNotice | null>(null);
  const [enrol, setEnrol] = useState<StaffEnrolFlow | null>(null);

  const capacity = data?.capacity;
  const used = data?.people.length ?? 0;
  const roomFull = !!capacity && capacity.roomCapacity > 0 && used >= capacity.roomCapacity;
  const enrolBlocked = enrolBlockedReason(data?.machine ?? null);
  const roomName = params.spaceName || capacity?.spaceName || "the room";

  const finish = (message: string, warning?: string | null) => {
    toast.success(message);
    if (warning) setNotice({ tone: "warning", message: warning, problems: [] });
    refresh();
    refreshBadges();
  };

  /** A machine notice: a toast when every machine took the change, otherwise kept on screen. */
  const report = (n: MachineNotice) => {
    if (n.tone === "success") {
      toast.success(n.message);
      setNotice(null);
    } else {
      setNotice(n);
    }
    refresh();
    refreshBadges();
  };

  const toggleAccess = async (p: RoomAttendant, enable: boolean) => {
    setBusy(`access-${p.personId}`);
    try {
      const res = await setDoorAccess({ bookingDetailId, customerId, personId: p.personId, isEnabled: enable });
      report(machineSyncNotice(res.data.machines, p.name, enable ? "enable" : "disable"));
    } catch (err) {
      toast.error(errorMessage(err, "Could not change door access."));
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const openEnrol = (p: RoomAttendant, kind: StaffEnrolKind) =>
    setEnrol({
      kind,
      personId: p.personId,
      name: p.name,
      roomName,
      machineName: data?.machine?.name ?? null,
      fingerNo: 1,
      cardMode: "tap",
      cardNo: "",
      phase: "ready",
      inputError: null,
    });

  const startEnrol = async () => {
    const f = enrol;
    if (!f || f.phase === "waiting") return;
    const typed = f.kind === "card" && f.cardMode === "type";
    if (typed) {
      const invalid = cardNumberError(f.cardNo);
      if (invalid) return setEnrol({ ...f, inputError: invalid });
    }
    setEnrol({ ...f, phase: "waiting", startedAt: Date.now(), result: undefined, error: undefined, inputError: null });
    try {
      const result = await enrolAttendant({
        bookingDetailId,
        personId: f.personId,
        kind: f.kind,
        fingerNo: f.fingerNo,
        cardNo: typed ? f.cardNo : undefined,
      });
      setEnrol((cur) => (cur ? { ...cur, phase: "done", result } : cur));
      if (result.ok) refresh();
    } catch (err) {
      setEnrol((cur) => (cur ? { ...cur, phase: "done", error: errorMessage(err, "The enrolment did not finish. Please try again.") } : cur));
    }
  };

  const run = async (key: string, action: () => Promise<string>, fallback: string) => {
    setBusy(key);
    try {
      finish(await action());
      return true;
    } catch (err) {
      toast.error(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Like run(), for actions confirmed in a dialog: the error stays in the dialog. */
  const runInDialog = async (key: string, action: () => Promise<string>, fallback: string) => {
    setBusy(key);
    setDialogError(null);
    try {
      finish(await action());
      return true;
    } catch (err) {
      setDialogError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };
  const closeDialog = (close: () => void) => () => {
    close();
    setDialogError(null);
  };

  /** After the person exists: decide with a fresh capacity check (CMS processBookingAssignment). */
  const addPerson = async (personId: number): Promise<AddedResult | null> => {
    const check = await checkRoomCapacity(bookingDetailId);
    const action = addPersonAction(check, role);
    if (action === "assign") {
      const res = await assignAttendant(bookingDetailId, { personId, customerId });
      return { message: res.message, warning: res.data.surchargeInvoiceError };
    }
    if (action === "request-approval") return { message: (await requestCapacityApproval(bookingDetailId, { personId, customerId })).message };
    if (action === "confirm-surcharge") {
      setSurcharge({ check, personId });
      return null;
    }
    throw new Error(`${check.spaceName || "This room"} is full. Meeting rooms and shared spaces can't take more people than their seats.`);
  };

  return (
    <StaffScreen>
      <AppHeader
        title={params.spaceName || capacity?.spaceName || "Room access"}
        subtitle={capacity ? `${used} of ${capacity.roomCapacity} seats used${capacity.spaceCategory ? ` · ${capacity.spaceCategory}` : ""}` : undefined}
      />
      {loading && !data ? (
        <ListSkeleton rows={4} />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} {...refreshColors} />}
        >
          {notice ? <MachineNoticeCard notice={notice} onDismiss={() => setNotice(null)} /> : null}
          {data.suspensionError ? <ErrorState compact message={data.suspensionError} onRetry={refresh} /> : null}
          {data.suspension ? (
            <Card variant="outlined">
              <View style={styles.row}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {data.suspension.extended ? "Temporary access given" : "Door access suspended"}
                </AppText>
                <StatusPill tone={data.suspension.extended ? "warning" : "danger"} label={data.suspension.extended ? "Extended" : "Suspended"} />
              </View>
              <AppText variant="bodySmall" color="textSecondary" style={styles.gapTop}>
                {data.suspension.reason ?? "An unpaid challan is past its due date."}
              </AppText>
              {data.suspension.invoiceNumber ? <InfoRow label="Invoice" value={data.suspension.invoiceNumber} /> : null}
              {data.suspension.balanceDue != null ? <InfoRow label="Balance due" value={formatMoney(data.suspension.balanceDue)} valueColor="danger" /> : null}
              {data.suspension.overrideUntil ? (
                <InfoRow label="Access until" value={`${formatDate(data.suspension.overrideUntil)}${data.suspension.overrideByEmail ? ` (${data.suspension.overrideByEmail})` : ""}`} layout="stacked" />
              ) : null}
              <Button title="Give temporary access" variant="outline" size="sm" leftIcon="key-outline" onPress={() => setExtending(true)} style={styles.alignStart} />
            </Card>
          ) : null}

          <SectionHeader title={`People (${used})`} variant="overline" />
          {enrolBlocked && data.people.length ? (
            <Card variant="filled">
              <View style={styles.row}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
                <AppText variant="bodySmall" color="textSecondary" style={styles.flex}>
                  {`Fingerprint, face and card are off: ${enrolBlocked}`}
                </AppText>
              </View>
            </Card>
          ) : null}
          {roomFull && !isAdmin ? (
            <Card variant="filled">
              <AppText variant="bodySmall" color="textSecondary">
                This room is full. Adding someone sends a request to an admin to approve.
              </AppText>
            </Card>
          ) : null}
          {data.people.length === 0 ? (
            <EmptyState compact illustration="people" title="Nobody added yet" message="Add the people who use this space so they can open the doors." />
          ) : (
            <Card padding={0}>
              {data.people.map((p, i) => (
                <Fragment key={p.personId}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <View style={styles.person}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{p.name}</AppText>
                      <AppText variant="caption" color="textMuted">
                        {[p.phone, p.email].filter(Boolean).join(" · ")}
                      </AppText>
                      <AppText variant="caption" color="textMuted">
                        {p.idType} {p.idNumber}
                        {p.isOverCapacity ? " · over capacity" : ""}
                        {p.hikPendingOps ? ` · ${p.hikPendingOps} machine update${p.hikPendingOps === 1 ? "" : "s"} queued` : ""}
                      </AppText>
                    </View>
                    <View style={styles.personActions}>
                      <Switch
                        value={p.isEnabled}
                        disabled={busy === `access-${p.personId}`}
                        onValueChange={(v) => {
                          toggleAccess(p, v);
                        }}
                        accessibilityLabel={`Door access for ${p.name}`}
                      />
                      <Button title="Remove" variant="ghost" size="sm" onPress={() => setRemoving(p)} accessibilityLabel={`Remove ${p.name}`} />
                    </View>
                  </View>
                  <View style={styles.enrolActions}>
                    {ENROL_BUTTONS.map((b) => (
                      <Button
                        key={b.kind}
                        title={b.title}
                        variant="outline"
                        size="sm"
                        leftIcon={b.icon}
                        disabled={!!enrolBlocked}
                        onPress={() => openEnrol(p, b.kind)}
                        accessibilityLabel={`${b.title} for ${p.name}`}
                        accessibilityHint={enrolBlocked ?? undefined}
                      />
                    ))}
                  </View>
                </Fragment>
              ))}
            </Card>
          )}
          <Button
            title={roomFull && !isAdmin ? "Request to add a person" : "Add a person"}
            leftIcon="person-add-outline"
            onPress={() => setAdding(true)}
            fullWidth
          />

          {data.requestsError ? <ErrorState compact message={data.requestsError} onRetry={refresh} /> : null}
          {data.requests.length ? (
            <>
              <SectionHeader title="Waiting for admin approval" variant="overline" />
              <Card padding={0}>
                {data.requests.map((r, i) => (
                  <Fragment key={r.id}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <View style={styles.person}>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{r.personName}</AppText>
                        <AppText variant="caption" color="textMuted">
                          Asked by {r.requestedByEmail} · {formatRelative(r.requestedAt)}
                        </AppText>
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      {canDecideCapacityRequest(r, role) ? (
                        <>
                          <Button title="Approve" size="sm" leftIcon="checkmark" onPress={() => setApproving(r)} />
                          <Button title="Reject" size="sm" variant="danger" leftIcon="close" onPress={() => setRejecting(r)} />
                        </>
                      ) : null}
                      {canWithdrawCapacityRequest(r, role, user?.email) && !isAdmin ? (
                        <Button
                          title="Withdraw"
                          size="sm"
                          variant="outline"
                          loading={busy === `withdraw-${r.id}`}
                          onPress={() => run(`withdraw-${r.id}`, async () => (await cancelCapacityRequest(r.id)).message, "Could not withdraw the request.")}
                        />
                      ) : null}
                    </View>
                  </Fragment>
                ))}
              </Card>
            </>
          ) : null}

          {data.challansError ? <ErrorState compact message={data.challansError} onRetry={refresh} /> : null}
          {data.challans?.challans.length ? (
            <>
              <SectionHeader title="Challans" variant="overline" subtitle={data.challans.totalBalanceDue ? `${formatMoney(data.challans.totalBalanceDue)} due` : undefined} />
              <Card padding={0}>
                {data.challans.challans.map((c, i) => (
                  <Fragment key={`${c.type}-${c.id}`}>
                    {i > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={`${c.invoiceNumber} · ${c.type}`}
                      subtitle={`${formatMoney(c.grandTotal)} · due ${formatDate(c.dueOn)}${c.balanceDue ? ` · ${formatMoney(c.balanceDue)} left` : ""}`}
                      right={<StatusPill status={c.isOverdue ? "Overdue" : c.status} />}
                    />
                  </Fragment>
                ))}
              </Card>
            </>
          ) : null}
        </ScrollView>
      ) : null}

      {adding ? (
        <AddPersonSheet
          bookingDetailId={bookingDetailId}
          customerId={customerId}
          context={[roomName, capacity?.roomCapacity ? `${used} of ${capacity.roomCapacity} seats used` : null].filter(Boolean).join(" · ")}
          cnicFirst={role === "sales_executive"}
          inRoom={data?.people.map((p) => p.personId) ?? []}
          requestOnly={roomFull && !isAdmin}
          onClose={() => setAdding(false)}
          addPerson={addPerson}
          onDone={(added) => {
            setAdding(false);
            if (added) finish(added.message, added.warning);
            else refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        error={dialogError}
        visible={!!surcharge}
        title="Room is full"
        message={
          surcharge
            ? `Adding this person goes over the ${surcharge.check.roomCapacity} seats. An extra-seat charge of about ${formatMoney(surcharge.check.grandTotal || surcharge.check.estimatedSurcharge)} (with tax) is invoiced and emailed to the customer.`
            : undefined
        }
        confirmLabel="Add and charge"
        icon="alert-circle-outline"
        loading={busy === "surcharge"}
        onCancel={closeDialog(() => setSurcharge(null))}
        onConfirm={async () => {
          if (!surcharge) return;
          let warning: string | null = null;
          const ok = await runInDialog(
            "surcharge",
            async () => {
              const res = await assignAttendant(bookingDetailId, { personId: surcharge.personId, customerId });
              warning = res.data.surchargeInvoiceError;
              return res.message;
            },
            "Could not add the person.",
          );
          if (ok) {
            setSurcharge(null);
            // The person is in the room, but the extra-seat invoice is missing: say so (it has to be made in Invoices).
            if (warning) setNotice({ tone: "warning", message: warning, problems: [] });
          }
        }}
       />
      <ConfirmDialog
        error={dialogError}
        visible={!!removing}
        title="Remove this person?"
        message={removing ? `${removing.name} loses door access to this space today.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={busy === "remove"}
        onCancel={closeDialog(() => setRemoving(null))}
        onConfirm={async () => {
          if (!removing) return;
          const person = removing;
          setBusy("remove");
          setDialogError(null);
          try {
            const res = await removeAttendant(bookingDetailId, person.personId);
            setRemoving(null);
            report(machineSyncNotice(res.data.machines, person.name, "remove"));
          } catch (err) {
            setDialogError(errorMessage(err, "Could not remove the person."));
          } finally {
            setBusy(null);
          }
        }}
       />
      <ConfirmDialog
        error={dialogError}
        visible={!!approving}
        title="Approve this request?"
        message={approving ? `${approving.personName} is added to the room. Over-capacity charges apply.` : undefined}
        confirmLabel="Approve"
        icon="checkmark-circle-outline"
        loading={busy === "approve"}
        onCancel={closeDialog(() => setApproving(null))}
        onConfirm={async () => {
          if (!approving) return;
          const ok = await runInDialog("approve", async () => (await approveCapacityRequest(approving.id)).message, "Could not approve the request.");
          if (ok) setApproving(null);
        }}
       />
      {rejecting ? (
        <RejectRequestSheet
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(m) => {
            setRejecting(null);
            finish(m);
          }}
        />
      ) : null}
      {extending ? (
        <ExtendAccessSheet
          bookingDetailId={bookingDetailId}
          onClose={() => setExtending(false)}
          onDone={(m) => {
            setExtending(false);
            finish(m);
          }}
        />
      ) : null}
      <StaffEnrolSheet
        flow={enrol}
        onClose={() => setEnrol((cur) => (cur?.phase === "waiting" ? cur : null))}
        onChange={(patch) => setEnrol((cur) => (cur ? { ...cur, ...patch } : cur))}
        onStart={startEnrol}
        onRetry={() => setEnrol((cur) => (cur ? { ...cur, phase: "ready", result: undefined, error: undefined } : cur))}
      />
    </StaffScreen>
  );
}

/** What adding a person did: the message, and a warning when the extra-seat invoice could not be created. */
type AddedResult = { message: string; warning?: string | null };

const ENROL_BUTTONS: { kind: StaffEnrolKind; title: string; icon: string }[] = [
  { kind: "fingerprint", title: "Fingerprint", icon: "finger-print-outline" },
  { kind: "face", title: "Face", icon: "scan-outline" },
  { kind: "card", title: "Card", icon: "card-outline" },
];

/** The machines' side of the last change when it was not simply done everywhere: the message and each machine. */
function MachineNoticeCard({ notice, onDismiss }: { notice: MachineNotice; onDismiss: () => void }) {
  const { tones } = useTheme();
  return (
    <View style={styles.notice}>
      <Banner
        tone={notice.tone}
        title={notice.tone === "danger" ? "Some door machines were not updated" : notice.problems.length ? "Some door machines are offline" : "Please check"}
        message={notice.message}
        onDismiss={onDismiss}
      />
      {notice.problems.length ? (
        <Card padding={0}>
          {notice.problems.map((m, i) => {
            const tone = tones[m.queued ? "warning" : "danger"];
            return (
              <Fragment key={`${m.device}-${i}`}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View style={styles.machine} accessible accessibilityLabel={`${m.device}: ${m.status}`}>
                  <Ionicons name={m.queued ? "time-outline" : "alert-circle-outline"} size={18} color={tone.fg} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {m.device}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {m.status}
                    </AppText>
                  </View>
                </View>
              </Fragment>
            );
          })}
        </Card>
      ) : null}
    </View>
  );
}

function AddPersonSheet({
  bookingDetailId,
  customerId,
  context,
  cnicFirst,
  inRoom,
  requestOnly,
  onClose,
  addPerson,
  onDone,
}: {
  bookingDetailId: number;
  customerId: number;
  /** "Office 329 · 3 of 6 seats used" */
  context: string;
  /** Sales executives start with the CNIC check of an employee the customer added online; admins with the form. */
  cnicFirst: boolean;
  inRoom: number[];
  requestOnly: boolean;
  onClose: () => void;
  addPerson: (personId: number) => Promise<AddedResult | null>;
  onDone: (added: AddedResult | null) => void;
}) {
  const [step, setStep] = useState<"cnic" | "form">(cnicFirst ? "cnic" : "form");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const fetcher = useCallback(() => getCustomerAttendants(customerId), [customerId]);
  const people = useAsyncData<CustomerAttendant[]>(fetcher);
  const available = useMemo(() => (people.data ?? []).filter((p) => !inRoom.includes(p.personId)), [people.data, inRoom]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState<IdType>("CNIC");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const idRef = useRef<TextInput>(null);

  // CNIC check (POST bookings/{id}/attendants/by-cnic)
  const [lookupCnic, setLookupCnic] = useState("");
  const [lookupTried, setLookupTried] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; manual: boolean } | null>(null);
  const [added, setAdded] = useState<Extract<ByCnicOutcome, { kind: "added" }> | null>(null);
  const lookupError = !lookupCnic.trim() ? "Enter the CNIC." : cnicError(lookupCnic);

  const close = () => {
    // Someone was already added by the CNIC check: the room must be reloaded either way.
    if (added) onDone({ message: added.message });
    else onClose();
  };

  const findByCnic = async () => {
    if (lookupBusy) return;
    setLookupTried(true);
    setProblem(null);
    if (lookupError) return;
    setLookupBusy(true);
    try {
      const outcome = await addAttendantByCnic(bookingDetailId, lookupCnic);
      if (outcome.kind === "added") setAdded(outcome);
      else setProblem({ text: outcome.message, manual: outcome.canAddManually });
    } catch (err) {
      setProblem({ text: errorMessage(err, "The CNIC could not be checked. Please try again."), manual: false });
    } finally {
      setLookupBusy(false);
    }
  };

  /** Full form (new person / someone already on this customer), with the CNIC typed so far filled in. */
  const addManually = () => {
    setStep("form");
    setMode("new");
    setError(null);
    if (!idNumber && lookupCnic.trim() && !cnicError(lookupCnic)) {
      setIdType("CNIC");
      setIdNumber(formatCnicInput(lookupCnic));
    }
  };

  const findByCnicInstead = () => {
    setStep("cnic");
    setLookupTried(false);
    setProblem(null);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    let id = personId;
    if (mode === "existing" && !id) return setError("Choose the person.");
    if (mode === "new") {
      const input = { customerId, name, email, phone, idType, idNumber };
      const invalid = validateAttendantInput(input);
      if (invalid) return setError(invalid);
    }
    setSaving(true);
    try {
      if (mode === "new") {
        id = (await createAttendant({ customerId, name, email, phone, idType, idNumber })).data.personId;
        if (!id) throw new Error("The person could not be created. Please try again.");
        // The person now exists: a retry must not create them again, so continue with them as an existing person.
        setPersonId(id);
        setMode("existing");
        people.reload();
      }
      if (!id) throw new Error("Choose the person.");
      onDone(await addPerson(id));
    } catch (err) {
      setError(errorMessage(err, "Could not add the person."));
    } finally {
      setSaving(false);
    }
  };

  if (step === "cnic") {
    return (
      <BottomSheet
        visible
        onClose={close}
        dismissible={!lookupBusy}
        title="Add a person"
        subtitle={context || undefined}
        footer={
          added ? (
            <Button title="Done" leftIcon="checkmark" onPress={close} fullWidth />
          ) : (
            <>
              <Button title="Cancel" variant="outline" onPress={close} disabled={lookupBusy} style={styles.flex} />
              <Button title="Find and add" leftIcon="search" onPress={findByCnic} loading={lookupBusy} style={styles.flex} />
            </>
          )
        }
      >
        {added ? (
          <>
            <Banner tone="success" message={added.message} />
            <Card variant="outlined">
              <InfoRow label="Name" value={added.person.name || "—"} />
              <InfoRow label="Phone" value={added.person.phone || "—"} />
              <InfoRow label="Email" value={added.person.email || "—"} />
              <InfoRow label={added.person.idType || "CNIC"} value={added.person.idNumber || lookupCnic} />
            </Card>
            <AppText variant="bodySmall" color="textMuted">
              They are now in this room. Use Fingerprint, Face or Card on their row to give them door access.
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="bodySmall" color="textSecondary">
              Customers add their employees online. Enter the employee's CNIC to check it and add them to this room.
            </AppText>
            <TextField
              label="CNIC"
              required
              value={lookupCnic}
              onChangeText={(t) => {
                setLookupCnic(formatCnicInput(t));
                setProblem(null);
              }}
              error={lookupTried ? lookupError ?? undefined : undefined}
              keyboardType="number-pad"
              placeholder="35202-1234567-1"
              returnKeyType="search"
              onSubmitEditing={findByCnic}
              disabled={lookupBusy}
            />
            {problem ? (
              problem.manual ? (
                <Banner tone="warning" message={problem.text} actionLabel="Add manually" onAction={addManually} />
              ) : (
                <Banner tone="danger" message={problem.text} />
              )
            ) : null}
            {!cnicFirst ? <Button title="Use the full form instead" variant="ghost" size="sm" leftIcon="create-outline" onPress={addManually} style={styles.alignStart} /> : null}
          </>
        )}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      error={error}
      visible
      onClose={onClose}
      dismissible={!saving}
      title={requestOnly ? "Request to add a person" : "Add a person"}
      subtitle={requestOnly ? "The room is full, so an admin is asked to approve." : context || undefined}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title={requestOnly ? "Send request" : "Add"} onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <Button
        title={cnicFirst ? "Back to the CNIC check" : "Find by CNIC"}
        variant="ghost"
        size="sm"
        leftIcon={cnicFirst ? "arrow-back" : "search"}
        onPress={findByCnicInstead}
        disabled={saving}
        style={styles.alignStartTight}
        accessibilityHint="Add an employee the customer added online, by their CNIC"
      />
      <SegmentedControl
        accessibilityLabel="Who to add"
        options={[
          { label: "Existing person", value: "existing" },
          { label: "New person", value: "new" },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v as "existing" | "new");
          setError(null);
        }}
      />
      {mode === "existing" ? (
        people.error ? (
          <ErrorState compact message={people.error} onRetry={people.reload} />
        ) : (
          <SelectField
            label="Person"
            required
            value={personId}
            options={available.map((p) => ({ label: p.name, value: p.personId, description: [p.phone, p.email].filter(Boolean).join(" · ") }))}
            onChange={setPersonId}
            loading={people.loading}
            placeholder={available.length || people.loading ? "Choose a person" : "Everyone is already in this room"}
            emptyText="No other people for this customer. Add a new person."
          />
        )
      ) : (
        <>
          <TextField label="Full name" required value={name} onChangeText={setName} autoCapitalize="words" maxLength={100} returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
          <TextField ref={emailRef} label="Email" required value={email} onChangeText={(t) => setEmail(t.trim())} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
          <TextField ref={phoneRef} label="Phone" required value={phone} onChangeText={(t) => setPhone(formatPhoneInput(t))} keyboardType="phone-pad" returnKeyType="next" onSubmitEditing={() => idRef.current?.focus()} />
          <SegmentedControl
            accessibilityLabel="ID type"
            options={[
              { label: "CNIC", value: "CNIC" },
              { label: "Passport", value: "Passport" },
            ]}
            value={idType}
            onChange={(v) => {
              setIdType(v as IdType);
              setIdNumber("");
            }}
          />
          <TextField
            ref={idRef}
            label={idType === "CNIC" ? "CNIC" : "Passport number"}
            required
            value={idNumber}
            onChangeText={(t) => setIdNumber(idType === "CNIC" ? formatCnicInput(t) : t.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20))}
            keyboardType={idType === "CNIC" ? "number-pad" : "default"}
            autoCapitalize="characters"
            placeholder={idType === "CNIC" ? "35202-1234567-1" : undefined}
          />
        </>
      )}
    </BottomSheet>
  );
}

function RejectRequestSheet({ request, onClose, onDone }: { request: CapacityRequest; onClose: () => void; onDone: (m: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone((await rejectCapacityRequest(request.id, note)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not reject the request."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      error={error}
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Reject request"
      subtitle={`${request.personName} for ${request.spaceName}`}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Reject" variant="danger" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <TextField label="Note for the sales executive" value={note} onChangeText={setNote} multiline rows={3} maxLength={500} helperText="Optional" />
    </BottomSheet>
  );
}

function ExtendAccessSheet({ bookingDetailId, onClose, onDone }: { bookingDetailId: number; onClose: () => void; onDone: (m: string) => void }) {
  const [until, setUntil] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!until) return setError("Choose the date access is extended until.");
    setSaving(true);
    setError(null);
    try {
      onDone((await extendDoorAccess(bookingDetailId, { overrideUntil: toApiDate(until), reason })).message);
    } catch (err) {
      setError(errorMessage(err, "Could not give temporary access."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <BottomSheet
      error={error}
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Give temporary access"
      subtitle="Doors open again until the date you choose, even though the challan is unpaid."
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Give access" onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
      <DateField label="Access until" required value={until} onChange={setUntil} minimumDate={new Date()} />
      <TextField label="Reason" required value={reason} onChangeText={setReason} multiline rows={2} maxLength={500} helperText="3 to 500 characters" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gapTop: { marginTop: spacing.xs },
  alignStart: { alignSelf: "flex-start", marginTop: spacing.sm },
  alignStartTight: { alignSelf: "flex-start" },
  enrolActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  notice: { gap: spacing.sm },
  machine: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  personActions: { alignItems: "flex-end", gap: 2 },
  requestActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
