import { useCallback, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import {
  AppHeader,
  AppText,
  AsyncList,
  BottomSheet,
  Button,
  Card,
  Divider,
  FilterChips,
  InfoRow,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import { errorMessage } from "../../../../services/apiClient";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUS_OPTIONS,
  createComplaint,
  listComplaints,
  updateComplaintStatus,
  validateComplaintInput,
  type ComplaintStatus,
  type StaffComplaint,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDateTime, formatRelative } from "../../../../utils/format";
import { formatPhoneInput } from "../../../../utils/phone";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useDebounced, usePagedList } from "../shared/hooks";

const PAGE_SIZE = 20;
type Filter = ComplaintStatus | "all";

/**
 * Complaints (GET complaints?page=&limit=&search=&status=) from the WhatsApp chatbot and staff. Change the
 * status with notes (PATCH complaints/{id}/status; "Resolved" asks the customer on WhatsApp to confirm) and
 * record a complaint taken by phone or in person (POST complaints).
 */
export default function ComplaintListScreen() {
  const toast = useToast();
  const { refreshBadges } = useStaffSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const [selected, setSelected] = useState<StaffComplaint | null>(null);
  const [adding, setAdding] = useState(false);
  const search = useDebounced(query.trim());
  const fetchPage = useCallback(
    (page: number) => listComplaints({ page, limit: PAGE_SIZE, search, status: status === "all" ? null : status }),
    [search, status],
  );
  const list = usePagedList(fetchPage);

  const done = (message: string) => {
    setSelected(null);
    setAdding(false);
    toast.success(message);
    list.refresh();
    refreshBadges();
  };

  return (
    <StaffScreen>
      <AppHeader title="Complaints" subtitle={list.total ? `${list.total} complaints` : undefined} actions={[{ icon: "add", accessibilityLabel: "Record a complaint", onPress: () => setAdding(true) }]} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search number, customer, phone or text" />
      <FilterChips
        value={status}
        onChange={setStatus}
        options={[{ label: "All", value: "all" as Filter }, ...COMPLAINT_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value as Filter }))]}
        accessibilityLabel="Complaint status"
        style={styles.chipBar}
        contentContainerStyle={styles.chips}
      />
      <AsyncList
        data={list.items}
        keyExtractor={(c) => String(c.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ icon: "chatbox-ellipses-outline", title: status === "all" && !search ? "No complaints" : "No complaints found" }}
        renderItem={({ item }) => (
          <Card onPress={() => setSelected(item)} accessibilityLabel={`${item.complaintNo}, ${item.category}, ${item.statusLabel}`}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.category}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {[item.complaintNo, item.customerName || item.phoneNumber].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              <StatusPill status={item.status} label={item.statusLabel} />
            </View>
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={2} style={styles.gapTop}>
              {item.description}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.gapTop}>
              {[item.sourceLabel, formatRelative(item.createdOn)].join(" · ")}
            </AppText>
          </Card>
        )}
      />
      {selected ? <ComplaintSheet complaint={selected} onClose={() => setSelected(null)} onSaved={done} /> : null}
      {adding ? <NewComplaintSheet onClose={() => setAdding(false)} onSaved={done} /> : null}
    </StaffScreen>
  );
}

/** Complaint phones are stored as digits; WhatsApp ones in international form (92...) need a "+". */
function dialable(phone: string): string {
  const p = phone.trim();
  if (p.startsWith("+") || p.startsWith("0")) return p;
  return /^92\d{10}$/.test(p) ? `+${p}` : p;
}

function ComplaintSheet({ complaint: c, onClose, onSaved }: { complaint: StaffComplaint; onClose: () => void; onSaved: (m: string) => void }) {
  const [status, setStatus] = useState<ComplaintStatus>((COMPLAINT_STATUS_OPTIONS.find((o) => o.value === c.status)?.value ?? "open") as ComplaintStatus);
  const [notes, setNotes] = useState(c.staffNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved((await updateComplaintStatus(c.id, status, notes)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not update the complaint."));
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
      title={c.category}
      subtitle={c.complaintNo}
      footer={
        <>
          <Button title="Close" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Save" onPress={save} loading={saving} style={styles.flex} />
        </>
      }
    >
      <AppText>{c.description}</AppText>
      <Divider />
      {c.customerName ? <InfoRow label="Customer" value={c.customerName} icon="person-outline" /> : null}
      {c.phoneNumber ? (
        <InfoRow
          label="Phone"
          icon="call-outline"
          value={<Button title={c.phoneNumber} variant="ghost" size="sm" onPress={() => Linking.openURL(`tel:${dialable(c.phoneNumber as string)}`).catch(() => undefined)} />}
        />
      ) : null}
      {c.email ? <InfoRow label="Email" value={c.email} icon="mail-outline" /> : null}
      {c.branch ? <InfoRow label="Branch" value={c.branch} icon="location-outline" /> : null}
      <InfoRow label="Source" value={c.sourceLabel} />
      <InfoRow label="Reported" value={formatDateTime(c.createdOn)} />
      {c.replyLabel !== "-" ? <InfoRow label="Customer reply" value={c.replyLabel} /> : null}
      <SelectField
        label="Status"
        required
        value={status}
        options={COMPLAINT_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        onChange={(v) => setStatus(v as ComplaintStatus)}
        helperText={status === "resolved" ? "The customer is asked on WhatsApp to confirm it is fixed." : undefined}
      />
      <TextField label="Staff notes" value={notes} onChangeText={setNotes} multiline rows={3} maxLength={1000} />
    </BottomSheet>
  );
}

function NewComplaintSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const input = { category: category ?? "", description, customerName, phoneNumber: phone, email, branch };
    const invalid = validateComplaintInput(input);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      onSaved((await createComplaint(input)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not record the complaint."));
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
      title="Record a complaint"
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Save" onPress={save} loading={saving} style={styles.flex} />
        </>
      }
    >
      <SelectField label="Category" required value={category} options={COMPLAINT_CATEGORIES.map((c) => ({ label: c, value: c }))} onChange={setCategory} />
      <TextField label="What happened" required value={description} onChangeText={setDescription} multiline rows={4} maxLength={2000} />
      <TextField label="Customer name" value={customerName} onChangeText={setCustomerName} autoCapitalize="words" maxLength={200} />
      <TextField label="Phone" value={phone} onChangeText={(t) => setPhone(formatPhoneInput(t))} keyboardType="phone-pad" />
      <TextField label="Email" value={email} onChangeText={(t) => setEmail(t.trim())} keyboardType="email-address" autoCapitalize="none" maxLength={256} />
      <TextField label="Branch" value={branch} onChangeText={setBranch} maxLength={50} placeholder="e.g. I-8" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.xs },
});
