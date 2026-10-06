import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { Screen } from '../../../components/Screen';
import { ChatBot } from '../../../components/ChatBot';
import { drawerNavRef } from '../../../navigation/AppNavigator';
import type {
  AppStackParamList,
  MainTabParamList,
} from '../../../navigation/types';
import { useAuth } from '../../../context/AuthContext';
import { useDoorAccess } from '../../../hooks/useDoorAccess';
import { openDoor } from '../../../services/doorAccessService';
import { getCustomerAttendants } from '../../../services/attendantService';
import { getWorkspaces } from '../../../services/workspaceService';
import {
  INPUT_LIMITS,
  sanitizeTextForState,
} from '../../../utils/inputSanitizer';
import { shadows, useThemeColors } from '../../../theme';
import { useAppSelector } from '../../../store/hooks';
import { HOME_SPACING } from '../../Home/constants';
import {
  EmptyState,
  FilterChips,
  HomeHeader,
  SearchSection,
  SectionHeader,
  SkeletonCard,
  WorkspaceCard,
} from '../../Home/components';
import type { HomeFilter, Workspace } from '../../Home/types';
import { Header, HOMEHEADER } from "../../../components/Header";
type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const colors = useThemeColors();
  const { user, isLoadingUser } = useAuth();
  const doorAccess = useDoorAccess();
  const unreadCount = useAppSelector(
    s => s.notifications.items.filter(n => !n.read).length,
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HomeFilter | null>(null);
  const [focused, setFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [attendeeLoading, setAttendeeLoading] = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  useEffect(() => {
    if (isLoadingUser) return;
    setLoading(true);
    getWorkspaces()
      .then(items => setWorkspaces(Array.isArray(items) ? items : []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [isLoadingUser, user]);

  useEffect(() => {
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: 2000, // 2 seconds
      useNativeDriver: true,
    }).start();
  }, [heroOpacity]);

  useEffect(() => {
    const customerId = (user as any)?.customerId ?? (user as any)?.customerCode;
    if (isLoadingUser || !customerId) {
      setAttendeeCount(0);
      setAttendeeLoading(false);
      return;
    }

    let active = true;
    setAttendeeLoading(true);

    getCustomerAttendants(String(customerId))
      .then(result => {
        if (!active) return;
        setAttendeeCount(Array.isArray(result?.items) ? result.items.length : 0);
      })
      .catch(() => {
        if (!active) return;
        setAttendeeCount(0);
      })
      .finally(() => {
        if (active) setAttendeeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLoadingUser, user]);

  const attendanceCapacity = Math.max(10, attendeeCount + 5);
  const attendancePercent = attendeeCount === 0 ? 0 : Math.min(100, Math.round((attendeeCount / attendanceCapacity) * 100));
  const seatsFree = Math.max(0, attendanceCapacity - attendeeCount);

  const filtered = useMemo(
    () =>
      workspaces.filter(workspace =>
        matchesWorkspace(workspace, query, filter),
      ),
    [filter, query, workspaces],
  );
  const sections = useMemo(
    () =>
      [
        {
          title: 'Popular Near You',
          subtitle: 'Workspaces people are booking now',
          data: filtered,
        },
        {
          title: 'Recommended',
          subtitle: 'Chosen for the way you work',
          data: filtered.filter((_, index) => index % 2 === 0),
        },
        {
          title: 'Recently Viewed',
          subtitle: 'Continue exploring spaces',
          data: filtered.slice().reverse(),
        },
        {
          title: 'Top Rated',
          subtitle: 'Highly rated by our community',
          data: filtered,
        },
        {
          title: 'Newest Spaces',
          subtitle: 'Fresh places to do your best work',
          data: filtered.slice().reverse(),
        },
      ].filter(section => section.data.length > 0),
    [filtered],
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getWorkspaces()
      .then(items => setWorkspaces(Array.isArray(items) ? items : []))
      .catch(() => setWorkspaces([]))
      .finally(() => setRefreshing(false));
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    getWorkspaces()
      .then(items => setWorkspaces(Array.isArray(items) ? items : []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, []);

  const selectFilter = useCallback(
    (next: HomeFilter) =>
      setFilter(current => (current === next ? null : next)),
    [],
  );
  const viewDetails = useCallback(
    (workspace: Workspace) =>
      navigation.navigate('SpaceDetail', { workspace: workspace as any }),
    [navigation],
  );
  const bookWorkspace = useCallback(
    (workspace: Workspace) => {
      if (!user) {
        navigation.navigate('Login', {
          redirectAfterLogin: {
            screen: 'MainTabs',
            params: {
              screen: 'Booking',
              params: { initialSearch: workspace.name },
            },
          },
        });
        return;
      }
      navigation.navigate('Booking', { initialSearch: workspace.name });
    },
    [navigation, user],
  );
  const showAll = useCallback(
    () =>
      navigation.navigate(
        'Booking',
        query.trim() ? { initialSearch: query.trim() } : undefined,
      ),
    [navigation, query],
  );
  const onScroll = useCallback((event: any) => {
    const current = event.nativeEvent.contentOffset.y;
    if (Math.abs(current - lastOffset.current) > 12)
      setChatVisible(current <= lastOffset.current || current < 20);
    lastOffset.current = current;
  }, []);
  const renderWorkspace = useCallback(
    ({ item }: { item: Workspace }) => (
      <>
        <WorkspaceCard
          workspace={item}
          onDetails={viewDetails}
          onBook={bookWorkspace}
        />
      </>
    ),
    [bookWorkspace, viewDetails],
  );
  const keyExtractor = useCallback((item: Workspace) => String(item.id), []);

  return (
    <Screen>
      <HOMEHEADER />

      <HomeHeader
        userName={user?.name?.split(' ')[0]}
        location={workspaces[0]?.location || 'Your current location'}
        isGuest={!user}
        onSignIn={() => navigation.navigate('Login')}
        onNotifications={() => navigation.navigate('Notifications' as any)}
        unreadCount={unreadCount}
        onMenu={() => drawerNavRef.open()}
        onBookings={() => navigation.navigate('MyBookings')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SearchSection
          value={query}
          focused={focused}
          onChangeText={value =>
            setQuery(
              sanitizeTextForState(value, { maxLength: INPUT_LIMITS.search }),
            )
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmit={showAll}
          onFilter={showAll}
        />

        <View style={styles.quickAccessWrap}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Live occupancy</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open attendees"
            onPress={() => navigation.navigate('Attendees')}
          >
            <View style={[styles.occupancyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.occupancyHeaderRow}>
                <Text style={[styles.occupancyTitle, { color: colors.foreground }]}>Attendance</Text>
                <Text style={[styles.occupancyValue, { color: colors.foreground }]}>
                  {attendeeLoading ? '…' : attendeeCount}
                </Text>
              </View>
              <View style={styles.occupancyMetaRow}>
                <Text style={[styles.occupancyMeta, { color: colors.mutedForeground }]}>
                  {attendeeLoading ? 'Refreshing data…' : 'Active people on this account'}
                </Text>
                <Text style={[styles.occupancyMeta, { color: colors.mutedForeground }]}>
                  {attendeeLoading ? 'API' : `of ${attendanceCapacity} seats`}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${attendancePercent}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.occupancyFooterRow}>
                <Text style={[styles.occupancyFooter, { color: colors.foreground }]}>
                  {attendeeLoading ? 'Loading attendees' : `${attendeeCount} present now`}
                </Text>
                <Text style={[styles.occupancyFooter, { color: colors.mutedForeground }]}>
                  {attendeeLoading ? '…' : `${seatsFree} seats free`}
                </Text>
              </View>
            </View>
          </Pressable>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Quick access</Text>

          <View style={styles.quickGrid}>
            {[
              { label: 'Quotation', icon: 'document-text-outline', screen: 'QuotationList' },
              { label: 'Booking', icon: 'calendar-outline', screen: 'Booking' },
              { label: 'Invoice', icon: 'receipt-outline', screen: 'MyPayments' },
              doorAccess?.canOpenDoor
                ? { label: 'Open Door', icon: 'lock-open-outline', screen: '' }
                : { label: 'Access Request', icon: 'key-outline', screen: 'AccessRequest' },
            ].map(item => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => (item.screen ? navigation.navigate(item.screen as any) : openDoor(doorAccess))}
                style={[
                  styles.quickCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.primaryMuted }]}>
                  <Ionicons name={item.icon as any} size={22} color={colors.primary} />
                </View>
                <Text style={[styles.quickLabel, { color: colors.foreground }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {/* <FilterChips activeFilter={filter} onSelect={selectFilter} /> */}
        {/* <View style={styles.featured}>
          <SectionHeader
            title="Featured Spaces"
            subtitle="Flexible spaces, ready when you are"
            onPress={showAll}
          />
          <FlatList
            horizontal
            data={loading ? [] : filtered.slice(0, 6)}
            renderItem={renderWorkspace}
            keyExtractor={keyExtractor}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ListEmptyComponent={
              loading ? (
                <View style={styles.horizontalList}>
                  <SkeletonCard />
                </View>
              ) : (
                <EmptyState
                  onClear={() => {
                    setQuery('');
                    setFilter(null);
                  }}
                />
              )
            }
            initialNumToRender={3}
            maxToRenderPerBatch={4}
            windowSize={3}
            removeClippedSubviews
          />
        </View>
        <View style={styles.premium}>
          <SectionHeader
            title="Premium Spaces"
            subtitle="Exceptional work deserves an exceptional setting"
            onPress={showAll}
          />
          <FlatList
            horizontal
            data={loading ? [] : filtered.slice(0, 5)}
            renderItem={({ item }) => (
              <WorkspaceCard
                workspace={item}
                onDetails={viewDetails}
                onBook={bookWorkspace}
                premium
              />
            )}
            keyExtractor={keyExtractor}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ListEmptyComponent={
              loading ? (
                <View style={styles.horizontalList}>
                  <SkeletonCard />
                </View>
              ) : null
            }
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            windowSize={3}
            removeClippedSubviews
          />
        </View> */}
        {/* {sections.map(section => (
          <View style={styles.listSection} key={section.title}>
            <SectionHeader
              title={section.title}
              subtitle={section.subtitle}
              onPress={showAll}
            />
            <FlatList
              horizontal
              data={section.data}
              renderItem={renderWorkspace}
              keyExtractor={keyExtractor}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews
            />
          </View>
        ))} */}
      </ScrollView>
      <ChatBot visible={chatVisible} />
    </Screen>
  );
}

function matchesWorkspace(
  workspace: Workspace,
  query: string,
  filter: HomeFilter | null,
) {
  const searchable = `${workspace.name} ${workspace.location} ${workspace.type
    } ${(workspace.amenities || []).join(' ')}`.toLowerCase();
  if (query.trim() && !searchable.includes(query.trim().toLowerCase()))
    return false;
  if (!filter || filter === 'Daily' || filter === 'Monthly') return true;
  const aliases: Record<Exclude<HomeFilter, 'Daily' | 'Monthly'>, string[]> = {
    'Private Office': ['private', 'office'],
    'Meeting Room': ['meeting'],
    'Shared Desk': ['shared', 'co-working', 'cowork'],
    'Conference Hall': ['conference', 'event', 'hall'],
  };
  return aliases[filter].some(alias =>
    workspace.type.toLowerCase().includes(alias),
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
    marginHorizontal: HOME_SPACING.sm,
    overflow: 'visible',
  },
  quickAccessWrap: {
    marginTop: HOME_SPACING.md,
    gap: HOME_SPACING.sm,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: HOME_SPACING.xs,
  },
  occupancyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: HOME_SPACING.md,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  occupancyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occupancyTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  occupancyValue: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  occupancyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  occupancyMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: HOME_SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  occupancyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: HOME_SPACING.sm,
  },
  occupancyFooter: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickCard: {
    width: '48%',
    minHeight: 126,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: HOME_SPACING.md,
    paddingHorizontal: HOME_SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: HOME_SPACING.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: HOME_SPACING.sm,
  },
  quickAccessCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: HOME_SPACING.md,
    paddingHorizontal: HOME_SPACING.md,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  fullWidthCard: {
    width: '100%',
    minHeight: 92,
  },
  halfWidthCard: {
    flex: 1,
    minHeight: 86,
  },
  quickAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HOME_SPACING.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  quickAccessSubtitle: {
    marginTop: HOME_SPACING.xs,
    fontSize: 13,
    fontWeight: '600',
  },
  hero: {
    marginHorizontal: HOME_SPACING.md,
    padding: HOME_SPACING.lg,
    borderRadius: 24,
    marginBottom: HOME_SPACING.md,
    ...shadows.sm,
  },
  heroTitle: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: HOME_SPACING.sm,
    maxWidth: 310,
  },
  featured: {
    marginTop: HOME_SPACING.xl,
    overflow: 'visible',
    paddingVertical: HOME_SPACING.md,
    width: '100%',
  },
  premium: {
    marginTop: HOME_SPACING.xl,
    overflow: 'visible',
    paddingVertical: HOME_SPACING.md,
    width: '100%',
  },
  listSection: {
    marginTop: HOME_SPACING.xl,
    overflow: 'visible',
    paddingVertical: HOME_SPACING.md,
    width: '100%',
  },
  horizontalList: {
    paddingLeft: HOME_SPACING.md,
    paddingRight: HOME_SPACING.lg,
    paddingVertical: HOME_SPACING.md,
    marginBottom: HOME_SPACING.md,
  },
});
