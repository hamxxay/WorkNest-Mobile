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
  confirmGoogleLogin,
  loginUser,
  requestPasswordReset,
  type PendingGoogleAuth,
} from "../../services/authService";
import {
  INPUT_LIMITS,
  sanitizeEmailInput,
  sanitizeTextForState,
} from "../../utils/inputSanitizer";

export default function LoginScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<PendingGoogleAuth | null>(null);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const routeToApp = () => {
    rootNavigation?.replace("AppStack", { screen: "MainTabs" });
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await loginUser({
        email: sanitizeEmailInput(email),
        password: sanitizeTextForState(password, { maxLength: INPUT_LIMITS.password }),
      });
      routeToApp();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to login right now. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const pending = await beginGoogleAuth();
      setPendingGoogleAuth(pending);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to login with Google right now. Please try again.";
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConfirmGoogleLogin = async () => {
    if (!pendingGoogleAuth) {
      return;
    }

    try {
      setGoogleLoading(true);
      setError(null);
      await confirmGoogleLogin(pendingGoogleAuth.idToken);
      setPendingGoogleAuth(null);
      routeToApp();
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to login with Google right now. Please try again.";
      setError(message);
      setPendingGoogleAuth(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCancelGoogleLogin = () => {
    setPendingGoogleAuth(null);
    cancelGoogleAuth().catch(() => {});
  };

  const handleForgotPassword = async () => {
    try {
      setError(null);
      await requestPasswordReset(sanitizeEmailInput(email));
      setError("Password reset email sent. Check your inbox.");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to send a password reset email right now.";
      setError(message);
    }
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
            <Text style={styles.brandSubtitle}>Welcome back</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Log In</Text>
            <Text style={styles.subtitle}>
              Access your bookings and workspace history.
            </Text>
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
                textContentType="emailAddress"
                autoComplete="email"
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
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                textContentType="password"
                onChangeText={(value) =>
                  setPassword(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.password }))
                }
                autoComplete="off"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
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

            {/* {!!error && (
              <View style={styles.errorBlock}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )} */}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Log In</Text>
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
              onPress={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color={colors.foreground} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.linkButton} onPress={handleForgotPassword}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => navigation.navigate("Signup")}
            >
              <Text style={styles.linkText}>Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={Boolean(pendingGoogleAuth)}
        title="Continue with Google?"
        message={
          pendingGoogleAuth
            ? `Continue as ${pendingGoogleAuth.name ?? pendingGoogleAuth.email} (${pendingGoogleAuth.email})?`
            : ""
        }
        confirmText="Continue"
        cancelText="Cancel"
        onCancel={handleCancelGoogleLogin}
        onConfirm={() => {
          handleConfirmGoogleLogin().catch(() => {});
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
