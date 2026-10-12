import { useSyncExternalStore } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { haptics, isHapticsEnabled, setHapticsEnabled, subscribeHaptics } from "../../utils/haptics";
import { SwitchRow } from "./Switch";

export type HapticsSettingProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * On / off switch for the app's haptic feedback, saved on the device. Sits under AppearanceSetting:
 *   <Card><AppearanceSetting /><Divider spacing={12} /><HapticsSetting /></Card>
 * Android's own vibration / touch feedback setting still applies on top.
 */
export function HapticsSetting({ style }: HapticsSettingProps) {
  const enabled = useSyncExternalStore(subscribeHaptics, isHapticsEnabled, isHapticsEnabled);
  return (
    <SwitchRow
      label="Haptic feedback"
      description="Gentle vibrations when you confirm, unlock a door or something goes wrong."
      value={enabled}
      onValueChange={(value) => {
        setHapticsEnabled(value);
        // A small tick so the user feels what they just turned on.
        if (value) haptics.selection();
      }}
      style={[styles.row, style]}
    />
  );
}

const styles = StyleSheet.create({
  // Inside a padded Card: the card already provides the side padding.
  row: { paddingHorizontal: 0 },
});
