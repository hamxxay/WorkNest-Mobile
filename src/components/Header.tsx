import { Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii } from '../theme';

export function Header() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
          <Text style={styles.menuText}>Menu</Text>
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
    color: colors.foreground,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  menuButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  menuText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
});
