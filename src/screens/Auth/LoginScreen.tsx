import { useRef, useState } from "react";
import { StyleSheet, Text, View, type TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { AuthStackParamList, RootStackParamList, AppStackParamList } from "../../navigation/types";
import { Banner, Button, ConfirmDialog, GoogleSignInButton, TextField } from "../../components/ui";
import { useTheme } from "../../theme";
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
import { isValidEmail } from "../../utils/validation";
import { AuthLayout, OrDivider } from "./components/AuthLayout";
import { signedInState } from "../../navigation/redirect";

type FieldErrors = { email?: string; password?: string };

export default function LoginScreen() {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList & AppStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, "Login">>();
  const redirectAfterLogin = route.params?.redirectAfterLogin;
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<PendingGoogleAuth | null>(null);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const busy = loading || googleLoading;

  // Signed in: the tabs, plus the screen the customer was opening (a quotation link, Book this space...) on top,
  // so they land where they were going and Back returns to the tabs.
  const routeToApp = () => {
    const state = signedInState(redirectAfterLogin);
    if (rootNavigation) {
      rootNavigation.reset(state);
    } else {
      navigation.reset(state.routes[0].state);
    }
  };

  /** Inline checks before calling the service (the service validates again). */
  const validate = (forReset: boolean): boolean => {
    const next: FieldErrors = {};
    const trimmed = email.trim();
    if (!trimmed) {
      next.email = forReset ? "Enter your email first, then tap Forgot password again." : "Enter your email.";
    } else if (!isValidEmail(trimmed)) {
      next.email = "Enter a valid email address, like name@example.com.";
    }
    if (!forReset && !password) next.password = "Enter your password.";
    setFieldErrors(next);
    return !next.email && !next.password;
  };

  const handleLogin = async () => {
    if (busy) return;
    setResetSentTo(null);
    if (!validate(false)) return;
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
      setResetSentTo(null);
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
    if (resetting) return;
    setError(null);
    setResetSentTo(null);
    if (!validate(true)) return;
    try {
      setResetting(true);
      const address = sanitizeEmailInput(email);
      await requestPasswordReset(address);
      setResetSentTo(address);
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to send a password reset email right now.";
      setError(message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your bookings, invoices and workspace access."
      footer={
        <View style={styles.footerRow}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>New to WorkNest?</Text>
          <Button
            title="Create account"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate("Signup", redirectAfterLogin ? { redirectAfterLogin } : undefined)}
            disabled={busy}
          />
        </View>
      }
    >
      {resetSentTo ? (
        <Banner
          tone="success"
          title="Password reset email sent"
          message={`Check your inbox at ${resetSentTo} for a link to set a new password.`}
          onDismiss={() => setResetSentTo(null)}
        />
      ) : null}
      {error ? <Banner tone="danger" message={error} onDismiss={() => setError(null)} /> : null}

      <TextField
        label="Email"
        required
        leftIcon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={(value) => {
          setEmail(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.email }));
          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
        }}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        maxLength={INPUT_LIMITS.email}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <View style={styles.passwordBlock}>
        <TextField
          ref={passwordRef}
          label="Password"
          required
          leftIcon="lock-closed-outline"
          placeholder="Enter your password"
          value={password}
          onChangeText={(value) => {
            setPassword(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.password }));
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={fieldErrors.password}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={INPUT_LIMITS.password}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
        <Button
          title="Forgot password?"
          variant="ghost"
          size="sm"
          loading={resetting}
          disabled={busy}
          onPress={handleForgotPassword}
          accessibilityHint="Sends a reset link to the email above"
          style={styles.forgot}
        />
      </View>

      <Button title="Sign in" size="lg" fullWidth loading={loading} disabled={googleLoading} onPress={handleLogin} />

      <OrDivider />

      <GoogleSignInButton
        label="Continue with Google"
        loading={googleLoading && !pendingGoogleAuth}
        disabled={loading}
        onPress={handleGoogleLogin}
      />

      <ConfirmDialog
        visible={Boolean(pendingGoogleAuth)}
        title="Continue with Google?"
        message={
          pendingGoogleAuth
            ? `Continue as ${pendingGoogleAuth.name ?? pendingGoogleAuth.email} (${pendingGoogleAuth.email})?`
            : ""
        }
        confirmLabel="Continue"
        cancelLabel="Cancel"
        loading={googleLoading}
        onCancel={handleCancelGoogleLogin}
        onConfirm={() => {
          handleConfirmGoogleLogin().catch(() => {});
        }}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  passwordBlock: { gap: 4 },
  forgot: { alignSelf: "flex-end", marginRight: -8 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
});
