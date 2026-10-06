import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useThemeColors } from "../theme";
import { drawerNavRef } from "../navigation/AppNavigator";

type Props = {
  /** Top label shown above the title, e.g. "ADMIN" or "SALES" */
  role: string;
  /** Main title shown in the header */
  title: string;
};

export function DashboardHeader({ role, title }: Props) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: '#0D5B5F', borderBottomColor: 'rgba(255,255,255,0.15)' },
      ]}
    >
      {/* ── Left: logo + text ── */}
      <View style={styles.brandSection}>
        <Image
          source={require("../../public/Logo1.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <View style={styles.textBlock}>
          <Text style={[styles.roleLabel, { color: 'rgba(255,255,255,0.75)' }]}>
            {role.toUpperCase()}
          </Text>
          <Text style={[styles.titleText, { color: '#ffffff' }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      {/* ── Right: hamburger menu button ── */}
      <Pressable
        hitSlop={10}
        onPress={() => drawerNavRef.open()}
        style={[
          styles.menuBtn,
          { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.12)' },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: 20 }}
      >
        <Ionicons name="menu-outline" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  logoImg: {
    width: 38,
    height: 38,
  },
  textBlock: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 1,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    elevation: 2,
  },
});
