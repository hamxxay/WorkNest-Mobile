import { useRef, useState } from "react";
import { StyleSheet, Text, View, type TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList, RootStackParamList } from "../../navigation/types";
import { Banner, Button, ConfirmDialog, GoogleSignInButton, TextField } from "../../components/ui";
import { useTheme } from "../../theme";
import { errorMessage } from "../../services/apiClient";
import {
  beginGoogleAuth,
  cancelGoogleAuth,
  confirmGoogleSignup,
  registerUser,
  type PendingGoogleAuth,
} from "../../services/authService";
import { isSignInCancelled } from "../../services/authErrors";
import {
  INPUT_LIMITS,
  passwordForState,
  sanitizeEmailInput,
  sanitizeTextForState,
} from "../../utils/inputSanitizer";
import { isValidEmail, isValidPassword } from "../../utils/validation";
import { AuthLayout, OrDivider } from "./components/AuthLayout";
import { signedInState } from "../../navigation/redirect";

type FieldErrors = { email?: string; password?: string; confirmPassword?: string };

const PASSWORD_HINT = "At least 8 characters, with letters and numbers.";

export default function SignupScreen() {
  const { colors, typography } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, "Signup">>();
  // Carried over from Login: where the customer was going before they had to sign in.
  const redirectAfterLogin = route.params?.redirectAfterLogin;
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<PendingGoogleAuth | null>(null);
  const busy = loading || googleLoading;

  /** Signed up: the tabs, plus the screen the customer was opening (if any) on top. */
  const routeToApp = () => {
    const state = signedInState(redirectAfterLogin);
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNavigation) rootNavigation.reset(state);
    else navigation.reset(state.routes[0].state as never);
  };

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

  const clearFieldError = (key: keyof FieldErrors) => {
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /** Inline checks before calling the service (the service validates again). */
  const validate = (): boolean => {
    const next: FieldErrors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = "Enter your email.";
    else if (!isValidEmail(trimmed)) next.email = "Enter a valid email address, like name@example.com.";
    if (!password) next.password = "Create a password.";
    // Signing in uses the password exactly as typed, so a space at either end would be a different password.
    else if (password !== password.trim()) next.password = "Your password can't start or end with a space.";
    else if (!isValidPassword(password)) next.password = PASSWORD_HINT;
    if (!confirmPassword) next.confirmPassword = "Re-enter your password.";
    else if (password !== confirmPassword) next.confirmPassword = "Passwords do not match.";
    setFieldErrors(next);
    return !next.email && !next.password && !next.confirmPassword;
  };

  const handleSignup = async () => {
    if (busy) return;
    if (!validate()) return;

    try {
      setLoading(true);
      setError(null);
      const { firstName, lastName } = parseName(name);
      const result = await registerUser({
        email: sanitizeEmailInput(email),
        password,
        firstName,
        lastName,
      });

      if (result.signedIn) {
        // The API accepted the new account: signed in (AuthContext already has the user), as after Sign in.
        routeToApp();
        return;
      }

      // The API wants the email address verified first: WorkNest opens once the link in the email was opened.
      navigation.replace("VerifyEmail", {
        email: result.email,
        ...(redirectAfterLogin ? { redirectAfterLogin } : {}),
      });
    } catch (err) {
      setError(errorMessage(err, "Unable to create account right now. Please try again."));
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
      // Closing the Google account picker is not an error.
      if (isSignInCancelled(err)) return;
      setError(errorMessage(err, "Unable to create account with Google right now. Please try again."));
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
      routeToApp();
    } catch (err) {
      setError(errorMessage(err, "Unable to create account with Google right now. Please try again."));
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
    <AuthLayout
      title="Create your account"
      subtitle="Book desks, meeting rooms and offices, and keep your invoices in one place."
      footer={
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Already have an account?</Text>
            <Button title="Sign in" variant="ghost" size="sm" onPress={() => navigation.replace("Login", redirectAfterLogin ? { redirectAfterLogin } : undefined)} disabled={busy} />
          </View>
          <Text style={[typography.caption, styles.terms, { color: colors.textMuted }]}>
            By signing up, you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      }
    >
      {error ? <Banner tone="danger" message={error} onDismiss={() => setError(null)} /> : null}

      <TextField
        label="Full name"
        leftIcon="person-outline"
        placeholder="Jane Doe"
        value={name}
        onChangeText={(value) => setName(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.name }))}
        maxLength={INPUT_LIMITS.name}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />

      <TextField
        ref={emailRef}
        label="Email"
        required
        leftIcon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={(value) => {
          setEmail(sanitizeTextForState(value, { maxLength: INPUT_LIMITS.email }));
          clearFieldError("email");
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

      <TextField
        ref={passwordRef}
        label="Password"
        required
        leftIcon="lock-closed-outline"
        placeholder="Create a password"
        value={password}
        onChangeText={(value) => {
          setPassword(passwordForState(value));
          clearFieldError("password");
        }}
        helperText={PASSWORD_HINT}
        error={fieldErrors.password}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={INPUT_LIMITS.password}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />

      <TextField
        ref={confirmRef}
        label="Confirm password"
        required
        leftIcon="lock-closed-outline"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(passwordForState(value));
          clearFieldError("confirmPassword");
        }}
        error={fieldErrors.confirmPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={INPUT_LIMITS.password}
        returnKeyType="go"
        onSubmitEditing={handleSignup}
      />

      <Button
        title="Create account"
        size="lg"
        fullWidth
        loading={loading}
        disabled={googleLoading}
        onPress={handleSignup}
        style={styles.submit}
      />

      <OrDivider />

      <GoogleSignInButton
        label="Sign up with Google"
        loading={googleLoading && !pendingGoogleAuth}
        disabled={loading}
        onPress={handleGoogleSignup}
      />

      <ConfirmDialog
        visible={Boolean(pendingGoogleAuth)}
        title="Create account with Google?"
        message={
          pendingGoogleAuth
            ? `Create your WorkNest account as ${pendingGoogleAuth.name ?? pendingGoogleAuth.email} (${pendingGoogleAuth.email})?`
            : ""
        }
        confirmLabel="Continue"
        cancelLabel="Cancel"
        loading={googleLoading}
        onCancel={handleCancelGoogleSignup}
        onConfirm={() => {
          handleConfirmGoogleSignup().catch(() => {});
        }}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: 4 },
  footer: { alignItems: "center", gap: 8 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  terms: { textAlign: "center", maxWidth: 300 },
});
