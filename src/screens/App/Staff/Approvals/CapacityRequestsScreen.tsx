import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  FieldMessage,
  FilterChips,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  approveCapacityRequest,
  canDecideCapacityRequest,
  listCapacityRequests,
  rejectCapacityRequest,
  type CapacityRequest,
  type CapacityRequestStatus,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatRelative } from "../../../../utils/format";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Filter = CapacityRequestStatus | "all";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "Pending", value: "Pending" },
  { label: "Approved", value: "Approved" },
  { label: "Rejected", value: "Rejected" },
  { label: "Withdrawn", value: "Cancelled" },
  { label: "All", value: "all" },
];

/**
 * Approvals (admin / super admin): sales executives' requests to add people to full rooms
 * (GET capacity-requests?status=, rooms at the admin's locations). Approve adds the person (over-capacity charge
 * applies; POST .../approve), reject with an optional note (POST .../reject).
 */
export default function CapacityRequestsScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { role, refreshBadges } = useStaffSession();
  const [status, setStatus] = useState<Filter>("Pending");
  const [approving, setApproving] = useState<CapacityRequest | null>(null);
  const [rejecting, setRejecting] = useState<CapacityRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    const items = await listCapacityRequests({ status });
    return { items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }, [status]);
  const list = usePagedList(fetchPage);

  const done = (message: string) => {
    toast.success(message);
    list.refresh();
    refreshBadges();
  };

  const approve = async () => {
    if (!approving) return;
    setBusy(true);
    setApproveError(null);
    try {
      done((await approveCapacityRequest(approving.id)).message);
      setApproving(null);
    } catch (err) {
      setApproveError(errorMessage(err, "Could not approve the request."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader showBack={inTabs ? false : undefined} title="Approvals" subtitle="Requests to add people to full rooms" />
      <FilterChips value={status} onChange={setStatus} options={FILTERS} accessibilityLabel="Request status" style={styles.chipBar} contentContainerStyle={styles.chips} />
      <AsyncList
        key={list.listKey}
        data={list.items}
        keyExtractor={(r) => String(r.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        gap={8}
        empty={{
          icon: "checkmark-done-circle-outline",
          title: status === "Pending" ? "Nothing waiting" : "No requests",
          message: status === "Pending" ? "Requests from sales executives show up here." : undefined,
        }}
        renderItem={({ item: r }) => (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{r.personName}</AppText>
                <AppText variant="caption" color="textMuted">
                  {[r.spaceName, r.customerName].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              <StatusPill status={r.status === "Cancelled" ? "Withdrawn" : r.status} tone={r.status === "Cancelled" ? "neutral" : undefined} />
            </View>
            <AppText variant="bodySmall" color="textSecondary" style={styles.gapTop}>
              {r.currentAttendants} of {r.roomCapacity} seats used{r.spaceCategory ? ` · ${r.spaceCategory}` : ""}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.gapTop}>
              Asked by {r.requestedByEmail} · {formatRelative(r.requestedAt)}
            </AppText>
            {r.decidedByEmail ? (
              <AppText variant="caption" color="textMuted">
                {r.status} by {r.decidedByEmail} · {formatRelative(r.decidedAt)}
                {r.decisionNote ? `: ${r.decisionNote}` : ""}
              </AppText>
            ) : null}
            <View style={[styles.row, styles.actions]}>
              {canDecideCapacityRequest(r, role) ? (
                <>
                  <Button title="Approve" size="sm" leftIcon="checkmark" onPress={() => setApproving(r)} />
                  <Button title="Reject" size="sm" variant="danger" leftIcon="close" onPress={() => setRejecting(r)} />
                </>
              ) : null}
              <Button
                title="Open room"
                size="sm"
                variant="ghost"
                rightIcon="chevron-forward"
                onPress={() => navigation.navigate("RoomAccess", { bookingDetailId: r.bookingDetailId, customerId: r.customerId, spaceName: r.spaceName })}
              />
            </View>
          </Card>
        )}
      />
      <ConfirmDialog
        visible={!!approving}
        title="Approve this request?"
        message={approving ? `${approving.personName} is added to ${approving.spaceName}. The over-capacity charge is invoiced to the customer.` : undefined}
        confirmLabel="Approve"
        icon="checkmark-circle-outline"
        loading={busy}
        onCancel={() => {
          setApproving(null);
          setApproveError(null);
        }}
        onConfirm={approve}
      >
        <FieldMessage error={approveError} />
      </ConfirmDialog>
      {rejecting ? <RejectSheet request={rejecting} onClose={() => setRejecting(null)} onDone={(m) => {
        setRejecting(null);
        done(m);
      }} /> : null}
    </StaffScreen>
  );
}

function RejectSheet({ request, onClose, onDone }: { request: CapacityRequest; onClose: () => void; onDone: (m: string) => void }) {
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

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.xs },
  actions: { marginTop: spacing.sm, flexWrap: "wrap" },
});
