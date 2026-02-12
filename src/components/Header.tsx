import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, radii } from '../theme';
import { logoutUser } from '../services/authService';

const destructiveColor = '#dc2626';

export function Header() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutUser();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const confirmLogout = () => setShowLogoutConfirm(true);

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logoMark} />
        <Text style={styles.logoText}>WorkNest</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={confirmLogout}
          style={[styles.button, styles.dangerButton]}
        >
          <Text style={styles.dangerText}>Log Out</Text>
        </Pressable>
        {/* <Pressable
          onPress={() => navigation.navigate('Signup')}
          style={[styles.button, styles.primaryButton]}
        >
          <Text style={styles.primaryText}>Sign Up</Text>
        </Pressable> */}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showLogoutConfirm}
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowLogoutConfirm(false)}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={[styles.button, styles.dangerSolidButton]}
              >
                <Text style={styles.dangerSolidText}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
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
  dangerButton: {
    borderWidth: 1,
    borderColor: destructiveColor,
    backgroundColor: colors.background,
  },
  dangerText: {
    color: destructiveColor,
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.foreground,
  },
  modalMessage: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  dangerSolidButton: {
    backgroundColor: destructiveColor,
  },
  dangerSolidText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
