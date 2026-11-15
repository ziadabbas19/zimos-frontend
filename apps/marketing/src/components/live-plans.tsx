"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import type { PublicOffer } from "@/lib/plan-offer";
import { PlanCards } from "./plan-cards";
import { useLiveOffer } from "./use-live-offer";

/**
 * The plans as the console has them now. The page is drawn with the plans
 * the server read (lib/plans.ts, at most a minute old), so their prices and
 * features are in its HTML; then the browser asks the API again — on every
 * visit, and each time the tab comes back into view — and the cards follow
 * what it answers: a price, a limit, a feature switched on or off, a plan
 * added, hidden or reordered in the console is on the page at once (the
 * owner, 2026-11-14). An answer that fails or is not the list leaves the
 * cards as they were. With no plan at all, `empty` is shown.
 */
export function LivePlans({
  initial,
  copy,
  locale,
  idPrefix,
  headingLevel,
  empty = null,
}: {
  initial: PublicOffer | null;
  copy: Dictionary["pricing"];
  locale: Locale;
  idPrefix: string;
  headingLevel?: 2 | 3;
  empty?: ReactNode;
}) {
  const offer = useLiveOffer(initial);

  const plans = offer?.plans ?? [];
  const payPerOrder = offer?.payPerOrder ?? null;
  if (plans.length === 0 && !payPerOrder) return <>{empty}</>;
  return <PlanCards plans={plans} payPerOrder={payPerOrder} copy={copy} locale={locale} idPrefix={idPrefix} headingLevel={headingLevel} />;
}
