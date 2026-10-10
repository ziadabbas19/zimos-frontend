import { getLocale } from "@/i18n/LocaleContext";

/*
 * A confirmation the shopper made themselves, from the store's link: the
 * attempt has `channel: "customer_link"` and `agent: null`. Where an attempt
 * names its agent — the queue's cards, the station and the order page's
 * attempts — it reads "Customer confirmed from the link" instead, and no "via"
 * channel is added (the sentence already says how). Our API records no such
 * attempt today, so this reads every attempt as an agent's.
 */

const TEXT = {
  en: "Customer confirmed from the link",
  ar: "أكّد العميل من الرابط",
};

interface AttemptLike {
  channel?: string | null;
  agent?: { fullName: string } | null;
}

export function isCustomerLinkAttempt(attempt: AttemptLike | null | undefined): boolean {
  return (attempt?.channel as string | null | undefined) === "customer_link";
}

/** Who made the attempt: the agent's name, the link's sentence, or the caller's "unknown agent". */
export function attemptAgentName(attempt: AttemptLike | null | undefined, unknownAgent: string): string {
  if (isCustomerLinkAttempt(attempt)) return TEXT[getLocale() === "ar" ? "ar" : "en"];
  return attempt?.agent?.fullName ?? unknownAgent;
}

/** The attempt's channel for a "via …" label; null for the link (and for none). */
export function attemptViaChannel<C extends string>(attempt: { channel?: C | null } | null | undefined): C | null {
  return attempt?.channel && !isCustomerLinkAttempt(attempt) ? attempt.channel : null;
}
