import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  AsyncList,
  BottomSheet,
  Button,
  Card,
  DateField,
  FilterChips,
  IconButton,
  SegmentedControl,
  StatusPill,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { InquiryFilter, StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  INQUIRY_STATUS_LABELS,
  createTourInquiry,
  getTourInquiries,
  saveInquiryFeedback,
  toApiDate,
  updateInquiryStatus,
  type InquiryOutcome,
  type TourInquiry,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatRelative } from "../../../../utils/format";
import { inquiryFeedbackText, isNewInquiry, whatsappNumber } from "../../../../utils/inquiry";
import { phoneError, formatPhoneInput } from "../../../../utils/phone";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "TourInquiries">;
const PAGE_SIZE = 50;

/**
 * Tour inquiries (GET contact?page=&limit=&search=) with their latest feedback. Like the CMS: follow-ups that are
 * due come first; feedback (POST contact/{id}/feedback) = not interested (reason), future prospect (follow-up
 * date) or converted (create the quotation); staff can add a phone / walk-in inquiry (POST book-tour).
 */
export default function InquiryListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { refreshBadges } = useStaffSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InquiryFilter>(route.params?.filter ?? "all");
  const [feedbackFor, setFeedbackFor] = useState<TourInquiry | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const search = useDebounced(query.trim());

  const fetchPage = useCallback(
    async (page: number) => {
      const res = await getTourInquiries(page, PAGE_SIZE, search || undefined);
      return { items: res.items, total: res.total, page, limit: PAGE_SIZE, hasMore: page * PAGE_SIZE < res.total };
    },
    [search],
  );
  const list = usePagedList(fetchPage);

  const due = useMemo(() => list.items.filter((i) => i.followUpDue), [list.items]);
  const fresh = useMemo(() => list.items.filter(isNewInquiry), [list.items]);
  const rows = useMemo(() => {
    if (filter === "due") return due;
    if (filter === "new") return fresh;
    return [...list.items].sort((a, b) => Number(b.followUpDue) - Number(a.followUpDue));
  }, [filter, list.items, due, fresh]);

  // The filters work on the loaded pages (as in the CMS). While one is on, keep loading pages until enough
  // rows match or everything is loaded, so "No follow-ups due" never hides rows on later pages.
  const { hasMore, loading, loadingMore, error, loadMore } = list;
  useEffect(() => {
    if (filter !== "all" && rows.length < 10 && hasMore && !loading && !loadingMore && !error) loadMore();
  }, [filter, rows.length, hasMore, loading, loadingMore, error, loadMore]);

  const afterChange = (message: string) => {
    toast.success(message);
    list.refresh();
    refreshBadges();
  };

  const convert = (item: TourInquiry) =>
    navigation.navigate("QuotationForm", {
      fromInquiry: { inquiryId: item.id, publicId: item.publicId, name: item.fullName, email: item.email, phone: item.phone },
    });

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Tour inquiries"
        subtitle={list.total ? `${list.total} inquiries` : undefined}
        actions={[{ icon: "add", accessibilityLabel: "Add inquiry", onPress: () => setAdding(true) }]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, email or phone" />
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { label: "All", value: "all" },
          { label: "Follow-ups due", value: "due", count: due.length },
          { label: "New", value: "new", count: fresh.length },
        ]}
        accessibilityLabel="Inquiry filter"
        style={styles.chipBar}
        contentContainerStyle={styles.chips}
      />
      <AsyncList
        data={rows}
        keyExtractor={(i) => String(i.id ?? i.publicId)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{
          icon: "walk-outline",
          title: filter === "due" ? "No follow-ups due" : filter === "new" ? "No new inquiries" : "No inquiries",
          message: filter === "all" ? "Tour requests from the website and app show up here." : undefined,
        }}
        renderItem={({ item }) => <InquiryCard item={item} onFeedback={() => setFeedbackFor(item)} onConvert={() => convert(item)} />}
      />

      {feedbackFor ? (
        <FeedbackSheet
          item={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onConvert={() => {
            const item = feedbackFor;
            setFeedbackFor(null);
            convert(item);
          }}
          onSaved={(message) => {
            setFeedbackFor(null);
            afterChange(message);
          }}
        />
      ) : null}
      {adding ? (
        <AddInquirySheet
          onClose={() => setAdding(false)}
          onSaved={(message) => {
            setAdding(false);
            afterChange(message);
          }}
        />
      ) : null}
    </StaffScreen>
  );
}

function InquiryCard({ item, onFeedback, onConvert }: { item: TourInquiry; onFeedback: () => void; onConvert: () => void }) {
  const feedback = inquiryFeedbackText(item);
  const status = item.followUpDue ? "Follow-up due" : INQUIRY_STATUS_LABELS[item.statusId] ?? "New";
  const tone = item.followUpDue ? "warning" : undefined;
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.fullName || item.email || "Visitor"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[item.phone, item.email].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        <StatusPill status={status} tone={tone} />
      </View>
      {item.message ? (
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={3} style={styles.gapTop}>
          {item.message}
        </AppText>
      ) : null}
      {feedback ? (
        <AppText variant="caption" color={item.followUpDue ? "warning" : "textMuted"} style={styles.gapTop}>
          {feedback}
        </AppText>
      ) : null}
      <View style={[styles.row, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          {formatRelative(item.createdAt)}
        </AppText>
        {item.phone ? (
          <>
            <IconButton icon="call-outline" accessibilityLabel={`Call ${item.fullName}`} variant="tonal" onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => undefined)} />
            <IconButton
              icon="logo-whatsapp"
              accessibilityLabel={`WhatsApp ${item.fullName}`}
              variant="tonal"
              onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber(item.phone)}`).catch(() => undefined)}
            />
          </>
        ) : null}
        {item.feedbackOutcome !== "converted" ? (
          <IconButton icon="document-text-outline" accessibilityLabel="Create quotation" variant="tonal" onPress={onConvert} />
        ) : null}
        <Button title="Feedback" size="sm" variant="outline" onPress={onFeedback} />
      </View>
    </Card>
  );
}

const OUTCOMES: { label: string; value: InquiryOutcome }[] = [
  { label: "Not interested", value: "not_interested" },
  { label: "Follow up", value: "future_prospect" },
  { label: "Converted", value: "converted" },
];

function FeedbackSheet({
  item,
  onClose,
  onSaved,
  onConvert,
}: {
  item: TourInquiry;
  onClose: () => void;
  onSaved: (m: string) => void;
  onConvert: () => void;
}) {
  const [outcome, setOutcome] = useState<InquiryOutcome>(item.feedbackOutcome === "converted" ? "converted" : item.feedbackOutcome ?? "future_prospect");
  const [reason, setReason] = useState(item.feedbackReason ?? "");
  const [followUp, setFollowUp] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (outcome === "not_interested" && !reason.trim()) return setError("Enter the reason the customer is not interested.");
    if (outcome === "future_prospect" && !followUp) return setError("Choose the follow-up date.");
    setSaving(true);
    setError(null);
    try {
      const message = await saveInquiryFeedback(item, {
        outcome,
        reason: outcome === "not_interested" ? reason : null,
        followUpOn: outcome === "future_prospect" && followUp ? toApiDate(followUp) : null,
      });
      onSaved(message);
    } catch (err) {
      setError(errorMessage(err, "Could not save the feedback."));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (statusId: number) => {
    if (!item.id) return;
    setSaving(true);
    setError(null);
    try {
      onSaved((await updateInquiryStatus(item.id, statusId)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not change the status."));
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
      title="Inquiry feedback"
      subtitle={item.fullName || item.email}
      footer={
        outcome === "converted" ? (
          <Button title="Create the quotation" leftIcon="document-text-outline" onPress={onConvert} style={styles.flex} />
        ) : (
          <>
            <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
            <Button title="Save" onPress={save} loading={saving} style={styles.flex} />
          </>
        )
      }
    >
      <SegmentedControl accessibilityLabel="Outcome" options={OUTCOMES} value={outcome} onChange={(v) => {
        setOutcome(v);
        setError(null);
      }} />
      {outcome === "not_interested" ? (
        <TextField label="Reason" required value={reason} onChangeText={setReason} multiline rows={3} maxLength={1000} />
      ) : outcome === "future_prospect" ? (
        <DateField
          label="Follow up on"
          required
          value={followUp}
          onChange={setFollowUp}
          minimumDate={new Date()}
          helperText={item.followUpOn ? `Current follow-up: ${formatDate(item.followUpOn)}` : undefined}
        />
      ) : (
        <AppText variant="bodySmall" color="textSecondary">
          Create the quotation for this visitor. The inquiry is marked converted when the quotation is saved.
        </AppText>
      )}
      {item.id ? (
        <View style={styles.statusBlock}>
          <AppText variant="label" color="textSecondary">
            Or set the status
          </AppText>
          <FilterChips
            value={item.statusId}
            onChange={(v) => setStatus(v)}
            options={Object.entries(INQUIRY_STATUS_LABELS).map(([id, label]) => ({ label, value: Number(id) }))}
            scrollable={false}
            accessibilityLabel="Inquiry status"
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function AddInquirySheet({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter the visitor's name.";
    if (!phone.trim()) next.phone = "Enter the phone number.";
    else if (phoneError(phone)) next.phone = phoneError(phone) ?? undefined;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (next.name || next.phone || next.email) return;
    setSaving(true);
    try {
      onSaved(await createTourInquiry({ fullName: name, phone, email, message }));
    } catch (err) {
      setErrors({ form: errorMessage(err, "Could not add the inquiry.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      error={errors.form}
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Add tour inquiry"
      subtitle="A phone call or walk-in visitor."
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Add inquiry" onPress={save} loading={saving} style={styles.flex} />
        </>
      }
    >
      <TextField label="Full name" required value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
      <TextField ref={phoneRef} label="Phone" required value={phone} onChangeText={(t) => setPhone(formatPhoneInput(t))} error={errors.phone} keyboardType="phone-pad" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
      <TextField ref={emailRef} label="Email" value={email} onChangeText={(t) => setEmail(t.trim())} error={errors.email} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => messageRef.current?.focus()} />
      <TextField ref={messageRef} label="Message" value={message} onChangeText={setMessage} multiline rows={3} maxLength={1000} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  gapTop: { marginTop: spacing.sm },
  statusBlock: { gap: spacing.sm },
});
