import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList, RootStackParamList } from "../../navigation/types";
import { Banner, Button } from "../../components/ui";
import { useTheme } from "../../theme";
import { errorMessage } from "../../services/apiClient";
import {
  cancelEmailVerification,
  completeEmailVerification,
  getPendingEmailVerification,
  resendVerificationEmail,
} from "../../services/authService";
import { isEmailNotVerified, isSignInRefused } from "../../services/authErrors";
import {
  canCheck,
  canResend,
  initialVerificationState,
  resendLabel,
  resendWaitSeconds,
  verificationReducer,
} from "../../services/emailVerification";
import { AuthLayout, useAuthFormWidth } from "./components/AuthLayout";
import { fittingLabel } from "../App/General/shared/layout";
import { signedInState } from "../../navigation/redirect";

/**
 * "Verify your email": shown whenever the API answers EMAIL_NOT_VERIFIED (sign-up, sign-in, start-up; only while
 * the API requires a verified address, Security:RequireVerifiedEmail). The user opens the link
 * in the email, comes back and continues (the check also runs by itself when the app comes back to the front);
 * the link can be sent again once a minute; "Use a different account" signs out.
 */
export default function VerifyEmailScreen() {
  const { colors, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, "VerifyEmail">>();
  const email = route.params?.email ?? getPendingEmailVerification()?.email ?? "";
  const redirectAfterLogin = route.params?.redirectAfterLogin;
  const [state, dispatch] = useReducer(
    verificationReducer,
    getPendingEmailVerification()?.sentAt ?? null,
    initialVerificationState,
  );
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const waitSeconds = resendWaitSeconds(state, now);

  // Full-width buttons show one line: on a narrow phone or with large text a shorter label with the same meaning
  // (the full one stays the spoken label).
  const { fontScale } = useWindowDimensions();
  const formWidth = useAuthFormWidth();
  const verifiedLabel = fittingLabel(["I've verified my email", "I've verified it"], formWidth, fontScale);
  const resendFull = resendLabel(state, now);
  const resendTitle = fittingLabel(
    [resendFull, waitSeconds > 0 ? `Send in ${waitSeconds} s` : "Send again"],
    formWidth,
    fontScale,
    true,
  );

  // Counts the resend wait down once a second (only while there is one).
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitSeconds]);

  const routeToApp = useCallback(() => {
    const target = signedInState(redirectAfterLogin);
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNavigation) rootNavigation.reset(target);
    else navigation.reset(target.routes[0].state as never);
  }, [navigation, redirectAfterLogin]);

  const backToLogin = useCallback(() => {
    navigation.replace("Login", redirectAfterLogin ? { redirectAfterLogin } : undefined);
  }, [navigation, redirectAfterLogin]);

  const check = useCallback(
    async (silent: boolean) => {
      if (!canCheck(stateRef.current)) return;
      dispatch({ type: "CHECK", silent });
      try {
        const result = await completeEmailVerification();
        if (!mounted.current) return;
        if (!result.verified) {
          dispatch({ type: "NOT_VERIFIED", silent });
          return;
        }
        dispatch({ type: "VERIFIED" });
        routeToApp();
      } catch (error) {
        if (!mounted.current) return;
        if (isEmailNotVerified(error)) {
          // The API has not seen the verified address yet: same as "not yet".
          dispatch({ type: "NOT_VERIFIED", silent });
          return;
        }
        if (isSignInRefused(error)) {
          // Turned off (or signed out meanwhile): the Login screen shows the reason.
          dispatch({ type: "CHECK_FAILED", message: errorMessage(error), silent: true });
          backToLogin();
          return;
        }
        dispatch({
          type: "CHECK_FAILED",
          message: errorMessage(error, "We couldn't check your email right now. Please try again."),
          silent,
        });
      }
    },
    [backToLogin, routeToApp],
  );

  // Coming back from the mail app: check by itself (quietly, no message unless it worked).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") check(true).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [check]);

  const resend = async () => {
    if (!canResend(stateRef.current, Date.now())) return;
    dispatch({ type: "RESEND" });
    try {
      const at = await resendVerificationEmail();
      if (!mounted.current) return;
      dispatch({ type: "RESENT", at });
      setNow(Date.now());
    } catch (error) {
      if (!mounted.current) return;
      dispatch({
        type: "RESEND_FAILED",
        message: errorMessage(error, "We couldn't send the email. Please try again in a moment."),
      });
    }
  };

  const switchAccount = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await cancelEmailVerification();
    } finally {
      if (mounted.current) {
        setLeaving(false);
        backToLogin();
      }
    }
  };

  const busy = state.status !== "waiting" || leaving;

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        email
          ? `Open the verification link we emailed to ${email}, then come back here to continue.`
          : "Open the verification link we emailed you, then come back here to continue."
      }
      footer={
        <Button
          title="Use a different account"
          variant="ghost"
          size="sm"
          loading={leaving}
          disabled={busy && !leaving}
          onPress={() => {
            switchAccount().catch(() => undefined);
          }}
          accessibilityHint="Signs out so you can sign in or sign up with another email"
        />
      }
    >
      <View style={[styles.iconWell, { backgroundColor: colors.primarySoft }]} accessible={false}>
        <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
      </View>

      {state.notice ? (
        <Banner
          tone={state.notice.tone}
          message={state.notice.text}
          onDismiss={() => dispatch({ type: "DISMISS" })}
        />
      ) : null}

      <Button
        title={verifiedLabel}
        accessibilityLabel="I've verified my email"
        size="lg"
        fullWidth
        loading={state.status === "checking"}
        disabled={busy && state.status !== "checking"}
        onPress={() => {
          check(false).catch(() => undefined);
        }}
        haptic
      />

      <Button
        title={resendTitle}
        accessibilityLabel={resendFull}
        variant="outline"
        size="lg"
        fullWidth
        leftIcon="refresh-outline"
        loading={state.status === "sending"}
        disabled={(busy && state.status !== "sending") || waitSeconds > 0}
        onPress={() => {
          resend().catch(() => undefined);
        }}
        accessibilityHint="Sends the verification email again"
      />

      <Text style={[typography.bodySmall, styles.hint, { color: colors.textMuted }]}>
        Can't find the email? Check your spam or junk folder. The link opens in your browser; after that, come back to
        this screen.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { textAlign: "center" },
});
