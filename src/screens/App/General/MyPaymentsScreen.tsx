import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Header } from '../../../components/Header';
import { Screen } from '../../../components/Screen';
import { radii, useThemedStyles, useThemeColors } from '../../../theme';
import { errorMessage } from '../../../services/apiClient';
import {
  getMyPayments,
  isPaid,
  summarizePayments,
  type MyPayment,
} from '../../../services/paymentService';
import { useAuth } from '../../../context/AuthContext';
import type { AppStackParamList } from '../../../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';

// My Payments, like worknestpk.com: GET /payment/my plus the bank challan of each booking. Payment is by
// challan only (1Bill / HBL); every status shown comes from the API, the app never marks anything paid.
// (The API has no customer "my invoices" list yet.)

export default function MyPaymentsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [payments, setPayments] = useState<MyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setPayments(await getMyPayments());
    } catch (err) {
      setError(errorMessage(err, 'Your payments could not be loaded. Please try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPayments();
    else {
      setPayments([]);
      setLoading(false);
    }
  }, [user, fetchPayments]);

  // Hooks run before the guest wall: the tab stays mounted across sign in / out (hooks must not change count).
  const totals = useMemo(() => summarizePayments(payments), [payments]);

  if (!user) {
    return (
      <Screen>
        <Header />
        <View style={styles.guestWall}>
          <Ionicons
            name="receipt-outline"
            size={72}
            color={colors.primary}
            style={{ opacity: 0.5 }}
          />
          <Text style={styles.guestTitle}>Sign in to view payments</Text>
          <Text style={styles.guestSub}>
            Your challans and payments will appear here once you're signed in.
          </Text>
          <Pressable
            style={styles.guestBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.guestBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPayments(true)}
          />
        }
      >
        <Text style={styles.title}>My Payments</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>PKR {formatMoney(totals.paid)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryValue}>PKR {formatMoney(totals.pending)}</Text>
          </View>
        </View>

        <Text style={styles.helper}>
          Pay pending challans at any HBL branch, ATM or in your mobile banking app under 1Bill / Bill Payment.
          The status updates once the payment reaches us.
        </Text>

        {loading && !payments.length ? (
          <Text style={styles.helper}>Loading payments...</Text>
        ) : null}
        {!loading && error ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payments not loaded</Text>
            <Text style={styles.meta}>{error}</Text>
            <Pressable style={styles.challanBtn} onPress={() => fetchPayments()}>
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={styles.challanBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && payments.length === 0 ? (
          <Text style={styles.helper}>No payments yet.</Text>
        ) : null}

        {payments.map(payment => {
          const paid = isPaid(payment);
          return (
            <View key={payment.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardBody}>
                  <Text style={styles.voucherCode}>
                    {payment.challanNumber ? `Challan ${payment.challanNumber}` : `Payment #${payment.id}`}
                  </Text>
                  {payment.spaceName ? (
                    <Text style={styles.meta}>Space: {payment.spaceName}</Text>
                  ) : null}
                  <Text style={styles.meta}>
                    Amount: {payment.amount !== null ? `PKR ${formatMoney(payment.amount)}` : 'Not available'}
                  </Text>
                  {payment.methodLabel ? (
                    <Text style={styles.meta}>Method: {payment.methodLabel}</Text>
                  ) : null}
                  <Text style={styles.meta}>Created: {formatDate(payment.createdOn)}</Text>
                  {paid ? (
                    <Text style={styles.meta}>Paid on: {formatDate(payment.paidOn)}</Text>
                  ) : payment.challanValidUntil ? (
                    <Text style={styles.meta}>Pay before: {formatDate(payment.challanValidUntil)}</Text>
                  ) : null}
                </View>

                <View style={styles.cardRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      paid ? styles.statusPaid : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        paid ? styles.statusPaidText : styles.statusPendingText,
                      ]}
                    >
                      {payment.status}
                    </Text>
                  </View>
                </View>
              </View>

              {payment.bookingId ? (
                <Pressable
                  style={styles.challanBtn}
                  onPress={() =>
                    navigation.navigate('Challan', {
                      bookingId: payment.bookingId!,
                      challanNumber: payment.challanNumber ?? undefined,
                    })
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.challanBtnText}>View challan</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '0';
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 36,
      gap: 14,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.foreground,
      marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryLabel: {
      color: colors.mutedForeground,
      fontSize: 12,
      fontWeight: '700',
    },
    summaryValue: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '800',
      marginTop: 4,
    },
    helper: { color: colors.mutedForeground, marginBottom: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 5,
      marginBottom: 12,
    },
    cardTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardBody: { flex: 1, gap: 3 },
    cardRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
    statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    statusPending: {
      backgroundColor: 'rgba(245,158,11,0.12)',
      borderWidth: 1,
      borderColor: '#f59e0b',
    },
    statusPaid: {
      backgroundColor: 'rgba(16,185,129,0.12)',
      borderWidth: 1,
      borderColor: '#10b981',
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    statusPendingText: { color: '#d97706' },
    statusPaidText: { color: '#059669' },
    voucherCode: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    meta: { color: colors.mutedForeground, fontSize: 13 },
    pendingBadge: {
      borderRadius: 8,
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    pendingBadgeText: { color: '#92400e', fontSize: 12, fontWeight: '700' },
    challanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    challanBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    sectionTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 8,
      marginBottom: 8,
    },
    guestWall: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    guestTitle: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    guestSub: {
      color: colors.mutedForeground,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 21,
    },
    guestBtn: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 13,
      paddingHorizontal: 28,
    },
    guestBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  });
