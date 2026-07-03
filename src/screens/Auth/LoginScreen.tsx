import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { useThemeColors, useThemedStyles } from "../../theme";
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

const { width: SW } = Dimensions.get("window");

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
      <View style={styles.bgDecor1} />
      <View style={styles.bgDecor2} />
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
            <View style={styles.logoWell}>
              <View style={styles.logoGlow} />
              <Image
                source={require("../../../public/Logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>WorkNest</Text>
            <Text style={styles.brandSubtitle}>Welcome back 👋</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Sign In</Text>
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

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
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
                  <Ionicons name="logo-google" size={18} color={colors.primary} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.footerLinks}>
              <Pressable style={styles.linkButton} onPress={handleForgotPassword}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
              <Text style={styles.footerDivider}>·</Text>
              <Pressable
                style={styles.linkButton}
                onPress={() => navigation.navigate("Signup")}
              >
                <Text style={styles.linkText}>Create account</Text>
              </Pressable>
            </View>
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
  flex: { flex: 1 },
  bgDecor1: {
    position: "absolute",
    width: SW * 1.2,
    height: SW * 1.2,
    borderRadius: SW * 0.6,
    backgroundColor: colors.primaryMuted,
    top: -SW * 0.65,
    right: -SW * 0.25,
    opacity: 0.55,
  },
  bgDecor2: {
    position: "absolute",
    width: SW * 0.7,
    height: SW * 0.7,
    borderRadius: SW * 0.35,
    backgroundColor: colors.secondary,
    bottom: -SW * 0.2,
    left: -SW * 0.2,
    opacity: 0.06,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 44,
    paddingBottom: 48,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: 36,
    gap: 8,
  },
  logoWell: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoGlow: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 26,
    backgroundColor: colors.secondary,
    opacity: 0.3,
  },
  logo: { width: 48, height: 48 },
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
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  footerDivider: {
    color: colors.border,
    fontSize: 18,
    fontWeight: "300",
  },
  linkButton: {
    paddingVertical: 2,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
});
