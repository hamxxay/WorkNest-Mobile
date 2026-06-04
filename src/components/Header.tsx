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
      gap: 12,
      marginBottom: 16,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoImage: {
      width: 28,
      height: 28,
      borderRadius: radii.sm,
    },
    logoText: {
      fontSize: 22,
      fontWeight: '700',
      color: themeColors.foreground,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    button: {
      width: 42,
      height: 42,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuButton: {
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
  }));
  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image source={require('../../public/Logo.png')} style={styles.logoImage} />
        <Text style={styles.logoText}>WorkNest</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={openDrawer} style={[styles.button, styles.menuButton]}>
          <Ionicons name="menu" size={22} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}
