import { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors } from '../../../theme';

export const SearchSection = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const quickSections = [
    { label: 'Quotation', icon: 'document-text-outline', screen: 'QuotationList' },
    { label: 'Invoices', icon: 'receipt-outline', screen: 'MyPayments' },
    { label: 'Attendees', icon: 'people-outline', screen: 'Attendees' },
    { label: 'Booking', icon: 'calendar-outline', screen: 'Booking' },
    { label: 'Access Request', icon: 'key-outline', screen: 'AccessRequest' },
  ];

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.searchRow,
          focused && styles.searchRowFocused,
          { borderColor: focused ? colors.primary : colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => {
            if (query.trim()) navigation.navigate('Booking', { initialSearch: query.trim() });
          }}
          placeholder="Search spaces or locations…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('Booking')} style={styles.searchButton}>
            <Ionicons name="options-outline" size={16} color={colors.primary} />
          </Pressable>
        )}
      </Animated.View>

      <View style={styles.quickGrid}>
        {quickSections.map(item => (
          <Pressable
            key={item.label}
            onPress={() => {
              if (['QuotationList', 'MyPayments', 'BookingHistory', 'Booking', 'Profile', 'AccessRequest'].includes(item.screen)) {
                navigation.navigate(item.screen);
              }
            }}
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name={item.icon as any} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.quickText, { color: colors.foreground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchRowFocused: {
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '31.5%',
    minHeight: 82,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
});