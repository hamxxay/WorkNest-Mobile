import { useState } from "react";
import {
  ActivityIndicator,
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
import type { AuthStackParamList, RootStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ConfirmModal } from "../../components/ConfirmModal";
import { radii, useThemeColors, useThemedStyles } from "../../theme";
import { ApiError } from "../../services/apiClient";
import {
  beginGoogleAuth,
  cancelGoogleAuth,
  confirmGoogleSignup,
  registerUser,
  type PendingGoogleAuth,
} from "../../services/authService";

export default function SignupScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<PendingGoogleAuth | null>(null);

  const parseName = (fullName: string): { firstName?: string; lastName?: string } => {
    const normalized = fullName.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return {};
    }
    const [firstName, ...rest] = normalized.split(" ");
    return {
      firstName,
      lastName: rest.length ? rest.join(" ") : undefined,
    };
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { firstName, lastName } = parseName(name);
      await registerUser({
        email: email.trim(),
        password,
        firstName,
        lastName,
      });

      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.replace("AppStack", { screen: "MainTabs" });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to create account right now. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const pending = await beginGoogleAuth();
      setPendingGoogleAuth(pending);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to create account with Google right now. Please try again.";
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConfirmGoogleSignup = async () => {
    if (!pendingGoogleAuth) {
      return;
    }

    try {
      setGoogleLoading(true);
      setError(null);
      await confirmGoogleSignup(pendingGoogleAuth.idToken);
      setPendingGoogleAuth(null);
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.replace("AppStack", { screen: "MainTabs" });
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to create account with Google right now. Please try again.";
      setError(message);
      setPendingGoogleAuth(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCancelGoogleSignup = () => {
    setPendingGoogleAuth(null);
    cancelGoogleAuth().catch(() => {});
  };

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
                autoCapitalize="none"       
                autoCorrect={false}
                autoComplete="off"
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
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                secureTextEntry={!showPassword}
                style={styles.input}
              />
            </View>

            {/* {!!error && <Text style={styles.errorText}>{error}</Text>} */}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSignup}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.googleButton, googleLoading && styles.primaryButtonDisabled]}
              onPress={handleGoogleSignup}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={colors.foreground} />
                  <Text style={styles.googleButtonText}>Sign Up with Google</Text>
                </>
              )}
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

      <ConfirmModal
        visible={Boolean(pendingGoogleAuth)}
        title="Create account with Google?"
        message={
          pendingGoogleAuth
            ? `Create your WorkNest account as ${pendingGoogleAuth.name ?? pendingGoogleAuth.email} (${pendingGoogleAuth.email})?`
            : ""
        }
        confirmText="Continue"
        cancelText="Cancel"
        onCancel={handleCancelGoogleSignup}
        onConfirm={() => {
          handleConfirmGoogleSignup().catch(() => {});
        }}
      />
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
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
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: "700",
    fontSize: 16,
  },
  
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    backgroundColor: colors.muted,
  },
  googleButtonText: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 15,
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
