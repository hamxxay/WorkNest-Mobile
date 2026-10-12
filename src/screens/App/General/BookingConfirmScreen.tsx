import { useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
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
import {
  categoryCodeForMode,
  createSmartBooking,
  CustomerProfileRequiredError,
  type BookingCustomerProfile,
  type SmartBookingInput,
} from "../../../services/bookingService";
import { listedRate } from "../../Home/WorkspaceCard";
import { ChallanPayHelp } from "./shared/ChallanPayHelp";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

function profileFromGuest(guest: { name: string; phone: string }): BookingCustomerProfile {
  const [firstName, ...rest] = guest.name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") || undefined, phoneNumber: guest.phone };
}

/**
 * Booking step 2: review and confirm. Payment is by bank challan only (like worknestpk.com): confirming creates
 * the booking (POST /booking/smart); the API assigns the space, prices it and issues the challan, which opens
 * next. There is no card, wallet or bank-transfer form and nothing is marked paid by the app.
 */
export default function BookingConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingConfirm">>();
  const { workspace, booking } = route.params;
  const styles = useThemedStyles(createStyles);
  const toast = useToast();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const confirm = async () => {
    if (!termsAccepted || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    const input: SmartBookingInput = {
      // The space's own category from the API matches what /booking/smart looks up; the mode map is the fallback.
      categoryCode: workspace.categoryCode || categoryCodeForMode(booking.mode),
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
      toast.success("Booking created. Pay the challan to confirm it.", { title: "Booked" });
      // The booking exists now: leave the booking flow (no way back to confirm it twice) and show the challan.
      navigation.reset({
        index: 1,
        routes: [
          { name: "MainTabs", params: { screen: "Bookings" } },
          { name: "Challan", params: { bookingId: created.bookingId!, challanNumber: created.challanNumber ?? undefined } },
        ],
      });
    } catch (err) {
      setError(errorMessage(err, "Your booking could not be created. Please try again."));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Confirm booking" subtitle="Step 2 of 2" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Booking summary" />
        <Card>
          <InfoRow label="Space" value={workspace.name} icon="business-outline" />
          <InfoRow label="Type" value={workspace.type} />
          {workspace.location ? <InfoRow label="Location" value={workspace.location} icon="location-outline" /> : null}
          <InfoRow label="When" value={booking.periodLabel} icon="calendar-outline" layout="stacked" />
          {booking.capacity ? <InfoRow label="People" value={String(booking.capacity)} /> : null}
          <InfoRow label="Listed rate" value={listedRate(workspace)} />
          {booking.notes ? <InfoRow label="Notes" value={booking.notes} layout="stacked" /> : null}
          <Divider spacing={8} />
          <InfoRow label="Name" value={booking.guest.name} icon="person-outline" />
          <InfoRow label="Email" value={booking.guest.email} />
          <InfoRow label="Phone" value={booking.guest.phone} />
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

        {error ? <Banner tone="danger" title="Not booked" message={error} /> : null}

        <Button
          title="Confirm booking and get challan"
          size="lg"
          fullWidth
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
