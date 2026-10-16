import { useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  Banner,
  Button,
  Card,
  Checkbox,
  Divider,
  InfoRow,
  Screen,
  SectionHeader,
  useToast,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { errorMessage } from "../../../services/apiClient";
import { haptics } from "../../../utils/haptics";
import {
  BOOKING_OUTCOME_UNKNOWN_MESSAGE,
  bookingOutcomeUnknown,
  categoryCodeForMode,
  createSmartBooking,
  CustomerProfileRequiredError,
  findBookingForPeriod,
  type BookingCustomerProfile,
  type SmartBookingInput,
} from "../../../services/bookingService";
import { formatPeriodPrice, isPrivateOfficeCategory, listedRate } from "../../../services/workspaceService";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import { fittingLabel, useContentWidth } from "./shared/layout";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** The confirm button's label, then shorter ones with the same meaning for a narrow phone or large text. */
const CONFIRM_LABELS = ["Confirm booking and get challan", "Confirm and get challan", "Confirm booking"] as const;

function profileFromGuest(guest: { name: string; phone: string }): BookingCustomerProfile {
  const [firstName, ...rest] = guest.name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined, phoneNumber: guest.phone };
}

/**
 * Booking step 2: review and confirm. Payment is by bank challan only (like worknestpk.com): confirming creates
 * the booking (POST /booking/smart, at the card's location); the API assigns the space, prices it and issues the
 * challan, which opens next. There is no card, wallet or bank-transfer form and nothing is marked paid by the app.
 * When the request gets no answer (time-out), the app looks in My Bookings for the booking before saying anything:
 * the customer is told to check My Bookings instead of being invited to book again.
 */
export default function BookingConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingConfirm">>();
  const { workspace, booking } = route.params;
  const styles = useThemedStyles(createStyles);
  const { fontScale } = useWindowDimensions();
  const contentWidth = useContentWidth();

  const toast = useToast();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // The last attempt got no answer and no booking for this period was found: the banner points to My Bookings.
  // Trying again is safe: the API returns a booking made a moment ago instead of making a second one.
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const submittingRef = useRef(false);

  // The booking exists: leave the booking flow (no way back to confirm it twice) and show the challan, which opens
  // with the success check (justBooked) and the success haptic.
  const showChallan = (bookingId: number, challanNumber?: string | null) =>
    navigation.reset({
      index: 1,
      routes: [
        { name: "MainTabs", params: { screen: "Bookings" } },
        { name: "Challan", params: { bookingId, challanNumber: challanNumber ?? undefined, justBooked: true } },
      ],
    });

  const openMyBookings = () => navigation.navigate("MainTabs", { screen: "Bookings", params: { tab: "upcoming" } });

  const confirm = async () => {
    if (!termsAccepted || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    const input: SmartBookingInput = {
      // The space's own category from the API matches what /booking/smart looks up; the mode map is the fallback.
      categoryCode: workspace.categoryCode || categoryCodeForMode(booking.mode),
      // The card's location: the API books a space there, never at another branch.
      locationId: workspace.locationId,
      startDateTime: booking.startDateTime,
      endDateTime: booking.endDateTime,
      capacity: booking.capacity,
      notes: booking.notes,
    };
    try {
      let created;
      try {
        created = await createSmartBooking(input);
      } catch (err) {
        // First booking: the API needs the customer's details, which the previous step collected.
        if (!(err instanceof CustomerProfileRequiredError)) throw err;
        created = await createSmartBooking({ ...input, profile: profileFromGuest(booking.guest) });
      }
      if (created.duplicate) toast.info("You made this booking a moment ago: here is its challan.");
      showChallan(created.bookingId!, created.challanNumber);
    } catch (err) {
      if (bookingOutcomeUnknown(err)) {
        // No answer: the booking may have been made. Look in My Bookings before suggesting anything else.
        try {
          const made = await findBookingForPeriod({
            startDateTime: booking.startDateTime,
            endDateTime: booking.endDateTime,
            locationName: workspace.location,
          });
          if (made) {
            toast.success("Your booking was made.");
            showChallan(made.id, made.challanNumber);
            return;
          }
        } catch {
          // My Bookings could not be read either: the message below sends the customer there.
        }
        haptics.error();
        setOutcomeUnknown(true);
        setError(BOOKING_OUTCOME_UNKNOWN_MESSAGE);
        return;
      }
      haptics.error();
      setOutcomeUnknown(false);
      setError(errorMessage(err, "Your booking could not be created. Please try again."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // The rate of the space this booking gets (from the availability check), else the card's lowest rate.
  const rate =
    booking.listedPrice && booking.listedPrice > 0
      ? `${formatPeriodPrice(booking.listedPrice, booking.priceUnit)}${
          isPrivateOfficeCategory(workspace.categoryCode) && booking.seats ? ` (${booking.seats}-seat office)` : ""
        }`
      : listedRate(workspace);

  return (
    <Screen>
      <AppHeader title="Confirm booking" subtitle="Step 2 of 2" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Booking summary" />
        <Card>
          <InfoRow label="Space" value={workspace.name} icon="business-outline" />
          {workspace.type !== workspace.name ? <InfoRow label="Type" value={workspace.type} /> : null}
          {workspace.location ? <InfoRow label="Location" value={workspace.location} icon="location-outline" /> : null}
          <InfoRow label="When" value={booking.periodLabel} icon="calendar-outline" layout="stacked" />
          {booking.capacity ? <InfoRow label="People" value={String(booking.capacity)} /> : null}
          <InfoRow label="Listed rate" value={rate} />
          {booking.notes ? <InfoRow label="Notes" value={booking.notes} layout="stacked" /> : null}
          <Divider spacing={8} />
          <InfoRow label="Name" value={booking.guest.name || "Not set"} icon="person-outline" />
          <InfoRow label="Email" value={booking.guest.email} />
          <InfoRow label="Phone" value={booking.guest.phone || "Not set"} />
        </Card>

        <Banner
          tone="info"
          title="Payment by bank challan"
          message="When you confirm, WorkNest assigns your space and issues a bank challan with the exact amount payable (rent, tax and any security deposit). You will find it under Bookings and Payments."
        />
        <ChallanPayHelp compact />

        <Checkbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          disabled={submitting}
          label="I agree to the WorkNest terms and conditions and understand the booking is confirmed after the challan is paid."
        />

        {error ? (
          outcomeUnknown ? (
            <Banner
              tone="warning"
              title="Booking not confirmed"
              message={error}
              actionLabel="Open My Bookings"
              onAction={openMyBookings}
            />
          ) : (
            <Banner tone="danger" title="Not booked" message={error} />
          )
        ) : null}

        <Button
          title={outcomeUnknown ? "Try again" : fittingLabel(CONFIRM_LABELS, contentWidth, fontScale)}
          accessibilityLabel={outcomeUnknown ? "Try again" : CONFIRM_LABELS[0]}
          size="lg"
          fullWidth
          haptic
          loading={submitting}
          disabled={!termsAccepted || submitting}
          onPress={confirm}
        />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    flex: { flex: 1 },
  });
