import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, View, type TextInput } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  DateField,
  Divider,
  EmptyState,
  ErrorState,
  FieldMessage,
  InfoRow,
  ListRow,
  ListSkeleton,
  SectionHeader,
  SegmentedControl,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import { useAuth } from "../../../../context/AuthContext";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  addPersonAction,
  approveCapacityRequest,
  assignAttendant,
  canDecideCapacityRequest,
  canWithdrawCapacityRequest,
  cancelCapacityRequest,
  checkRoomCapacity,
  createAttendant,
  extendDoorAccess,
  getAccessSuspension,
  getCustomerAttendants,
  getRoomAttendants,
  getRoomChallans,
  listCapacityRequests,
  rejectCapacityRequest,
  removeAttendant,
  requestCapacityApproval,
  setDoorAccess,
  toApiDate,
  validateAttendantInput,
  type CapacityCheck,
  type CapacityRequest,
  type CustomerAttendant,
  type IdType,
  type RoomAttendant,
} from "../../../../services/staff";
import { spacing, useThemeColors } from "../../../../theme";
import { formatDate, formatMoney, formatRelative } from "../../../../utils/format";
import { formatCnicInput } from "../../../../utils/cnic";
import { formatPhoneInput } from "../../../../utils/phone";
import { StaffScreen } from "../shared/StaffScreen";
import { isAdminRole, useStaffSession } from "../shared/StaffSession";
import { useAsyncData } from "../shared/hooks";

type Route = RouteProp<StaffStackParamList, "RoomAccess">;

/**
 * People and door access of one booked space (AttendantController). Adding a person follows the capacity rule:
 * a free seat = assign; full room = a sales executive asks an admin (capacity request), an admin overfills a
 * private office after confirming the surcharge, never a meeting room / shared space. Admins approve or reject
 * the room's requests here; the person who asked (or an admin) can withdraw one. Also: door access on / off,
 * remove a person, the challan-based suspension with temporary access, and the room's challans.
 */
export default function RoomAccessScreen() {
  const { params } = useRoute<Route>();
  const toast = useToast();
  const colors = useThemeColors();
  const { role, refreshBadges } = useStaffSession();
  const { user } = useAuth();
  const isAdmin = isAdminRole(role);
  const { bookingDetailId, customerId } = params;

  const fetcher = useCallback(async () => {
    const [capacity, people, requests, suspension, challans] = await Promise.all([
      checkRoomCapacity(bookingDetailId),
      getRoomAttendants(bookingDetailId),
      listCapacityRequests({ status: "Pending", bookingDetailId }),
      getAccessSuspension(bookingDetailId).catch(() => null),
      getRoomChallans(bookingDetailId).catch(() => null),
    ]);
    return { capacity, people, requests, suspension, challans };
  }, [bookingDetailId]);
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData(fetcher);

  const [adding, setAdding] = useState(false);
  const [surcharge, setSurcharge] = useState<{ check: CapacityCheck; personId: number } | null>(null);
  const [removing, setRemoving] = useState<RoomAttendant | null>(null);
  const [approving, setApproving] = useState<CapacityRequest | null>(null);
  const [rejecting, setRejecting] = useState<CapacityRequest | null>(null);
  const [extending, setExtending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const capacity = data?.capacity;
  const used = data?.people.length ?? 0;
  const roomFull = !!capacity && capacity.roomCapacity > 0 && used >= capacity.roomCapacity;

  const finish = (message: string) => {
    toast.success(message);
    refresh();
    refreshBadges();
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

  /** After the person exists: decide with a fresh capacity check (CMS processBookingAssignment). */
  const addPerson = async (personId: number): Promise<string | null> => {
    const check = await checkRoomCapacity(bookingDetailId);
    const action = addPersonAction(check, role);
    if (action === "assign") return (await assignAttendant(bookingDetailId, { personId, customerId })).message;
    if (action === "request-approval") return (await requestCapacityApproval(bookingDetailId, { personId, customerId })).message;
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        >
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
          {roomFull && !isAdmin ? (
            <Card variant="filled">
              <AppText variant="bodySmall" color="textSecondary">
                This room is full. Adding someone sends a request to an admin to approve.
              </AppText>
            </Card>
          ) : null}
          {data.people.length === 0 ? (
            <EmptyState compact icon="people-outline" title="Nobody added yet" message="Add the people who use this space so they can open the doors." />
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
                          run(
                            `access-${p.personId}`,
                            async () => (await setDoorAccess({ bookingDetailId, customerId, personId: p.personId, isEnabled: v })).message,
                            "Could not change door access.",
                          );
                        }}
                        trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
                        thumbColor={p.isEnabled ? colors.primary : colors.surfaceAlt}
                        accessibilityLabel={`Door access for ${p.name}`}
                      />
                      <Button title="Remove" variant="ghost" size="sm" onPress={() => setRemoving(p)} accessibilityLabel={`Remove ${p.name}`} />
                    </View>
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
          customerId={customerId}
          inRoom={data?.people.map((p) => p.personId) ?? []}
          requestOnly={roomFull && !isAdmin}
          onClose={() => setAdding(false)}
          addPerson={addPerson}
          onDone={(message) => {
            setAdding(false);
            if (message) finish(message);
            else refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
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
        onCancel={() => setSurcharge(null)}
        onConfirm={async () => {
          if (!surcharge) return;
          const ok = await run("surcharge", async () => (await assignAttendant(bookingDetailId, { personId: surcharge.personId, customerId })).message, "Could not add the person.");
          if (ok) setSurcharge(null);
        }}
      />
      <ConfirmDialog
        visible={!!removing}
        title="Remove this person?"
        message={removing ? `${removing.name} loses door access to this space today.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={busy === "remove"}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const ok = await run("remove", async () => (await removeAttendant(bookingDetailId, removing.personId)).message, "Could not remove the person.");
          if (ok) setRemoving(null);
        }}
      />
      <ConfirmDialog
        visible={!!approving}
        title="Approve this request?"
        message={approving ? `${approving.personName} is added to the room. Over-capacity charges apply.` : undefined}
        confirmLabel="Approve"
        icon="checkmark-circle-outline"
        loading={busy === "approve"}
        onCancel={() => setApproving(null)}
        onConfirm={async () => {
          if (!approving) return;
          const ok = await run("approve", async () => (await approveCapacityRequest(approving.id)).message, "Could not approve the request.");
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
    </StaffScreen>
  );
}

function AddPersonSheet({
  customerId,
  inRoom,
  requestOnly,
  onClose,
  addPerson,
  onDone,
}: {
  customerId: number;
  inRoom: number[];
  requestOnly: boolean;
  onClose: () => void;
  addPerson: (personId: number) => Promise<string | null>;
  onDone: (message: string | null) => void;
}) {
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
      if (mode === "new") id = (await createAttendant({ customerId, name, email, phone, idType, idNumber })).data.personId;
      if (!id) throw new Error("The person could not be created. Please try again.");
      onDone(await addPerson(id));
    } catch (err) {
      setError(errorMessage(err, "Could not add the person."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissible={!saving}
      title={requestOnly ? "Request to add a person" : "Add a person"}
      subtitle={requestOnly ? "The room is full, so an admin is asked to approve." : undefined}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title={requestOnly ? "Send request" : "Add"} onPress={submit} loading={saving} style={styles.flex} />
        </>
      }
    >
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
      <FieldMessage error={error} />
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
      <FieldMessage error={error} />
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
      <FieldMessage error={error} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gapTop: { marginTop: spacing.xs },
  alignStart: { alignSelf: "flex-start", marginTop: spacing.sm },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  personActions: { alignItems: "flex-end", gap: 2 },
  requestActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
