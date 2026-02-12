import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";

export default function SignupScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Text style={styles.brandTitle}>WorkNest</Text>
            <Text style={styles.brandSubtitle}>Create your account</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>
              Set up your account in less than a minute.
            </Text>
            <Text style={styles.label}>Full name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.mutedForeground}
              />
              <TextInput
                placeholder="Jane Doe"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.mutedForeground}
              />
              <TextInput
                placeholder="Create a password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.mutedForeground}
              />
              <TextInput
                placeholder="Re-enter password"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => navigation.replace("MainTabs")}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => navigation.replace("Login")}
            >
              <Text style={styles.linkText}>Already have an account? Log in</Text>
            </Pressable>

            <Text style={styles.helperText}>
              By signing up, you agree to our Terms and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  brandBlock: {
    marginBottom: 20,
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.foreground,
  },
  brandSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginTop: -4,
    marginBottom: 6,
  },
  label: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: colors.muted,
  },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 16,
  },
  helperText: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 2,
  },
  linkText: {
    color: colors.secondary,
    fontWeight: "600",
    fontSize: 14,
  },
});
