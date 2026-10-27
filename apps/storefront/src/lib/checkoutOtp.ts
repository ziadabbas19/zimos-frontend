import { ApiError, apiErrorDetails, type CheckoutOtpChallenge } from "@store-builder/api-client";

/**
 * Phone verification at checkout, shopper side (backend: modules/risk/checkoutOtp).
 *
 * A checkout the store wants verified answers 428 OTP_REQUIRED and sends a
 * code. `withCheckoutOtp` wraps any checkout call: on that answer it asks the
 * <OtpGate> mounted in the store layout for the code, and submits the same
 * order again with the proof. The forms themselves do not change.
 */

export interface OtpPromptRequest {
  workspaceId: string;
  phone: string;
  challenge: CheckoutOtpChallenge;
}

/** Resolves with the `otpToken`, or null when the shopper backs out to change the number. */
type OtpPrompt = (request: OtpPromptRequest) => Promise<string | null>;

let prompt: OtpPrompt | null = null;
let cancelledMessage = "The order was not placed: the phone number was not verified.";

/** <OtpGate> registers itself here (and its copy for a cancelled verification). */
export function registerOtpPrompt(next: OtpPrompt | null, message?: string) {
  prompt = next;
  if (message) cancelledMessage = message;
}

/** The challenge of a 428 OTP_REQUIRED (a checkout, or a switch to cash on delivery), or null for any other error. */
export function otpChallengeOf(err: unknown): CheckoutOtpChallenge | null {
  if (!(err instanceof ApiError) || (err.code as string) !== "OTP_REQUIRED") return null;
  const details = apiErrorDetails<Partial<CheckoutOtpChallenge>>(err) ?? {};
  return {
    channel: details.channel === "sms" ? "sms" : "whatsapp",
    codeLength: typeof details.codeLength === "number" ? details.codeLength : 4,
    resendAfterSeconds: typeof details.resendAfterSeconds === "number" ? details.resendAfterSeconds : 60,
    phoneHint: typeof details.phoneHint === "string" ? details.phoneHint : "",
  };
}

/**
 * Runs `submit`; if the store asks for a code, collects it and runs `submit`
 * again with `{ otpToken }` to merge into the checkout body.
 */
export async function withCheckoutOtp<T>(
  workspaceId: string,
  phone: string,
  submit: (extra: { otpToken?: string }) => Promise<T>
): Promise<T> {
  try {
    return await submit({});
  } catch (err) {
    const challenge = otpChallengeOf(err);
    if (!challenge || !prompt) throw err;
    const otpToken = await prompt({ workspaceId, phone, challenge });
    if (!otpToken) throw new Error(cancelledMessage);
    return submit({ otpToken });
  }
}
