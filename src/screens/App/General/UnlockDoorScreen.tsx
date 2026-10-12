import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../../components/Screen';
import { Header } from '../../../components/Header';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import {
  getDoorAccess,
  getDoors,
  unlockDoor,
  type DoorAccess,
  type DoorInfo,
} from '../../../services/doorAccessService';
import { errorMessage } from '../../../services/apiClient';

type Status = { kind: 'ok' | 'error'; text: string } | null;

/**
 * Unlock Door: opens the verified access user's room door only (entrances use card, fingerprint or face).
 * Tapping Unlock asks the API to open it on the machine; the result shows under the door.
 */
export default function UnlockDoorScreen({ navigation }: { navigation: any }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const [access, setAccess] = useState<DoorAccess | null>(null);
  const [doors, setDoors] = useState<DoorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [status, setStatus] = useState<Record<number, Status>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = user?.email ? await getDoorAccess(user.email) : null;
      setAccess(current);
      if (!current?.canOpenDoor || !current.selectedSpace) {
        setDoors([]);
        setError('Verify your access first to unlock doors.');
        return;
      }
      const result = await getDoors(current);
      setDoors(result.doors ?? []);
      if (!result.doors?.length) setError(result.message || 'No doors found for your room.');
    } catch (err) {
      setDoors([]);
      setError(errorMessage(err, 'Could not load your doors. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onUnlock = async (door: DoorInfo) => {
    if (!access || unlocking !== null) return;
    setUnlocking(door.deviceId);
    setStatus(prev => ({ ...prev, [door.deviceId]: null }));
    try {
      const message = await unlockDoor(access, door.deviceId);
      setStatus(prev => ({ ...prev, [door.deviceId]: { kind: 'ok', text: message } }));
    } catch (err) {
      setStatus(prev => ({
        ...prev,
        [door.deviceId]: { kind: 'error', text: errorMessage(err, 'The door did not unlock. Please try again.') },
      }));
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <Screen>
      <Header />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name="lock-open-outline" size={24} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>ACCESS</Text>
            <Text style={styles.title}>Unlock Door</Text>
            {access?.selectedSpace?.spaceName ? (
              <Text style={styles.subtitle}>Room: {access.selectedSpace.spaceName}</Text>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading your doors…</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={load}>
                <Text style={[styles.secondaryText, { color: colors.foreground }]}>Try again</Text>
              </Pressable>
              {!access?.canOpenDoor ? (
                <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('AccessRequest')}>
                  <Text style={styles.primaryText}>Verify access</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          doors.map(door => {
            const s = status[door.deviceId];
            const busy = unlocking === door.deviceId;
            return (
              <View key={door.deviceId} style={styles.card}>
                <View style={styles.doorRow}>
                  <Ionicons
                    name={door.kind === 'room' ? 'business-outline' : 'enter-outline'}
                    size={22}
                    color={colors.primary}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.doorName}>{door.name}</Text>
                    <Text style={styles.muted}>
                      Your room door{door.online ? '' : ' · may be offline'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Unlock ${door.name}`}
                    style={[styles.primaryBtn, (busy || unlocking !== null) && styles.disabled]}
                    disabled={unlocking !== null}
                    onPress={() => onUnlock(door)}
                  >
                    {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Unlock</Text>}
                  </Pressable>
                </View>
                {s ? (
                  <Text style={[styles.status, { color: s.kind === 'ok' ? colors.success : colors.danger }]}>
                    {s.text}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.note}>The app unlocks your room door only. Use your card, fingerprint or face at the building entrances. Every unlock is recorded with your name.</Text>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40, gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.mutedForeground, fontWeight: '700' },
    title: { fontSize: 28, fontWeight: '800', color: colors.foreground, letterSpacing: -0.7, marginTop: 2 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    center: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      gap: 10,
    },
    doorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    doorName: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    muted: { fontSize: 13, color: colors.mutedForeground },
    errorText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
    row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    primaryBtn: {
      minHeight: 48,
      minWidth: 110,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.55 },
    status: { fontSize: 14, fontWeight: '600' },
    note: { fontSize: 12, color: colors.mutedForeground, marginTop: 6, lineHeight: 18 },
  });
