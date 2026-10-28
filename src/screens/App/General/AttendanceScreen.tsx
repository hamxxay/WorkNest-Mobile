import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppHeader,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  ListSkeleton,
  Screen,
  SegmentedControl,
} from "../../../components/ui";
import { useThemedStyles, type AppColors, type Theme } from "../../../theme";
import { useAuth } from "../../../context/AuthContext";
import {
  attendanceErrorMessage,
  getAttendanceStatus,
  NOT_ENABLED_MESSAGE,
  type AttendanceStatus,
} from "../../../services/attendanceService";
import type { AppStackParamList } from "../../../navigation/types";
import { EmployeesSection } from "./attendance/EmployeesSection";
import { HolidaysSection } from "./attendance/HolidaysSection";
import { ReportSection } from "./attendance/ReportSection";
import { ShiftsSection } from "./attendance/ShiftsSection";
import { ScrollableState } from "./shared/ScrollableState";

type Nav = NativeStackNavigationProp<AppStackParamList>;

type Section = "report" | "employees" | "shifts" | "holidays";

const SECTIONS = [
  { label: "Report", value: "report" },
  { label: "Employees", value: "employees" },
  { label: "Shifts", value: "shifts" },
  { label: "Holidays", value: "holidays" },
] as const;

/**
 * Attendance of the customer's own employees (api/attendance/my/*), like the website's /my-attendance page: the
 * report (daily in / out / hours / status and a summary), the employees and their shifts, the shifts and the
 * holidays. Only shown when WorkNest has turned attendance on for this customer; otherwise a friendly empty state.
 */
export default function AttendanceScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("report");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getAttendanceStatus());
      setError("");
    } catch (err) {
      setError(attendanceErrorMessage(err, "Attendance could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  const signedIn = !!user;
  useEffect(() => {
    if (signedIn) loadStatus();
  }, [signedIn, loadStatus]);

  const title = "Attendance";

  if (!user) {
    return (
      <Screen>
        <AppHeader title={title} />
        <ScrollableState>
          <EmptyState
            icon="finger-print-outline"
            title="Sign in to see your team's attendance"
            actionLabel="Sign in"
            onAction={() => navigation.navigate("Login", { redirectAfterLogin: { screen: "Attendance" } })}
          />
        </ScrollableState>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={title} subtitle={status?.enabled ? status.customerName ?? undefined : undefined} />
      {loading && !status && !error ? (
        <View style={styles.content} accessibilityLabel="Loading attendance">
          <KpiSkeleton count={4} />
          <ListSkeleton rows={3} avatar={false} />
        </View>
      ) : error && !status ? (
        <ScrollableState>
          <ErrorState title="Attendance is not available right now" message={error} onRetry={loadStatus} retrying={loading} />
        </ScrollableState>
      ) : !status?.enabled ? (
        <ScrollableState>
          <EmptyState
            icon="finger-print-outline"
            title={NOT_ENABLED_MESSAGE}
            message="WorkNest can turn on attendance for your company's employees on your private office's machine. Contact us to ask for it."
            actionLabel="Contact us"
            onAction={() => navigation.navigate("ContactUs")}
          />
        </ScrollableState>
      ) : (
        <View style={styles.flex}>
          <View style={styles.tabs}>
            <SegmentedControl<Section>
              options={SECTIONS}
              value={section}
              onChange={setSection}
              accessibilityLabel="Attendance section"
            />
          </View>
          {section === "report" ? (
            <ReportSection />
          ) : section === "employees" ? (
            <EmployeesSection />
          ) : section === "shifts" ? (
            <ShiftsSection />
          ) : (
            <HolidaysSection />
          )}
        </View>
      )}
    </Screen>
  );
}

const createStyles = (_c: AppColors, t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: t.spacing.screen, gap: t.spacing.lg },
    tabs: { paddingHorizontal: t.spacing.screen, paddingTop: t.spacing.md },
  });
