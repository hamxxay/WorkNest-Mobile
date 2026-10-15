// The "Verify your email" screen as a small state machine (pure, unit tested). The screen only dispatches events;
// authService does the work (send the link again, reload the Firebase account, sign in once it is verified).
//
//   waiting --resend--> sending --sent / failed--> waiting        (a new link can be sent once a minute)
//   waiting --check---> checking --not yet / failed--> waiting
//                               --verified--> verified            (the app opens)

export const RESEND_COOLDOWN_MS = 60 * 1000;

export type VerificationStatus = "waiting" | "sending" | "checking" | "verified";

export type VerificationNotice = { tone: "info" | "success" | "danger"; text: string } | null;

export type VerificationState = {
  status: VerificationStatus;
  /** When the last link was sent (sign-up counts), ms since 1970; null when none is known. */
  lastSentAt: number | null;
  notice: VerificationNotice;
};

export type VerificationEvent =
  | { type: "RESEND" }
  | { type: "RESENT"; at: number }
  | { type: "RESEND_FAILED"; message: string }
  /** silent: the automatic check when the user comes back to the app (no message unless it worked). */
  | { type: "CHECK"; silent?: boolean }
  | { type: "NOT_VERIFIED"; silent?: boolean }
  | { type: "VERIFIED" }
  | { type: "CHECK_FAILED"; message: string; silent?: boolean }
  | { type: "DISMISS" };

export const NOT_VERIFIED_YET_MESSAGE =
  "Your email isn't verified yet. Open the link in the email we sent you, then try again.";
export const LINK_SENT_MESSAGE = "We sent you a new link. It can take a minute to arrive.";

export function initialVerificationState(lastSentAt: number | null): VerificationState {
  return { status: "waiting", lastSentAt, notice: null };
}

export function verificationReducer(state: VerificationState, event: VerificationEvent): VerificationState {
  switch (event.type) {
    case "RESEND":
      return state.status === "waiting" ? { ...state, status: "sending", notice: null } : state;
    case "RESENT":
      return state.status === "sending"
        ? { status: "waiting", lastSentAt: event.at, notice: { tone: "success", text: LINK_SENT_MESSAGE } }
        : state;
    case "RESEND_FAILED":
      return state.status === "sending"
        ? { ...state, status: "waiting", notice: { tone: "danger", text: event.message } }
        : state;
    case "CHECK":
      if (state.status !== "waiting") return state;
      return { ...state, status: "checking", notice: event.silent ? state.notice : null };
    case "NOT_VERIFIED":
      if (state.status !== "checking") return state;
      return {
        ...state,
        status: "waiting",
        notice: event.silent ? state.notice : { tone: "info", text: NOT_VERIFIED_YET_MESSAGE },
      };
    case "VERIFIED":
      return state.status === "checking" ? { ...state, status: "verified", notice: null } : state;
    case "CHECK_FAILED":
      if (state.status !== "checking") return state;
      return {
        ...state,
        status: "waiting",
        notice: event.silent ? state.notice : { tone: "danger", text: event.message },
      };
    case "DISMISS":
      return state.notice ? { ...state, notice: null } : state;
    default:
      return state;
  }
}

/** Whole seconds until another link may be sent (0 = now). */
export function resendWaitSeconds(state: VerificationState, now: number, cooldownMs = RESEND_COOLDOWN_MS): number {
  if (state.lastSentAt === null) return 0;
  const left = state.lastSentAt + cooldownMs - now;
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function canResend(state: VerificationState, now: number): boolean {
  return state.status === "waiting" && resendWaitSeconds(state, now) === 0;
}

export function canCheck(state: VerificationState): boolean {
  return state.status === "waiting";
}

/** The resend button's label: "Send the link again" or "Send again in 42 s". */
export function resendLabel(state: VerificationState, now: number): string {
  const wait = resendWaitSeconds(state, now);
  return wait > 0 ? `Send again in ${wait} s` : "Send the link again";
}
