import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../navigation/types';
import { radii, useThemeColors, useThemedStyles } from '../theme';

export function Header() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const styles = useThemedStyles((themeColors) => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      paddingVertical: 4,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoWell: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: themeColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: themeColors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    logoImage: {
      width: 22,
      height: 22,
    },
    logoText: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: themeColors.foreground,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    menuButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      shadowColor: themeColors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  }));

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoWell}>
          <Image source={require('../../public/Logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.logoText}>WorkNest</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={openDrawer} style={styles.menuButton}>
          <Ionicons name="menu" size={20} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}
