import { ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  InfoRow,
  Screen,
  SectionHeader,
  SmartImage,
  StatusPill,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import { availabilityOf } from "../../Home/WorkspaceCard";
import { capacityLabel, listedRate } from "../../../services/workspaceService";
import type { AppStackParamList } from "../../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * One space category (type) at one location, summarising its spaces from GET /space/available: seats from the
 * smallest to the largest space and the lowest listed rate. "Book this space" starts the booking even when every
 * space is taken right now (a later period may be free: the next step checks the dates chosen); WorkNest then
 * assigns a space of this type at this location.
 */
export default function SpaceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "SpaceDetail">>();
  const { workspace } = route.params;
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const availability = availabilityOf(workspace);
  const bookable = workspace.bookable !== false && workspace.price > 0;
  const fullNow = bookable && (!workspace.available || workspace.availableCount <= 0);
  const seats = capacityLabel(workspace);

  const book = () => {
    if (!user) {
      navigation.navigate("Login", { redirectAfterLogin: { screen: "SpaceDetail", params: { workspace } } });
      return;
    }
    navigation.navigate("BookingInfo", { workspace });
  };

  return (
    <Screen>
      <AppHeader title={workspace.name} subtitle={workspace.location || undefined} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SmartImage uri={workspace.image} style={styles.image} resizeMode="cover" />

        <Card>
          <View style={styles.titleRow}>
            <AppText variant="heading" style={styles.flex}>
              {workspace.name}
            </AppText>
            <StatusPill tone={availability.tone} label={availability.label} size="md" />
          </View>
          {workspace.type !== workspace.name ? (
            <InfoRow label="Type" value={workspace.type} icon="business-outline" />
          ) : null}
          {workspace.location ? <InfoRow label="Location" value={workspace.location} icon="location-outline" /> : null}
          {seats ? <InfoRow label="Capacity" value={seats} icon="people-outline" /> : null}
          <InfoRow label="Listed rate" value={listedRate(workspace)} icon="pricetag-outline" emphasize />
        </Card>

        {workspace.amenities.length > 0 ? (
          <>
            <SectionHeader title="Amenities" />
            <View style={styles.chips}>
              {workspace.amenities.map((amenity) => (
                <Chip key={amenity} label={amenity} icon="checkmark-circle-outline" />
              ))}
            </View>
          </>
        ) : null}

        {fullNow ? (
          <Banner
            tone="warning"
            title="Fully booked right now"
            message="Every space of this type here is taken at the moment. Choose your dates on the next step to see whether a later period is free."
          />
        ) : null}

        {!bookable ? (
          <Banner
            tone="info"
            title="Price on request"
            message="This space type has no listed price yet, so it can't be booked in the app. Book a tour and our team will help you."
          />
        ) : null}

        <Banner
          tone="info"
          title="Paid by bank challan"
          message="When you book, WorkNest assigns a space of this type and issues a bank challan with the exact amount (rent, tax and any deposit). Pay it at HBL or in your banking app under 1Bill."
        />

        <View style={styles.actions}>
          <Button
            title={bookable ? "Book this space" : "Not bookable in the app"}
            leftIcon="calendar-outline"
            size="lg"
            fullWidth
            disabled={!bookable}
            onPress={book}
          />
          <Button
            title="Book a tour first"
            variant="outline"
            leftIcon="walk-outline"
            fullWidth
            onPress={() => navigation.navigate("BookTour")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (c: AppColors, t: Theme) =>
  StyleSheet.create({
    content: { padding: t.spacing.screen, gap: t.spacing.lg, paddingBottom: t.spacing.xxl },
    image: { width: "100%", height: 200, borderRadius: t.radii.card, backgroundColor: c.surfaceAlt },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginBottom: t.spacing.xs },
    flex: { flex: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    actions: { gap: t.spacing.md },
  });
