import { useRoute } from '@react-navigation/native';
import { AppHeader } from './ui/AppHeader';

/**
 * Legacy headers, kept for existing screens. Both now render the themed AppHeader from the UI kit
 * (status bar colour and the top safe-area inset are handled automatically).
 * New code: `import { AppHeader } from '../components/ui'`.
 */

const SCREEN_LABELS: Record<string, string> = {
  Home: 'Home',
  Booking: 'Book a Space',
  MyBookings: 'My Bookings',
  MyPayments: 'My Invoices',
  Gallery: 'Gallery',
  Profile: 'Profile',
  BookingHistory: 'Booking History',
  PrivacyPolicy: 'Privacy Policy',
  AboutUs: 'About Us',
  ContactUs: 'Contact Us',
  SpaceDetail: 'Space Detail',
  BookingInfo: 'Booking Info',
  Payment: 'Payment',
  Attendees: 'Attendees',
  AdminPanel: 'Admin Panel',
  AgreementList: 'My Agreements',
  ESignAgreement: 'Sign Agreement',
  KycDocuments: 'KYC Documents',
};

/** Teal home header: logo, "WORKNEST" overline and "Dashboard". */
export function HomeHeader() {
  return <AppHeader variant="dashboard" tone="teal" overline="WorkNest" title="Dashboard" />;
}

export const HOMEHEADER = HomeHeader;

/** Surface header with the logo, a "WORKNEST" overline and the current screen's name. */
export function Header() {
  const route = useRoute();
  const isHome = route.name === 'Home';
  const screenLabel = SCREEN_LABELS[route.name] ?? route.name;

  return (
    <AppHeader
      variant="brand"
      overline={isHome ? undefined : 'WorkNest'}
      title={isHome ? 'Dashboard' : screenLabel}
    />
  );
}
