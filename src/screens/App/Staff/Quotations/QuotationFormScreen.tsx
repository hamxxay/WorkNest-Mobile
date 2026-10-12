import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  DateField,
  Divider,
  ErrorState,
  InfoRow,
  ListSkeleton,
  SectionHeader,
  SegmentedControl,
  SelectField,
  TextField,
  useToast,
} from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { errorMessage } from "../../../../services/apiClient";
import {
  addMonthsToApiDate,
  calendarMonthsBetween,
  createQuotation,
  getCustomer,
  getQuotation,
  saveInquiryFeedback,
  spaceInGroup,
  spaceMonthlyPrice,
  toApiDate,
  type QuotationDiscountType,
  type StaffCustomer,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney, formatTime, parseDate } from "../../../../utils/format";
import { CustomerPickerField } from "../shared/CustomerPickerField";
import {
  EMPTY_SPACE_SELECTION,
  SpaceSelectionFields,
  useSpaceLookups,
  type SpaceSelection,
  type SpaceSelectionErrors,
} from "../shared/SpaceSelectionFields";
import { StaffScreen } from "../shared/StaffScreen";
import { useStaffSession } from "../shared/StaffSession";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
type Route = RouteProp<StaffStackParamList, "QuotationForm">;

const MONTH_OPTIONS = [1, 2, 3, 6, 12, 18, 24, 36].map((m) => ({ label: `${m} ${m === 1 ? "month" : "months"}`, value: m }));
const BILLING_OPTIONS = [1, 3, 6, 12];
const DEPOSIT_OPTIONS = [0, 1, 2, 3].map((m) => ({ label: m === 0 ? "No deposit" : `${m} ${m === 1 ? "month" : "months"}`, value: m }));
const DISCOUNT_OPTIONS: { label: string; value: QuotationDiscountType }[] = [
  { label: "Percent", value: "Percentage" },
  { label: "Amount (PKR)", value: "Amount" },
];

type MeetingMode = "hours" | "day";
type FieldErrors = SpaceSelectionErrors & Partial<Record<"customer" | "start" | "end" | "validUntil" | "basePrice" | "discount", string>>;

const pad2 = (n: number) => String(n).padStart(2, "0");
const timeOf = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
const today = () => new Date(new Date().setHours(0, 0, 0, 0));
const plusDays = (days: number) => new Date(today().getTime() + days * 86400000);

/**
 * New quotation (POST quotation), with pickers for every value the CMS form asks for: customer, location, space
 * type, room size, space, floor, offering, dates, validity, billing, deposit, base price and discount.
 * "Edit" opens this prefilled from an existing quotation: the API cannot change a quotation's values, so saving
 * creates a new quotation, which replaces the active one for the same customer and space.
 */
export default function QuotationFormScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const { profile, locations, locationsLoading, locationsError, reloadProfile } = useStaffSession();
  const lookups = useSpaceLookups();
  const editFromId = params?.editFromId;
  const fromInquiry = params?.fromInquiry;

  const [customer, setCustomer] = useState<StaffCustomer | null>(null);
  const [selection, setSelection] = useState<SpaceSelection>(EMPTY_SPACE_SELECTION);
  const [startDate, setStartDate] = useState<Date | null>(today());
  const [months, setMonths] = useState(12);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>("hours");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [validUntil, setValidUntil] = useState<Date | null>(plusDays(7));
  const [billingMonths, setBillingMonths] = useState(3);
  const [depositMonths, setDepositMonths] = useState(2);
  const [basePrice, setBasePrice] = useState("");
  const [discountType, setDiscountType] = useState<QuotationDiscountType>("Percentage");
  const [discount, setDiscount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(!!editFromId);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const discountRef = useRef<TextInput>(null);
  const remarksRef = useRef<TextInput>(null);
  const prefilledSpace = useRef<number | null>(null);

  const space = useMemo(() => lookups.spaces.find((s) => s.id === selection.spaceId) ?? null, [lookups.spaces, selection.spaceId]);
  const offering = useMemo(
    () => lookups.offeringTypes.find((o) => o.id === selection.offeringTypeId) ?? null,
    [lookups.offeringTypes, selection.offeringTypeId],
  );
  const isMeeting = selection.group === "meeting";
  const isPrivate = selection.group === "private";
  const minPrice = space ? spaceMonthlyPrice(space) : 0;

  // Default location: the user's primary location, else the first one (CMS).
  useEffect(() => {
    if (selection.locationId || editFromId || !locations.length) return;
    const own = profile?.locationId && locations.some((l) => l.id === profile.locationId) ? profile.locationId : locations[0].id;
    setSelection((s) => ({ ...s, locationId: own }));
  }, [locations, profile, selection.locationId, editFromId]);

  // A customer passed in (from a customer screen, or created from this form).
  useEffect(() => {
    const id = params?.customerId;
    if (!id || customer?.id === id) return;
    getCustomer(id)
      .then(setCustomer)
      .catch((err) => toast.error(errorMessage(err, "Could not load the customer.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.customerId]);

  // Group defaults (CMS onQuotationSpaceTypeChange): billing 3 months for offices / shared, 1 for meeting rooms;
  // deposit 2 months for private offices only.
  const applyGroupDefaults = useCallback((group: SpaceSelection["group"]) => {
    setBillingMonths(group === "meeting" ? 1 : 3);
    setDepositMonths(group === "private" ? 2 : 0);
  }, []);

  const onSelectionChange = (next: SpaceSelection) => {
    if (next.group !== selection.group) applyGroupDefaults(next.group);
    if (next.spaceId !== selection.spaceId) {
      const s = lookups.spaces.find((x) => x.id === next.spaceId);
      if (s && prefilledSpace.current !== next.spaceId) setBasePrice(String(spaceMonthlyPrice(s) || ""));
      prefilledSpace.current = null;
    }
    setSelection(next);
    setErrors((e) => ({ ...e, location: undefined, space: undefined, offering: undefined }));
  };

  // "Edit": prefill from the quotation once the spaces are known (to find the space's location and type).
  const loadPrefill = useCallback(async () => {
    if (!editFromId || lookups.loading) return;
    setPrefillLoading(true);
    setPrefillError(null);
    try {
      const q = await getQuotation(editFromId);
      const s = lookups.spaces.find((x) => x.id === q.spaceId);
      const group: SpaceSelection["group"] = !s
        ? "private"
        : spaceInGroup(s, "meeting")
          ? "meeting"
          : spaceInGroup(s, "shared")
            ? "shared"
            : "private";
      prefilledSpace.current = q.spaceId;
      setSelection({
        locationId: s?.locationId ?? null,
        group,
        capacity: group === "private" && s ? s.capacity || null : null,
        spaceId: q.spaceId || null,
        floorId: s?.floorId ?? null,
        offeringTypeId: q.offeringTypeId,
      });
      const start = parseDate(q.startDateTime);
      const end = parseDate(q.endDateTime);
      setStartDate(start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : today());
      if (group === "meeting" && start && end) {
        const fullDay = start.getHours() === 0 && end.getHours() === 23;
        setMeetingMode(fullDay ? "day" : "hours");
        if (!fullDay) {
          setStartTime(start);
          setEndTime(end);
        }
      } else if (start && end) {
        setMonths(calendarMonthsBetween(start, end));
      }
      setBillingMonths(q.billingPeriodMonths || (group === "meeting" ? 1 : 3));
      setDepositMonths(q.securityDepositMonths || (group === "private" ? 2 : 0));
      if (q.perSeatBasePrice) setBasePrice(String(q.perSeatBasePrice));
      const isAmount = (q.discountType ?? "").toLowerCase().startsWith("amount") || (q.discountType ?? "").toLowerCase() === "fixed";
      setDiscountType(isAmount ? "Amount" : "Percentage");
      const value = isAmount ? q.discountValue : q.discountPercentage || q.discountValue;
      setDiscount(value ? String(value) : "");
      setRemarks(q.remarks ?? "");
      setCustomer(await getCustomer(q.customerId));
    } catch (err) {
      setPrefillError(errorMessage(err, "Could not load the quotation."));
    } finally {
      setPrefillLoading(false);
    }
  }, [editFromId, lookups.loading, lookups.spaces]);

  useEffect(() => {
    loadPrefill();
  }, [loadPrefill]);

  const endDate = useMemo(() => {
    if (!startDate || isMeeting) return null;
    return addMonthsToApiDate(toApiDate(startDate), months);
  }, [startDate, months, isMeeting]);

  const billingOptions = useMemo(
    () =>
      BILLING_OPTIONS.filter((m) => isMeeting || m <= months).map((m) => ({
        label: m === 1 ? "Monthly" : `Every ${m} months`,
        value: m,
      })),
    [months, isMeeting],
  );

  // Billing can't be longer than the contract: use the longest option that fits.
  useEffect(() => {
    if (!isMeeting && billingMonths > months) setBillingMonths(Math.max(1, ...BILLING_OPTIONS.filter((m) => m <= months)));
  }, [months, billingMonths, isMeeting]);

  const priceValue = Number(basePrice.replace(/,/g, ""));
  const discountValue = Number(discount.replace(/,/g, "")) || 0;
  const seats = space?.capacity || 1;
  const monthlyEstimate = !isMeeting && priceValue > 0 ? priceValue * (isPrivate ? seats : 1) : 0;
  const discountEstimate =
    monthlyEstimate > 0 ? (discountType === "Percentage" ? (monthlyEstimate * discountValue) / 100 : discountValue) : 0;

  const validate = (): { payload: Parameters<typeof createQuotation>[0] } | null => {
    const next: FieldErrors = {};
    if (!customer) next.customer = "Choose the customer.";
    if (!selection.locationId) next.location = "Choose the location.";
    if (!selection.spaceId) next.space = "Choose the space.";
    if (!selection.offeringTypeId || !offering) next.offering = "Choose the offering.";
    if (!startDate) next.start = "Choose the start date.";
    let startDateTime = "";
    let endDateTime = "";
    if (startDate) {
      const day = toApiDate(startDate);
      if (isMeeting) {
        if (meetingMode === "day") {
          startDateTime = `${day}T00:00:00`;
          endDateTime = `${day}T23:59:59`;
        } else if (!startTime || !endTime) {
          next.end = "Choose the start and end time.";
        } else if (timeOf(endTime) <= timeOf(startTime)) {
          next.end = "The end time must be after the start time.";
        } else {
          startDateTime = `${day}T${timeOf(startTime)}`;
          endDateTime = `${day}T${timeOf(endTime)}`;
        }
      } else if (endDate) {
        startDateTime = `${day}T00:00:00`;
        endDateTime = `${endDate}T00:00:00`;
      }
    }
    if (!validUntil) next.validUntil = "Choose the date the quotation is valid until.";
    else if (validUntil < today()) next.validUntil = "The validity date can't be in the past.";
    if (!isMeeting && basePrice.trim()) {
      if (!Number.isFinite(priceValue) || priceValue <= 0) next.basePrice = "Enter a valid price.";
      else if (minPrice && priceValue < minPrice) next.basePrice = `The standard price is ${formatMoney(minPrice)}. It can only be raised.`;
    }
    if (discount.trim()) {
      if (!Number.isFinite(Number(discount.replace(/,/g, ""))) || discountValue < 0) next.discount = "Enter a valid discount.";
      else if (discountType === "Percentage" && discountValue > 100) next.discount = "The discount can't be more than 100%.";
      else if (discountType === "Percentage" && offering?.discountCap && discountValue > offering.discountCap) {
        next.discount = `${offering.description} allows up to ${offering.discountCap}% discount.`;
      }
    }
    setErrors(next);
    if (Object.values(next).some(Boolean) || !customer || !selection.spaceId || !offering || !validUntil) return null;
    return {
      payload: {
        customerId: customer.id,
        spaceId: selection.spaceId,
        floorId: selection.floorId,
        offeringTypeId: offering.id,
        offeringType: offering.description,
        startDateTime,
        endDateTime,
        validUntil: toApiDate(validUntil),
        perSeatBasePrice: !isMeeting && priceValue > 0 ? priceValue : null,
        discountType,
        discountValue,
        billingPeriodMonths: isMeeting ? 1 : billingMonths,
        securityDepositMonths: isPrivate ? depositMonths : 0,
        remarks,
      },
    };
  };

  const save = async () => {
    const valid = validate();
    if (!valid) {
      toast.error("Please fix the highlighted fields.", { haptic: "warning" });
      return;
    }
    setSaving(true);
    try {
      const result = await createQuotation(valid.payload);
      toast.success(result.message, { haptic: true });
      if (fromInquiry && result.data.id > 0) {
        saveInquiryFeedback(
          { id: fromInquiry.inquiryId, publicId: fromInquiry.publicId },
          { outcome: "converted", quotationId: result.data.id },
        ).catch((err) => toast.error(errorMessage(err, "The quotation was saved, but the inquiry was not marked as converted.")));
      }
      if (result.data.id > 0) navigation.replace("QuotationDetail", { quotationId: result.data.id });
      else navigation.goBack();
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the quotation."));
    } finally {
      setSaving(false);
    }
  };

  const title = editFromId ? "Edit as new quotation" : "New quotation";
  const busy = prefillLoading || (lookups.loading && !!editFromId);

  return (
    <StaffScreen>
      <AppHeader title={title} />
      {busy ? (
        <ListSkeleton rows={4} variant="rows" />
      ) : prefillError ? (
        <ErrorState message={prefillError} onRetry={loadPrefill} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {editFromId ? (
              <Card variant="filled">
                <AppText variant="bodySmall" color="textSecondary">
                  Saving creates a new quotation with a new number. It replaces the active quotation for this customer and space.
                </AppText>
              </Card>
            ) : null}
            {fromInquiry ? (
              <Card variant="filled">
                <AppText variant="bodySmall" color="textSecondary">
                  From tour inquiry: {fromInquiry.name || fromInquiry.email}
                  {fromInquiry.phone ? ` · ${fromInquiry.phone}` : ""}. Choose or create the customer below.
                </AppText>
              </Card>
            ) : null}

            <SectionHeader title="Customer" variant="overline" />
            <Card>
              <CustomerPickerField
                required
                value={customer}
                onChange={(c) => {
                  setCustomer(c);
                  setErrors((e) => ({ ...e, customer: undefined }));
                }}
                error={errors.customer}
                initialQuery={fromInquiry?.email || fromInquiry?.name || ""}
                onCreateNew={() => navigation.navigate("CustomerForm", { returnTo: "QuotationForm" })}
              />
            </Card>

            <SectionHeader title="Space" variant="overline" />
            <Card>
              <SpaceSelectionFields
                value={selection}
                onChange={onSelectionChange}
                locations={locations}
                locationsLoading={locationsLoading}
                locationsError={locationsError}
                onRetryLocations={reloadProfile}
                lookups={lookups}
                errors={errors}
              />
            </Card>

            <SectionHeader title="Dates" variant="overline" />
            <Card>
              <View style={styles.form}>
                <DateField
                  label={isMeeting ? "Date" : "Start date"}
                  required
                  value={startDate}
                  onChange={(d) => {
                    setStartDate(d);
                    setErrors((e) => ({ ...e, start: undefined }));
                  }}
                  minimumDate={today()}
                  error={errors.start}
                />
                {isMeeting ? (
                  <>
                    <SegmentedControl
                      accessibilityLabel="Meeting room booking"
                      options={[
                        { label: "Hours", value: "hours" },
                        { label: "Full day", value: "day" },
                      ]}
                      value={meetingMode}
                      onChange={(m) => setMeetingMode(m as MeetingMode)}
                    />
                    {meetingMode === "hours" ? (
                      <View style={styles.row}>
                        <DateField
                          label="From"
                          required
                          mode="time"
                          value={startTime}
                          onChange={setStartTime}
                          containerStyle={styles.flex}
                          format={formatTime}
                        />
                        <DateField
                          label="To"
                          required
                          mode="time"
                          value={endTime}
                          onChange={setEndTime}
                          containerStyle={styles.flex}
                          error={errors.end}
                          format={formatTime}
                        />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <SelectField label="Contract length" required value={months} options={MONTH_OPTIONS} onChange={setMonths} leftIcon="hourglass-outline" />
                    <InfoRow label="Ends on" value={endDate ? formatDate(endDate) : "—"} icon="calendar-outline" />
                  </>
                )}
                <DateField
                  label="Valid until"
                  required
                  value={validUntil}
                  onChange={(d) => {
                    setValidUntil(d);
                    setErrors((e) => ({ ...e, validUntil: undefined }));
                  }}
                  minimumDate={today()}
                  error={errors.validUntil}
                  helperText="The customer can accept the quotation until this date."
                />
              </View>
            </Card>

            <SectionHeader title="Price" variant="overline" />
            <Card>
              <View style={styles.form}>
                {!isMeeting ? (
                  <>
                    <TextField
                      label={isPrivate ? "Price per seat / month" : "Price per month"}
                      value={basePrice}
                      onChangeText={(t) => {
                        setBasePrice(t.replace(/[^\d.]/g, ""));
                        setErrors((e) => ({ ...e, basePrice: undefined }));
                      }}
                      error={errors.basePrice}
                      keyboardType="numeric"
                      leftIcon="cash-outline"
                      helperText={minPrice ? `Standard price ${formatMoney(minPrice)}. It can only be raised.` : undefined}
                      returnKeyType="next"
                      onSubmitEditing={() => discountRef.current?.focus()}
                    />
                    <SelectField label="Billing" value={billingMonths} options={billingOptions} onChange={setBillingMonths} leftIcon="repeat-outline" />
                    {isPrivate ? (
                      <SelectField label="Security deposit" value={depositMonths} options={DEPOSIT_OPTIONS} onChange={setDepositMonths} leftIcon="shield-outline" />
                    ) : null}
                  </>
                ) : null}
                <SegmentedControl
                  accessibilityLabel="Discount type"
                  options={DISCOUNT_OPTIONS}
                  value={discountType}
                  onChange={(v) => {
                    setDiscountType(v);
                    setErrors((e) => ({ ...e, discount: undefined }));
                  }}
                />
                <TextField
                  ref={discountRef}
                  label={discountType === "Percentage" ? "Discount (%)" : "Discount (PKR)"}
                  value={discount}
                  onChangeText={(t) => {
                    setDiscount(t.replace(/[^\d.]/g, ""));
                    setErrors((e) => ({ ...e, discount: undefined }));
                  }}
                  error={errors.discount}
                  keyboardType="numeric"
                  placeholder="0"
                  helperText={offering?.discountCap && discountType === "Percentage" ? `Up to ${offering.discountCap}% for ${offering.description}.` : undefined}
                  returnKeyType="next"
                  onSubmitEditing={() => remarksRef.current?.focus()}
                />
                <TextField ref={remarksRef} label="Remarks" value={remarks} onChangeText={setRemarks} multiline rows={3} maxLength={500} />
              </View>
            </Card>

            {monthlyEstimate > 0 ? (
              <Card>
                <InfoRow
                  label={isPrivate ? `Monthly rent (${seats} ${seats === 1 ? "seat" : "seats"})` : "Monthly rent"}
                  value={formatMoney(monthlyEstimate)}
                />
                {discountEstimate > 0 ? <InfoRow label="Discount per month" value={`- ${formatMoney(discountEstimate)}`} valueColor="success" /> : null}
                <Divider spacing={8} />
                <AppText variant="caption" color="textMuted">
                  Estimate before tax and support charges. WorkNest calculates the final amounts when you save.
                </AppText>
              </Card>
            ) : null}

            <Button title={editFromId ? "Create new quotation" : "Create quotation"} onPress={save} loading={saving} disabled={saving} leftIcon="checkmark" fullWidth haptic />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
});
