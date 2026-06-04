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
import {
  INPUT_LIMITS,
  sanitizeEmailInput,
  sanitizeTextForState,
} from "../../utils/inputSanitizer";

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
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { firstName, lastName } = parseName(name);
      await registerUser({
        email: sanitizeEmailInput(email),
        password: sanitizeTextForState(password, { maxLength: INPUT_LIMITS.password }),
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
                onChangeText={(value) =>
                  setName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))
                }
                maxLength={INPUT_LIMITS.name}
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
                onChangeText={(value) =>
                  setEmail(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.email }))
                }
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={INPUT_LIMITS.email}
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
                onChangeText={(value) =>
                  setPassword(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.password }))
                }
                secureTextEntry={!showPassword}
                autoCapitalize="none"       
                autoCorrect={false}
                autoComplete="off"
                maxLength={INPUT_LIMITS.password}
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
                onChangeText={(value) =>
                  setConfirmPassword(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.password }))
                }
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                secureTextEntry={!showPassword}
                maxLength={INPUT_LIMITS.password}
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
                <ActivityIndicator size="small" color={colors.white} />
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
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
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
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: 28,
    gap: 6,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.foreground,
  },
  brandSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 26,
    gap: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: -8,
    lineHeight: 21,
  },
  label: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.3,
    marginBottom: -8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: colors.muted,
  },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    backgroundColor: colors.dangerMuted,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: colors.card,
  },
  googleButtonText: {
    color: colors.foreground,
    fontWeight: "700",
    fontSize: 15,
  },
  helperText: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
});
