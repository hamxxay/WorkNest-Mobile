import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { drawerNavRef } from '../navigation/AppNavigator';

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
  const route   = useRoute();
  const colors  = useThemeColors();
  const { user } = useAuth();

  const isHome      = route.name === 'Home';
  const firstName   = user?.name?.split(' ')[0] ?? 'there';
  const screenLabel = SCREEN_LABELS[route.name] ?? route.name;

  const openDrawer = () => {
    drawerNavRef.open();
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.brandSection}>
        <Image
          source={require('../../public/Logo1.png')}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <View style={styles.textBlock}>
          {isHome ? (
            <>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {firstName}
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

      <Pressable
        hitSlop={10}
        onPress={openDrawer}
        style={[styles.menuBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="menu-outline" size={22} color={colors.foreground} />
      </Pressable>
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
    gap: 2,
    flex: 1,
  },
  textBlock: { flex: 1 },
  logoImg: {
    width: 38,
    height: 38,
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
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    elevation: 2,
  },
});
