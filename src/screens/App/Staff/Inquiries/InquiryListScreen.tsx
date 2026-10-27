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
import { useAuth } from "../../../../context/AuthContext";
import { greetingName } from "../../../../context/userDisplay";
import { errorMessage } from "../../../../services/apiClient";
import {
  INQUIRY_STATUS_LABELS,
  branchDisplayName,
  branchFilterOptions,
  branchFilterParam,
  canMoveBranch,
  chosenBranchId,
  createTourInquiry,
  getInquiryWhatsAppMessage,
  getTourInquiries,
  inquiryPath,
  saveInquiryFeedback,
  toApiDate,
  updateInquiryLocation,
  updateInquiryStatus,
  type InquiryCategory,
  type InquiryOutcome,
  type StaffInquiryType,
  type StaffLocation,
  type TourInquiry,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatRelative } from "../../../../utils/format";
import { MAX_CONTENT_WIDTH, estimateButtonWidth, scaledMinWidth, useResponsive } from "../../../../utils/responsive";
import {
  canContactByPhone,
  inquiryCategoryOptions,
  inquiryCategoryParam,
  inquiryFeedbackText,
  inquiryRowKey,
  inquiryTypeText,
  inquiryWhatsAppMessage,
  isNewInquiry,
  resolveWhatsAppUrl,
  whatsappChatUrl,
} from "../../../../utils/inquiry";
import { phoneError, formatPhoneInput } from "../../../../utils/phone";
import { BranchField, BranchLine, BranchPicker, useBranchChoice } from "../shared/Branch";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";
import { useDebounced, usePagedList, useSingleFlight } from "../shared/hooks";
import { useShortWindow } from "../shared/layout";
import { uniqueBy } from "../shared/guards";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "TourInquiries">;
const PAGE_SIZE = 50;
/** AsyncList's default content padding (dp). */
const LIST_PADDING = 16;

/**
 * Tour inquiries (GET contact?page=&limit=&search=&locationId=) with their latest feedback. Like the CMS: follow-ups
 * that are due come first; feedback (POST contact/{id}/feedback) = not interested (reason), future prospect
 * (follow-up date) or converted (create the quotation); staff can add a phone / walk-in inquiry (POST book-tour).
 * Branch routing: the API lists the user's locations plus inquiries with no branch; each row shows its branch, a
 * location filter appears for users who see more than one location ("No branch" = only those without one), and
 * staff can set or change the branch (PATCH contact/{publicId}/location) of the inquiries the API allows
 * (canChangeBranch: not the old website bookings). Old website bookings and newer inquiries can share an id, so rows
 * are keyed by the API's key and every write goes by public id (or id + source).
 * Two sub-tabs, as the CMS: Tour inquiries and Simple inquiries (category=general: WhatsApp customers who typed free
 * text instead of using the bot menu), each with its New count from the nav badges; same rows and actions. Staff add
 * tour inquiries only, so the add action is on the Tour tab. Route / link param category "general" opens Simple.
 */
export default function InquiryListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { role, profile, navBadges, refreshBadges } = useStaffSession();
  const { user } = useAuth();
  const staffName = greetingName(user);
  // Reference inquiries: referred by the signed-in staff member unless another name is typed (as the CMS).
  const staffFullName = (profile?.name || (typeof user?.name === "string" ? user.name : "") || user?.email || "").trim();
  const { choice: branches, locations } = useBranchChoice();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InquiryFilter>(route.params?.filter ?? "all");
  const routeCategory = route.params?.category;
  const [category, setCategory] = useState<InquiryCategory>(inquiryCategoryParam(routeCategory));
  // A link while the screen is open (the Inquiries tab stays mounted) brings a new param: follow it.
  useEffect(() => {
    if (routeCategory) setCategory(inquiryCategoryParam(routeCategory));
  }, [routeCategory]);
  const categoryOptions = useMemo(() => inquiryCategoryOptions(navBadges), [navBadges]);
  const [locationFilter, setLocationFilter] = useState(0);
  const [feedbackFor, setFeedbackFor] = useState<TourInquiry | null>(null);
  const [branchFor, setBranchFor] = useState<TourInquiry | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const search = useDebounced(query.trim());
  const locationFilters = useMemo(() => branchFilterOptions(role, locations), [role, locations]);
  const locationId = locationFilters.some((o) => o.value === locationFilter) ? locationFilter : 0;

  const fetchPage = useCallback(
    async (page: number) => {
      const res = await getTourInquiries(
        page,
        PAGE_SIZE,
        search || undefined,
        branchFilterParam(locationId),
        category === "general" ? "general" : undefined,
      );
      return { items: res.items, total: res.total, page, limit: PAGE_SIZE, hasMore: page * PAGE_SIZE < res.total };
    },
    [search, locationId, category],
  );
  const list = usePagedList(fetchPage);

  // Pages can overlap when inquiries arrive between loads: each inquiry once (and unique list keys).
  const items = useMemo(() => uniqueBy(list.items, inquiryRowKey), [list.items]);
  const due = useMemo(() => items.filter((i) => i.followUpDue), [items]);
  const fresh = useMemo(() => items.filter(isNewInquiry), [items]);
  const rows = useMemo(() => {
    if (filter === "due") return due;
    if (filter === "new") return fresh;
    return [...items].sort((a, b) => Number(b.followUpDue) - Number(a.followUpDue));
  }, [filter, items, due, fresh]);

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

  const openQuotation = (quotationId: number) => navigation.navigate("QuotationDetail", { quotationId });

  const convert = (item: TourInquiry) =>
    navigation.navigate("QuotationForm", {
      fromInquiry: {
        inquiryId: item.id,
        publicId: item.publicId,
        source: item.source,
        name: item.fullName,
        email: item.email,
        phone: item.phone,
      },
    });

  // A short window (phone in landscape, large text on a small phone): the search and filters scroll away with the
  // list instead of taking most of the height above it.
  const short = useShortWindow();
  const filters = (
    <>
      <View style={styles.segment}>
        <SegmentedControl accessibilityLabel="Inquiry list" options={categoryOptions} value={category} onChange={setCategory} />
      </View>
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
      {locationFilters.length ? (
        <FilterChips
          value={locationId}
          onChange={setLocationFilter}
          options={locationFilters}
          accessibilityLabel="Location filter"
          style={styles.chipBar}
          contentContainerStyle={styles.chips}
        />
      ) : null}
    </>
  );

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Tour inquiries"
        subtitle={list.total ? `${list.total} ${category === "general" ? "simple " : ""}inquiries` : undefined}
        actions={category === "tour" ? [{ icon: "add", accessibilityLabel: "Add inquiry", onPress: () => setAdding(true) }] : undefined}
      />
      {short ? null : filters}
      <AsyncList
        ListHeaderComponent={short ? filters : undefined}
        ListHeaderComponentStyle={short ? styles.listHeader : undefined}
        data={rows}
        keyExtractor={(i, index) => inquiryRowKey(i, index)}
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
          illustration: "inbox",
          title: filter === "due" ? "No follow-ups due" : filter === "new" ? "No new inquiries" : "No inquiries",
          message:
            filter !== "all"
              ? undefined
              : category === "general"
                ? "WhatsApp customers who type a question instead of choosing from the menu show up here."
                : "Tour requests from the website and app show up here.",
        }}
        renderItem={({ item }) => (
          <InquiryCard
            item={item}
            branch={branchDisplayName({ locationId: item.locationId, name: item.locationName }, locations)}
            staffName={staffName}
            onSetBranch={
              item.canChangeBranch && item.publicId && canMoveBranch(item.locationId, branches.options) ? () => setBranchFor(item) : undefined
            }
            onFeedback={() => setFeedbackFor(item)}
            onConvert={() => convert(item)}
          />
        )}
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
          onOpenQuotation={(quotationId) => {
            setFeedbackFor(null);
            openQuotation(quotationId);
          }}
          onSaved={(message) => {
            setFeedbackFor(null);
            afterChange(message);
          }}
        />
      ) : null}
      {branchFor ? (
        <InquiryBranchSheet
          item={branchFor}
          options={branches.options}
          onClose={() => setBranchFor(null)}
          onSaved={(message) => {
            setBranchFor(null);
            afterChange(message);
          }}
        />
      ) : null}
      {adding ? (
        <AddInquirySheet
          staffName={staffFullName}
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

function InquiryCard({
  item,
  branch,
  staffName,
  onSetBranch,
  onFeedback,
  onConvert,
}: {
  item: TourInquiry;
  /** The signed-in staff member's first name, for the app's own WhatsApp greeting (used when the API can't answer). */
  staffName: string;
  /** Branch name; null = no branch. */
  branch: string | null;
  /** Set when the user may set / change the branch. */
  onSetBranch?: () => void;
  onFeedback: () => void;
  onConvert: () => void;
}) {
  const feedback = inquiryFeedbackText(item);
  const type = inquiryTypeText(item);
  const phoneOk = canContactByPhone(item.phone);
  const status = item.followUpDue ? "Follow-up due" : INQUIRY_STATUS_LABELS[item.statusId] ?? "New";
  const tone = item.followUpDue ? "warning" : undefined;
  const { fontScale, isLargeText } = useResponsive();
  // The branch name keeps at least this much room beside "Change branch"; with less (320dp phone, large text) the
  // button goes under it instead of squeezing the name to a few letters.
  const branchMinWidth = { flexBasis: scaledMinWidth(BRANCH_MIN_WIDTH, fontScale) };

  // WhatsApp: the message the API fills in from the CMS template (GET contact/{publicId}/whatsapp-message). Without
  // a public id, or when the call fails (offline, an older API) or sends no link, the app's own greeting opens instead,
  // so the button always works and shows no error. Only this button is busy meanwhile; a second tap is ignored.
  const [openingWhatsApp, setOpeningWhatsApp] = useState(false);
  const openWhatsApp = useSingleFlight(async () => {
    setOpeningWhatsApp(true);
    try {
      const url = await resolveWhatsAppUrl(
        item.publicId ? () => getInquiryWhatsAppMessage(item) : null,
        whatsappChatUrl(item.phone, inquiryWhatsAppMessage(item.fullName, staffName)),
      );
      await Linking.openURL(url).catch(() => undefined);
    } finally {
      setOpeningWhatsApp(false);
    }
  });

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={isLargeText ? 2 : 1}>
            {item.fullName || item.email || "Visitor"}
          </AppText>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {[item.phone, item.email].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        <StatusPill status={status} tone={tone} />
      </View>
      {type ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.gapTop}>
          {`Type: ${type}`}
        </AppText>
      ) : null}
      <View style={[styles.wrapRow, styles.gapTop]}>
        <BranchLine name={branch} style={[styles.branchLine, branchMinWidth]} />
        {onSetBranch ? (
          <Button
            title={branch ? "Change branch" : "Set branch"}
            size="sm"
            variant="ghost"
            onPress={onSetBranch}
            accessibilityLabel={`${branch ? "Change" : "Set"} the branch of ${item.fullName || item.email || "this inquiry"}`}
          />
        ) : null}
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
      {/* Time on the left, the actions on the right; when both don't fit (most phones with all four actions, large
          text) the actions go to their own line, and they wrap themselves on a very narrow card. */}
      <View style={[styles.wrapRow, styles.gapTop]}>
        <AppText variant="caption" color="textMuted" style={styles.grow}>
          {formatRelative(item.createdAt)}
        </AppText>
        <View style={styles.cardActions}>
          {phoneOk ? (
            <>
              <IconButton icon="call-outline" accessibilityLabel={`Call ${item.fullName}`} variant="tonal" onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => undefined)} />
              <IconButton
                icon="logo-whatsapp"
                accessibilityLabel={`WhatsApp ${item.fullName}`}
                variant="tonal"
                loading={openingWhatsApp}
                onPress={openWhatsApp}
              />
            </>
          ) : null}
          {item.feedbackOutcome !== "converted" ? (
            <IconButton icon="document-text-outline" accessibilityLabel="Create quotation" variant="tonal" onPress={onConvert} />
          ) : null}
          <Button title="Feedback" size="sm" variant="outline" onPress={onFeedback} />
        </View>
      </View>
    </Card>
  );
}

/** Narrowest the branch name gets beside the "Change branch" button (font scale 1, dp). */
const BRANCH_MIN_WIDTH = 140;

/** BottomSheet's side padding (dp). */
const SHEET_SIDE_PADDING = 20;

/**
 * A footer button's label, or its shorter form when the full one would not fit the sheet's width (320dp phone,
 * large text): a Button label is one line, so a long one would be cut.
 */
function fittingLabel(full: string, short: string, width: number, fontScale: number): string {
  const available = Math.min(width, MAX_CONTENT_WIDTH) - 2 * SHEET_SIDE_PADDING;
  return estimateButtonWidth(full, fontScale, true) <= available ? full : short;
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
  onOpenQuotation,
}: {
  item: TourInquiry;
  onClose: () => void;
  onSaved: (m: string) => void;
  onConvert: () => void;
  /** Opens the quotation an inquiry was converted into. */
  onOpenQuotation: (quotationId: number) => void;
}) {
  const { width, fontScale } = useResponsive();
  // Already converted: no second quotation from here; the linked one can be opened instead.
  const converted = item.feedbackOutcome === "converted";
  const canSetStatus = !!inquiryPath(item, "status");
  const [outcome, setOutcome] = useState<InquiryOutcome>(item.feedbackOutcome === "converted" ? "converted" : item.feedbackOutcome ?? "future_prospect");
  const [reason, setReason] = useState(item.feedbackReason ?? "");
  const [followUp, setFollowUp] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Saving feedback and the status chips share one guard: a second tap while a request runs is ignored.
  const save = useSingleFlight(async () => {
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
  });

  const setStatus = useSingleFlight(async (statusId: number) => {
    if (!canSetStatus || saving) return;
    setSaving(true);
    setError(null);
    try {
      onSaved((await updateInquiryStatus(item, statusId)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not change the status."));
    } finally {
      setSaving(false);
    }
  });

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
          converted ? (
            item.quotationId ? (
              <Button
                title={fittingLabel(`Open quotation #${item.quotationId}`, `Quotation #${item.quotationId}`, width, fontScale)}
                leftIcon="document-text-outline"
                onPress={() => item.quotationId && onOpenQuotation(item.quotationId)}
                accessibilityLabel={`Open quotation #${item.quotationId}`}
                style={styles.flex}
                textStyle={styles.shrink}
              />
            ) : (
              <Button title="Close" variant="outline" onPress={onClose} style={styles.flex} />
            )
          ) : (
            <Button
              title={fittingLabel("Create the quotation", "Create quotation", width, fontScale)}
              leftIcon="document-text-outline"
              onPress={onConvert}
              accessibilityLabel="Create the quotation"
              style={styles.flex}
              textStyle={styles.shrink}
            />
          )
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
      ) : converted ? (
        <AppText variant="bodySmall" color="textSecondary">
          {item.quotationId
            ? `This inquiry was converted to quotation #${item.quotationId}.`
            : "This inquiry was already converted to a quotation."}
        </AppText>
      ) : (
        <AppText variant="bodySmall" color="textSecondary">
          Create the quotation for this visitor. The inquiry is marked converted when the quotation is saved.
        </AppText>
      )}
      {canSetStatus ? (
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

/** Set or change an inquiry's branch: a picker of the branches the user may choose (one: chosen already). */
function InquiryBranchSheet({
  item,
  options,
  onClose,
  onSaved,
}: {
  item: TourInquiry;
  options: StaffLocation[];
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [picked, setPicked] = useState<number | null>(item.locationId ?? (options.length === 1 ? options[0].id : null));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useSingleFlight(async () => {
    const id = chosenBranchId({ options, fixed: null }, picked);
    if (id == null) return setError("Choose the branch.");
    if (id === item.locationId) return onClose();
    setSaving(true);
    setError(null);
    try {
      onSaved((await updateInquiryLocation(item, id)).message);
    } catch (err) {
      setError(errorMessage(err, "Could not change the branch."));
    } finally {
      setSaving(false);
    }
  });

  return (
    <BottomSheet
      error={error}
      visible
      onClose={onClose}
      dismissible={!saving}
      title={item.locationId ? "Change branch" : "Set branch"}
      subtitle={item.fullName || item.email}
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Save" onPress={save} loading={saving} style={styles.flex} />
        </>
      }
    >
      <BranchPicker
        required
        options={options}
        value={picked}
        onChange={(id) => {
          setPicked(id);
          setError(null);
        }}
        helperText="The inquiry goes to the staff of this branch."
      />
    </BottomSheet>
  );
}

const ADD_TYPES: { label: string; value: StaffInquiryType }[] = [
  { label: "Walk-In", value: "WalkIn" },
  { label: "Reference", value: "Reference" },
];

function AddInquirySheet({
  staffName,
  onClose,
  onSaved,
}: {
  /** The signed-in staff member's full name: the default "Referred by" of a Reference inquiry. */
  staffName: string;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const { choice, loading: branchesLoading, error: branchesError } = useBranchChoice();
  const [type, setType] = useState<StaffInquiryType>("WalkIn");
  const [referenceName, setReferenceName] = useState(staffName);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [branch, setBranch] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; branch?: string; reference?: string; form?: string }>({});
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
    const locationId = chosenBranchId(choice, branch);
    if (locationId == null) next.branch = "Choose the branch.";
    if (type === "Reference" && !referenceName.trim()) next.reference = "Enter who referred the visitor.";
    setErrors(next);
    if (next.name || next.phone || next.email || next.branch || next.reference) return;
    setSaving(true);
    try {
      onSaved(
        await createTourInquiry({
          fullName: name,
          phone,
          email,
          message,
          locationId,
          inquiryType: type,
          referenceName: type === "Reference" ? referenceName : null,
        }),
      );
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
      subtitle="A visitor who walked in, called or was referred."
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={saving} style={styles.flex} />
          <Button title="Add inquiry" onPress={save} loading={saving} style={styles.flex} />
        </>
      }
    >
      <SegmentedControl
        accessibilityLabel="Where the visitor came from"
        options={ADD_TYPES}
        value={type}
        onChange={(v) => {
          setType(v);
          setErrors((e) => ({ ...e, reference: undefined }));
        }}
      />
      {type === "Reference" ? (
        <TextField
          label="Referred by"
          required
          value={referenceName}
          onChangeText={(t) => {
            setReferenceName(t);
            setErrors((e) => ({ ...e, reference: undefined }));
          }}
          error={errors.reference}
          autoCapitalize="words"
          maxLength={200}
          helperText="You, unless someone else referred the visitor."
        />
      ) : null}
      <TextField label="Full name" required value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
      <TextField ref={phoneRef} label="Phone" required value={phone} onChangeText={(t) => setPhone(formatPhoneInput(t))} error={errors.phone} keyboardType="phone-pad" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
      <TextField ref={emailRef} label="Email" value={email} onChangeText={(t) => setEmail(t.trim())} error={errors.email} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => messageRef.current?.focus()} />
      <BranchField
        choice={choice}
        value={branch}
        onChange={(id) => {
          setBranch(id);
          setErrors((e) => ({ ...e, branch: undefined }));
        }}
        loading={branchesLoading}
        loadError={branchesError}
        error={errors.branch}
      />
      <TextField ref={messageRef} label="Message" value={message} onChangeText={setMessage} multiline rows={3} maxLength={1000} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0, flexShrink: 0 },
  segment: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  // The filters as the list's header: over the list's padding, so they look as they do pinned above it.
  listHeader: { marginHorizontal: -LIST_PADDING, marginTop: -LIST_PADDING, paddingBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // A row whose second part moves to its own line when both don't fit.
  wrapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: spacing.xs },
  branchLine: { flexGrow: 1, flexShrink: 1 },
  grow: { flexGrow: 1, flexShrink: 1 },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    flexGrow: 1,
    flexShrink: 1,
  },
  flex: { flex: 1 },
  // A button label that ends in "..." rather than being cut at both sides if it is still too long.
  shrink: { flexShrink: 1 },
  gapTop: { marginTop: spacing.sm },
  statusBlock: { gap: spacing.sm },
});
