import { Linking, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Button, IconButton } from "../../../../components/ui";
import { palette, useTheme } from "../../../../theme";
import { isWhatsAppUrl } from "../../../../utils/inquiry";

// "Open in WhatsApp" for the WhatsApp Inbox: the app never sends from the inbox (the CMS lets only admins reply
// there), so staff reply from their own WhatsApp. The link is the conversation's whatsAppUrl
// (utils/inquiry whatsappContactUrl: https://wa.me/<digits>, "" without a usable number -> the button is disabled).

/** WhatsApp green with white text that stays readable (5.5:1) in light and dark mode. */
const WHATSAPP_GREEN = palette.emerald[700];

/** Opens a wa.me link in WhatsApp (or the browser); anything that isn't a WhatsApp chat link is ignored. */
export function openWhatsAppChat(url: string | null | undefined): void {
  if (!url || !isWhatsAppUrl(url)) return;
  Linking.openURL(url).catch(() => undefined);
}

/** Full-width green "Open in WhatsApp" button (conversation footer). */
export function OpenWhatsAppButton({ url, name, style }: { url: string; name: string; style?: StyleProp<ViewStyle> }) {
  const disabled = !url;
  return (
    <Button
      title="Open in WhatsApp"
      leftIcon="logo-whatsapp"
      fullWidth
      disabled={disabled}
      onPress={() => openWhatsAppChat(url)}
      accessibilityLabel={disabled ? "Open in WhatsApp: this contact has no valid number" : `Message ${name} on WhatsApp`}
      style={[styles.green, style]}
    />
  );
}

/** Small round WhatsApp button (list rows). */
export function WhatsAppIconButton({ url, name }: { url: string; name: string }) {
  const { tones } = useTheme();
  return (
    <IconButton
      icon="logo-whatsapp"
      variant="tonal"
      color={tones.success.fg}
      disabled={!url}
      onPress={() => openWhatsAppChat(url)}
      accessibilityLabel={url ? `Message ${name} on WhatsApp` : `WhatsApp: no valid number for ${name}`}
    />
  );
}

const styles = StyleSheet.create({
  green: { backgroundColor: WHATSAPP_GREEN },
});
