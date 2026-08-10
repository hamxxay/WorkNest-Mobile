import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { ChatBot } from '../../components/ChatBot';
import { drawerNavRef } from '../../navigation/AppNavigator';
import type {
  AppStackParamList,
  MainTabParamList,
} from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaces } from '../../services/workspaceService';
import { INPUT_LIMITS, sanitizeTextForState } from '../../utils/inputSanitizer';
import { shadows, useThemeColors } from '../../theme';
import { useAppSelector } from '../../store/hooks';
import { HOME_SPACING } from '../Home/constants';
import {
  EmptyState,
  FilterChips,
  HomeHeader,
  SearchSection,
  SectionHeader,
  SkeletonCard,
  WorkspaceCard,
} from '../Home/components';
import type { HomeFilter, Workspace } from '../Home/types';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavigation>();
  const colors = useThemeColors();
  const { user, isLoadingUser } = useAuth();
  const unreadCount = useAppSelector(s => s.notifications.items.filter(n => !n.read).length);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HomeFilter | null>(null);
  const [focused, setFocused] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
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
    getWorkspaces().then(items => setWorkspaces(Array.isArray(items) ? items : [])).catch(() => setWorkspaces([])).finally(() => setRefreshing(false));
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    getWorkspaces().then(items => setWorkspaces(Array.isArray(items) ? items : [])).catch(() => setWorkspaces([])).finally(() => setLoading(false));
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
      <WorkspaceCard
        workspace={item}
        onDetails={viewDetails}
        onBook={bookWorkspace}
      />
    ),
    [bookWorkspace, viewDetails],
  );
  const keyExtractor = useCallback((item: Workspace) => String(item.id), []);

  return (
    <Screen>
      <HomeHeader
        userName={user?.name?.split(' ')[0]}
        location={workspaces[0]?.location || 'Your current location'}
        isGuest={!user}
        onSignIn={() => navigation.navigate('Login')}
        onNotifications={() => navigation.navigate('Notifications' as any)}
        unreadCount={unreadCount}
        onMenu={() => drawerNavRef.open()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroOpacity,
              backgroundColor: colors.successMuted,
              transform: [
                {
                  translateY: heroOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Find Your Perfect{`\n`}
            <Text style={{ color: colors.primary }}>Workspace</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            Book private offices, meeting rooms, and coworking spaces instantly.
          </Text>
        </Animated.View>
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
        <FilterChips activeFilter={filter} onSelect={selectFilter} />
        <View style={styles.featured}>
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
        </View>
        {sections.map(section => (
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
        ))}
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
  const searchable = `${workspace.name} ${workspace.location} ${
    workspace.type
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
  content: { paddingBottom: 16 , marginHorizontal: HOME_SPACING.sm, overflow: 'visible' },
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
  featured: { marginTop: HOME_SPACING.xl , overflow: 'visible', paddingVertical: HOME_SPACING.md, marginLeft: -HOME_SPACING.sm, width: '140%'},
  premium: { marginTop: HOME_SPACING.xl , overflow: 'visible', paddingVertical: HOME_SPACING.md, marginLeft: -HOME_SPACING.sm, width: '140%'},
  listSection: { marginTop: HOME_SPACING.xl,  overflow: 'visible', paddingVertical: HOME_SPACING.md, marginLeft: -HOME_SPACING.sm, width: '140%'},
  horizontalList: {
    paddingLeft: HOME_SPACING.md,
    paddingRight: HOME_SPACING.xs,
    paddingVertical: HOME_SPACING.md,
    marginBottom: HOME_SPACING.md,
  },
});
