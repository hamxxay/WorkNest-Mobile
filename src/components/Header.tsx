import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { DrawerActions, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';

const SCREEN_LABELS: Record<string, string> = {
  Home: 'Home',
  Booking: 'Book a Space',
  MyBookings: 'My Bookings',
  MyPayments: 'My Payments',
  Pricing: 'Pricing',
  Gallery: 'Gallery',
  Profile: 'Profile',
  BookingHistory: 'Booking History',
  PrivacyPolicy: 'Privacy Policy',
  AboutUs: 'About Us',
  ContactUs: 'Contact Us',
  SpaceDetail: 'Space Detail',
  BookingInfo: 'Booking Info',
  Payment: 'Payment',
  AdminPanel: 'Admin Panel',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Header() {
  const navigation = useNavigation();
  const route = useRoute();
  const colors = useThemeColors();
  const { user } = useAuth();

  const screenLabel = SCREEN_LABELS[route.name] ?? route.name;
  const isHome = route.name === 'Home';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.container, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.brandSection}>
        <View style={[styles.logoWell, { backgroundColor: colors.primary }]}>
          <Image
            source={require('../../public/Logo1.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.textBlock}>
          {isHome ? (
            <>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {firstName} 👋
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.brandName, { color: colors.primary }]}>WorkNest</Text>
              <Text style={[styles.screenName, { color: colors.foreground }]} numberOfLines={1}>
                {screenLabel}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.rightActions}>
        <Pressable
          hitSlop={8}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          style={[styles.menuBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="menu-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  textBlock: {
    flex: 1,
  },
  logoWell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoImg: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  brandName: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greeting: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 1,
  },
  screenName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
