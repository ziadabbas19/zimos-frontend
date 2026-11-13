/** The names of the rewards bar's icons (icons.tsx draws them), and which one a reward shows. */

export const REWARD_ICON_NAMES = ["gift", "truck", "percent", "tag", "star", "heart", "crown", "bolt", "check"] as const;
export type RewardIconName = (typeof REWARD_ICON_NAMES)[number];

export const isRewardIconName = (value: unknown): value is RewardIconName => typeof value === "string" && (REWARD_ICON_NAMES as readonly string[]).includes(value);

/** A reward's icon when the merchant picked none: by its kind. */
export function defaultRewardIcon(type: string): RewardIconName {
  if (type === "free_shipping") return "truck";
  if (type === "percent") return "percent";
  if (type === "fixed") return "tag";
  return "gift";
}

/** The icon a tier shows: its own when it names a known one, else its kind's. */
export const rewardIconOf = (tier: { type: string; icon?: string | null }): RewardIconName => (isRewardIconName(tier.icon) ? tier.icon : defaultRewardIcon(tier.type));

/** undefined: an outline (the svg's own fill="none"); currentColor: solid. */
