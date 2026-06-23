import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { DrawerActions, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors } from '../theme';

/** Maps raw route names → human-readable labels shown in the header center. */
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

export function Header() {
  const navigation = useNavigation();
  const route = useRoute();
  const colors = useThemeColors();

  const screenLabel = SCREEN_LABELS[route.name] ?? route.name;

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>

    
    
     {/* Right — menu button with notification dot */}
      <Pressable
        hitSlop={8}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        style={[styles.menuBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Ionicons name="menu-outline" size={22} color={colors.foreground} />
        {/* Notification dot */}
        {/* <View style={[styles.dot, { backgroundColor: colors.primary }]} /> */}
      </Pressable>

      
      {/* Center — current screen name */}
      <Text style={[styles.screenName, { color: colors.mutedForeground }]} numberOfLines={1}>
        {screenLabel}
      </Text>

        {/* Left — logo + wordmark */}
      <View style={styles.brand}>
        {/* <View style={[styles.logoWell, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
          <Image
            source={require('../../public/Logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View> */}
        <Text style={{}}>.</Text>
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  logoWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  logoImg: {
    width: 22,
    height: 22,
  },
  brandText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.1,
    flexShrink: 1,
    marginHorizontal: 8,
    textAlign: 'center',
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
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
