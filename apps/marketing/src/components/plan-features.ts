import type { Dictionary } from "@/i18n/dictionary";
import type { PublicPlan } from "@/lib/plans";

type FeatureKey = keyof Dictionary["pricing"]["features"];

/**
 * A plan's features as its card lists them (home-plans.tsx, plan-cards.tsx).
 * When the plan has every feature of the plan listed before it, the list
 * opens with "Everything in <that plan>" (`inherits` is its name) and names
 * only what this plan adds (`own`) — as the landing the owner sent does
 * (2026-11-15). Otherwise every feature is named. Either way only the
 * features this site has a name for, in the console's order: a key added to
 * the platform after this page is left out rather than shown raw.
 */
export function planFeatures(
  plan: PublicPlan,
  before: PublicPlan | null,
  copy: Dictionary["pricing"]
): { inherits: string | null; own: FeatureKey[] } {
  const named = (features: readonly string[]) => features.filter((key): key is FeatureKey => key in copy.features);
  const mine = named(plan.features);
  const theirs = before ? named(before.features) : [];
  if (!before || theirs.length === 0 || !theirs.every((key) => mine.includes(key))) {
    return { inherits: null, own: mine };
  }
  return { inherits: before.name, own: mine.filter((key) => !theirs.includes(key)) };
}
