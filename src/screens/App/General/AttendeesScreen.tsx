import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import {
  getCustomerAttendants,
  type Attendant,
} from '../../../services/attendantService';

export default function AttendeesScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [attendees, setAttendees] = useState<Attendant[]>([]);

  const customerId = useMemo(() => {
    const raw = (user as any)?.customerId ?? (user as any)?.customerCode ?? '';
    return raw && String(raw).trim() !== '' ? String(raw).trim() : null;
  }, [user]);

  const loadAttendees = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!customerId) {
        setAttendees([]);
        return;
      }

      const result = await getCustomerAttendants(customerId);
      setAttendees(result.items ?? []);
    } catch (error) {
      console.warn('[AttendeesScreen] loadAttendees error:', error);
      setAttendees([]);
      Alert.alert('Unable to load attendees', 'Please try again in a moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      loadAttendees(true);
    } else {
      setLoading(false);
      setAttendees([]);
    }
  }, [customerId]);

  const filteredAttendees = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return attendees;

    return attendees.filter(attendee => {
      const text = [
        attendee.name,
        attendee.email,
        attendee.phone,
        attendee.idNumber,
        attendee.companyName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(value);
    });
  }, [attendees, query]);

  const renderItem = ({ item }: { item: Attendant }) => (
    <Pressable
      key={item.personId || `${item.name}-${item.phone}`}
      onPress={() => Alert.alert(item.name, `Phone: ${item.phone}\nEmail: ${item.email}\nCNIC: ${item.idNumber}`)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{(item.name || 'A').charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name || 'Unnamed attendant'}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.email || 'No email'}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.phone || 'No phone'}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.idType || 'CNIC'}: {item.idNumber || 'N/A'}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );

  return (
    <Screen>
      <Header />

      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>People</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Attendees</Text>
          </View>

          <Pressable
            onPress={() => loadAttendees(true)}
            style={[styles.refreshBtn, { backgroundColor: colors.primaryMuted }]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search attendee"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {!customerId ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Customer profile not available</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Log in with an account that has a valid customer ID to load attendees.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredAttendees.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No attendees found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              There are no attendants linked to this customer yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredAttendees}
            keyExtractor={(item, index) => String(item.personId || `${index}-${item.name}`)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadAttendees(true);
                }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={renderItem}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0D5B5F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  cardContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
});
