import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
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
import {
  buildInvoicePdfUrl,
  getCustomerInvoices,
  type InvoiceItemSummary,
} from '../../../services/invoiceService';
import { useAuth } from '../../../context/AuthContext';
import type { AppStackParamList } from '../../../navigation/types';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function MyPaymentsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceItemSummary[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const resolveCustomerId = () => {
    const raw =
      (user as any)?.customerId ??
      (user as any)?.customerCode ??
      (user as any)?.id ??
      '';
    return raw ? String(raw) : '';
  };

  const fetchInvoices = (isRefresh = false) => {
    const customerId = resolveCustomerId();

    if (isRefresh) setRefreshing(true);
    else setLoadingInvoices(true);

    if (!customerId) {
      setInvoices([]);
      setLoadingInvoices(false);
      setRefreshing(false);
      return;
    }

    getCustomerInvoices(1, 50, undefined, customerId)
      .then(result => setInvoices(result.items ?? []))
      .catch(() => setInvoices([]))
      .finally(() => {
        setLoadingInvoices(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchInvoices();
  }, [user]);

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
          <Text style={styles.guestTitle}>Sign in to view invoices</Text>
          <Text style={styles.guestSub}>
            Your paid and unpaid invoice history will appear here once you're
            signed in.
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

  const totalPaid = useMemo(
    () =>
      invoices
        .filter(invoice => getInvoiceStatus(invoice) === 'Paid')
        .reduce(
          (sum, invoice) =>
            sum + Number(invoice.paidTotal ?? invoice.grandTotal ?? 0),
          0,
        ),
    [invoices],
  );

  const totalUnpaid = useMemo(
    () =>
      invoices
        .filter(invoice => getInvoiceStatus(invoice) !== 'Paid')
        .reduce(
          (sum, invoice) =>
            sum + Number(invoice.balanceDue ?? invoice.grandTotal ?? 0),
          0,
        ),
    [invoices],
  );

  return (
    <Screen>
      <Header />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchInvoices(true)}
          />
        }
      >
        <Text style={styles.title}>My Invoices</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>
              PKR {formatMoney(totalPaid)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Unpaid</Text>
            <Text style={styles.summaryValue}>
              PKR {formatMoney(totalUnpaid)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Paid & Unpaid Invoices</Text>
        {loadingInvoices && !invoices.length ? (
          <Text style={styles.helper}>Loading invoices...</Text>
        ) : null}
        {!loadingInvoices && invoices.length === 0 ? (
          <Text style={styles.helper}>
            No invoices found for this customer.
          </Text>
        ) : null}

        {invoices.map(invoice => {
          const status = getInvoiceStatus(invoice);
          const isPaid = status === 'Paid';

          return (
            <View key={invoice.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardBody}>
                  <Text style={styles.voucherCode}>
                    {invoice.invoiceNumber || `INV-${invoice.id}`}
                  </Text>
                  <Text style={styles.meta}>
                    Issued: {formatDate(invoice.issuedOn)}
                  </Text>
                  <Text style={styles.meta}>
                    Due: {formatDate(invoice.dueOn)}
                  </Text>
                  <Text style={styles.meta}>
                    Amount: PKR {formatMoney(invoice.grandTotal)}
                  </Text>
                  <Text style={styles.meta}>
                    Balance: PKR{' '}
                    {formatMoney(invoice.balanceDue ?? invoice.grandTotal ?? 0)}
                  </Text>
                  {invoice.publicId ? (
                    <Text style={styles.meta}>
                      Public ID: {invoice.publicId}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.cardRight}>
                  <Text style={styles.cardTitle}>#{invoice.id}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isPaid ? styles.statusPaid : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isPaid
                          ? styles.statusPaidText
                          : styles.statusPendingText,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={styles.challanBtn}
                onPress={() => Linking.openURL(buildInvoicePdfUrl(invoice.id))}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.challanBtnText}>View Invoice PDF</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function getInvoiceStatus(invoice: InvoiceItemSummary): string {
  const label = (invoice.statusLabel ?? '').toString().trim().toLowerCase();
  if (label.includes('paid') || invoice.statusId === 2) return 'Paid';
  return 'Unpaid';
}

function formatDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatMoney(value: number | string) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
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
