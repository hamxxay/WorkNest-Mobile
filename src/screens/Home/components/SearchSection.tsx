import { View, TextInput, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useThemeColors } from '../../../theme';
import { FILTER_CHIPS } from '../constants';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SearchSection = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);

  const filteredSearchOptions = (query) => {
    if (!query) return FILTER_CHIPS;
    const lowerQuery = query.toLowerCase();
    return FILTER_CHIPS.filter(option => 
      option.label.toLowerCase().includes(lowerQuery)
    );
  };

  const handleFilterPress = (filter) => {
    setActiveFilter(filter);
    setSearchQuery(filter.label);
    setFilteredOptions([]);
    navigation.navigate('Booking', { initialRoomType: filter.id });
  };

  const suggestions = useCallback(() => {
    const filtered = filteredSearchOptions(searchQuery);
    setFilteredOptions(filtered.slice(0, 8));
  }, [searchQuery, filteredSearchOptions]);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={[styles.searchRow, isFocused && styles.searchRowFocused]}>
        <View style={styles.searchIconWrapper}>
          <Ionicons name="search" size={18} color={colors.primary} />
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => {
            setIsFocused(true);
            suggestions();
          }}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              navigation.navigate('Booking', { initialSearch: searchQuery.trim() });
            }
          }}
          placeholder="Search spaces or locations…"
          placeholderTextColor={colors.mutedForeground}
          maxLength={50}
          returnKeyType="search"
          style={[styles.searchInput, isFocused && styles.searchInputFocused]}
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.searchCloseButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Booking')}
            style={styles.searchButton}
          >
            <Ionicons name="options-outline" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Filter Chips */}
      {filteredOptions.length > 0 && (
        <View style={styles.filterContainer}>
          {filteredOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => handleFilterPress(option)}
              style={[
                styles.filterChip, 
                activeFilter?.id === option.id && styles.filterChipActive
              ]}
            >
              <Text style={[styles.filterChipText, activeFilter?.id === option.id && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Animated Focus State */}
      <Animated.View style={[styles.focusOverlay, isFocused && styles.focusOverlayActive]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F8FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchRowFocused: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIconWrapper: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#333',
    fontSize: 16,
  },
  searchInputFocused: {
    borderColor: '#0d9488',
    borderWidth: 2,
  },
  searchCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E9ECEF',
  },
  filterChipActive: {
    backgroundColor: '#0d9488',
  },
  filterChipText: {
    color: '#333',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  focusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0d9488',
  },
  focusOverlayActive: {
    opacity: 1,
    animated: true,
  },
});