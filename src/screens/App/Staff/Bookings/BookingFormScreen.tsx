import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Button,
  Card,
  DateField,
  InfoRow,
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
  createStaffBooking,
  getCustomer,
  spaceMonthlyPrice,
  toApiDate,
  type StaffCustomer,
} from "../../../../services/staff";
import { spacing } from "../../../../theme";
import { formatDate, formatMoney, formatTime } from "../../../../utils/format";
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
type Route = RouteProp<StaffStackParamList, "BookingForm">;
type FieldErrors = SpaceSelectionErrors & Partial<Record<"customer" | "start" | "end" | "basePrice" | "discount", string>>;

const MONTH_OPTIONS = [1, 2, 3, 6, 12, 18, 24, 36].map((m) => ({ label: `${m} ${m === 1 ? "month" : "months"}`, value: m }));
const BILLING = [1, 3, 6, 12];
const DEPOSIT_OPTIONS = [0, 1, 2, 3].map((m) => ({ label: m === 0 ? "No deposit" : `${m} ${m === 1 ? "month" : "months"}`, value: m }));

const pad2 = (n: number) => String(n).padStart(2, "0");
const timeOf = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
const today = () => new Date(new Date().setHours(0, 0, 0, 0));

/**
 * Staff booking (POST booking/create-admin) for a customer, with the same space pickers as the quotation form.
 * The API books the space, creates the challan and refuses dates that clash with another booking.
 */
export default function BookingFormScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const toast = useToast();
  const { profile, locations, locationsLoading, locationsError, reloadProfile } = useStaffSession();
  const lookups = useSpaceLookups();

  const [customer, setCustomer] = useState<StaffCustomer | null>(null);
  const [selection, setSelection] = useState<SpaceSelection>(EMPTY_SPACE_SELECTION);
  const [startDate, setStartDate] = useState<Date | null>(today());
  const [months, setMonths] = useState(12);
  const [meetingDay, setMeetingDay] = useState<"hours" | "day">("hours");
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [billingMonths, setBillingMonths] = useState(3);
  const [depositMonths, setDepositMonths] = useState(2);
  const [basePrice, setBasePrice] = useState("");
  const [discountType, setDiscountType] = useState<"Percentage" | "Amount">("Percentage");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const notesRef = useRef<TextInput>(null);

  const isMeeting = selection.group === "meeting";
  const isPrivate = selection.group === "private";
  const space = useMemo(() => lookups.spaces.find((s) => s.id === selection.spaceId) ?? null, [lookups.spaces, selection.spaceId]);
  const offering = useMemo(() => lookups.offeringTypes.find((o) => o.id === selection.offeringTypeId) ?? null, [lookups.offeringTypes, selection.offeringTypeId]);
  const minPrice = space ? spaceMonthlyPrice(space) : 0;
  const endDate = !isMeeting && startDate ? addMonthsToApiDate(toApiDate(startDate), months) : null;

  useEffect(() => {
    if (selection.locationId || !locations.length) return;
    const own = profile?.locationId && locations.some((l) => l.id === profile.locationId) ? profile.locationId : locations[0].id;
    setSelection((s) => ({ ...s, locationId: own }));
  }, [locations, profile, selection.locationId]);

  useEffect(() => {
    const id = params?.customerId;
    if (!id || customer?.id === id) return;
    getCustomer(id)
      .then(setCustomer)
      .catch((err) => toast.error(errorMessage(err, "Could not load the customer.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.customerId]);

  // Billing can't be longer than the contract: use the longest option that fits.
  useEffect(() => {
    if (!isMeeting && billingMonths > months) setBillingMonths(Math.max(1, ...BILLING.filter((m) => m <= months)));
  }, [months, billingMonths, isMeeting]);

  const onSelectionChange = (next: SpaceSelection) => {
    if (next.group !== selection.group) {
      setBillingMonths(next.group === "meeting" ? 1 : 3);
      setDepositMonths(next.group === "private" ? 2 : 0);
    }
    if (next.spaceId !== selection.spaceId) {
      const s = lookups.spaces.find((x) => x.id === next.spaceId);
      setBasePrice(s ? String(spaceMonthlyPrice(s) || "") : "");
    }
    setSelection(next);
    setErrors((e) => ({ ...e, location: undefined, space: undefined, offering: undefined }));
  };

  const save = async () => {
    const next: FieldErrors = {};
    if (!customer) next.customer = "Choose the customer.";
    if (!selection.locationId) next.location = "Choose the location.";
    if (!selection.spaceId) next.space = "Choose the space.";
    if (!offering) next.offering = "Choose the offering.";
    if (!startDate) next.start = "Choose the start date.";
    let start = "";
    let end = "";
    if (startDate) {
      const day = toApiDate(startDate);
      if (isMeeting) {
        if (meetingDay === "day") {
          start = `${day}T00:00:00`;
          end = `${day}T23:59:59`;
        } else if (!startTime || !endTime) next.end = "Choose the start and end time.";
        else if (timeOf(endTime) <= timeOf(startTime)) next.end = "The end time must be after the start time.";
        else {
          start = `${day}T${timeOf(startTime)}`;
          end = `${day}T${timeOf(endTime)}`;
        }
      } else if (endDate) {
        start = `${day}T00:00:00`;
        end = `${endDate}T00:00:00`;
      }
    }
    const price = Number(basePrice);
    if (!isMeeting && basePrice && minPrice && price < minPrice) next.basePrice = `The standard price is ${formatMoney(minPrice)}. It can only be raised.`;
    const discountValue = Number(discount) || 0;
    if (discountType === "Percentage" && discountValue > 100) next.discount = "The discount can't be more than 100%.";
    else if (discountType === "Percentage" && offering?.discountCap && discountValue > offering.discountCap) {
      next.discount = `${offering.description} allows up to ${offering.discountCap}% discount.`;
    }
    setErrors(next);
    if (Object.values(next).some(Boolean) || !customer || !selection.spaceId) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const result = await createStaffBooking({
        customerEmail: customer.email,
        customerName: customer.fullName,
        phone: customer.phoneNumber,
        spaceId: selection.spaceId,
        floorId: selection.floorId,
        offeringTypeId: offering?.id ?? null,
        offeringType: offering?.description ?? null,
        startDateTime: start,
        endDateTime: end,
        capacity: isPrivate ? space?.capacity ?? null : null,
        discountType,
        discountValue,
        perSeatBasePrice: !isMeeting && price > 0 ? price : null,
        billingPeriodMonths: isMeeting ? 1 : billingMonths,
        securityDepositMonths: isPrivate ? depositMonths : 0,
        notes,
      });
      toast.success(result.data.challanNumber ? `${result.message} Challan ${result.data.challanNumber}.` : result.message);
      if (result.data.bookingId > 0) navigation.replace("BookingDetail", { bookingId: result.data.bookingId });
      else navigation.goBack();
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the booking."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffScreen>
      <AppHeader title="New booking" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              onCreateNew={() => navigation.navigate("CustomerForm", { returnTo: "BookingForm" })}
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
              <DateField label={isMeeting ? "Date" : "Start date"} required value={startDate} onChange={setStartDate} minimumDate={today()} error={errors.start} />
              {isMeeting ? (
                <>
                  <SegmentedControl
                    accessibilityLabel="Meeting room booking"
                    options={[
                      { label: "Hours", value: "hours" },
                      { label: "Full day", value: "day" },
                    ]}
                    value={meetingDay}
                    onChange={(v) => setMeetingDay(v as "hours" | "day")}
                  />
                  {meetingDay === "hours" ? (
                    <View style={styles.row}>
                      <DateField label="From" required mode="time" value={startTime} onChange={setStartTime} containerStyle={styles.flex} format={formatTime} />
                      <DateField label="To" required mode="time" value={endTime} onChange={setEndTime} containerStyle={styles.flex} error={errors.end} format={formatTime} />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <SelectField label="Contract length" required value={months} options={MONTH_OPTIONS} onChange={setMonths} leftIcon="hourglass-outline" />
                  <InfoRow label="Ends on" value={endDate ? formatDate(endDate) : "—"} icon="calendar-outline" />
                </>
              )}
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
                    onChangeText={(t) => setBasePrice(t.replace(/[^\d.]/g, ""))}
                    error={errors.basePrice}
                    keyboardType="numeric"
                    leftIcon="cash-outline"
                    helperText={minPrice ? `Standard price ${formatMoney(minPrice)}. It can only be raised.` : undefined}
                  />
                  <SelectField
                    label="Billing"
                    value={billingMonths}
                    options={BILLING.filter((m) => m <= months).map((m) => ({ label: m === 1 ? "Monthly" : `Every ${m} months`, value: m }))}
                    onChange={setBillingMonths}
                    leftIcon="repeat-outline"
                  />
                  {isPrivate ? <SelectField label="Security deposit" value={depositMonths} options={DEPOSIT_OPTIONS} onChange={setDepositMonths} leftIcon="shield-outline" /> : null}
                </>
              ) : null}
              <SegmentedControl
                accessibilityLabel="Discount type"
                options={[
                  { label: "Percent", value: "Percentage" },
                  { label: "Amount (PKR)", value: "Amount" },
                ]}
                value={discountType}
                onChange={(v) => setDiscountType(v as "Percentage" | "Amount")}
              />
              <TextField
                label={discountType === "Percentage" ? "Discount (%)" : "Discount (PKR)"}
                value={discount}
                onChangeText={(t) => setDiscount(t.replace(/[^\d.]/g, ""))}
                error={errors.discount}
                keyboardType="numeric"
                placeholder="0"
                returnKeyType="next"
                onSubmitEditing={() => notesRef.current?.focus()}
              />
              <TextField ref={notesRef} label="Notes" value={notes} onChangeText={setNotes} multiline rows={3} maxLength={500} />
            </View>
          </Card>
          <AppText variant="caption" color="textMuted" align="center">
            WorkNest calculates tax, deposit and the challan when the booking is created.
          </AppText>
          <Button title="Create booking" onPress={save} loading={saving} disabled={saving} leftIcon="checkmark" fullWidth haptic />
        </ScrollView>
      </KeyboardAvoidingView>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
});
