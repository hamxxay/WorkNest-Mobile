import {
  LINK_SENT_MESSAGE,
  NOT_VERIFIED_YET_MESSAGE,
  RESEND_COOLDOWN_MS,
  canCheck,
  canResend,
  initialVerificationState,
  resendLabel,
  resendWaitSeconds,
  verificationReducer,
  type VerificationEvent,
  type VerificationState,
} from "./emailVerification";

const T0 = 1_000_000;

function run(state: VerificationState, ...events: VerificationEvent[]): VerificationState {
  return events.reduce(verificationReducer, state);
}

describe("Verify your email: resending the link", () => {
  it("a link sent at sign-up starts the one-minute wait", () => {
    const state = initialVerificationState(T0);
    expect(resendWaitSeconds(state, T0 + 1)).toBe(60);
    expect(canResend(state, T0 + 30_000)).toBe(false);
    expect(resendLabel(state, T0 + 18_200)).toBe("Send again in 42 s");
    expect(canResend(state, T0 + RESEND_COOLDOWN_MS)).toBe(true);
    expect(resendLabel(state, T0 + RESEND_COOLDOWN_MS)).toBe("Send the link again");
  });

  it("with no known link the user can send one straight away", () => {
    const state = initialVerificationState(null);
    expect(canResend(state, T0)).toBe(true);
    expect(resendWaitSeconds(state, T0)).toBe(0);
  });

  it("sending -> sent restarts the wait and says so", () => {
    const sending = run(initialVerificationState(null), { type: "RESEND" });
    expect(sending.status).toBe("sending");
    expect(canResend(sending, T0)).toBe(false);
    expect(canCheck(sending)).toBe(false);

    const sent = verificationReducer(sending, { type: "RESENT", at: T0 });
    expect(sent).toEqual({ status: "waiting", lastSentAt: T0, notice: { tone: "success", text: LINK_SENT_MESSAGE } });
    expect(canResend(sent, T0 + 59_000)).toBe(false);
  });

  it("a failed send shows the reason and keeps the previous wait", () => {
    const state = run(initialVerificationState(null), { type: "RESEND" }, { type: "RESEND_FAILED", message: "Too many attempts." });
    expect(state).toEqual({ status: "waiting", lastSentAt: null, notice: { tone: "danger", text: "Too many attempts." } });
  });

  it("ignores a resend while another action runs", () => {
    const checking = run(initialVerificationState(null), { type: "CHECK" });
    expect(verificationReducer(checking, { type: "RESEND" })).toBe(checking);
  });
});

describe("Verify your email: checking", () => {
  it("not verified yet -> back to waiting with a hint", () => {
    const state = run(initialVerificationState(T0), { type: "CHECK" }, { type: "NOT_VERIFIED" });
    expect(state.status).toBe("waiting");
    expect(state.notice).toEqual({ tone: "info", text: NOT_VERIFIED_YET_MESSAGE });
  });

  it("verified -> done (the app opens)", () => {
    const state = run(initialVerificationState(T0), { type: "CHECK" }, { type: "VERIFIED" });
    expect(state.status).toBe("verified");
    expect(canCheck(state)).toBe(false);
    expect(canResend(state, T0 + RESEND_COOLDOWN_MS)).toBe(false);
  });

  it("a failure shows the message; the automatic check on return stays quiet", () => {
    const loud = run(initialVerificationState(T0), { type: "CHECK" }, { type: "CHECK_FAILED", message: "Offline." });
    expect(loud.notice).toEqual({ tone: "danger", text: "Offline." });

    const quiet = run(
      initialVerificationState(T0),
      { type: "CHECK", silent: true },
      { type: "NOT_VERIFIED", silent: true },
    );
    expect(quiet).toEqual(initialVerificationState(T0));
    const quietFailure = run(
      initialVerificationState(T0),
      { type: "CHECK", silent: true },
      { type: "CHECK_FAILED", message: "Offline.", silent: true },
    );
    expect(quietFailure.notice).toBeNull();
  });

  it("only one check at a time; results without a check are ignored", () => {
    const checking = run(initialVerificationState(T0), { type: "CHECK" });
    expect(verificationReducer(checking, { type: "CHECK" })).toBe(checking);
    const waiting = initialVerificationState(T0);
    expect(verificationReducer(waiting, { type: "VERIFIED" })).toBe(waiting);
    expect(verificationReducer(waiting, { type: "NOT_VERIFIED" })).toBe(waiting);
  });

  it("the message can be dismissed", () => {
    const state = run(initialVerificationState(T0), { type: "CHECK" }, { type: "NOT_VERIFIED" }, { type: "DISMISS" });
    expect(state.notice).toBeNull();
  });
});
