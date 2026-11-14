// Imported as `@store-builder/ui/cart-rewards`, apart from the package's main
// entry, like `z-loader`: the storefront takes these files only and none of the
// shadcn components. The dashboard's settings preview draws the same bar.

export { CartRewardsBar, cartRewardsStatus, type CartRewardsBarProps, type CartRewardsLocale, type CartRewardsNote, type CartRewardsStatusInput } from "./CartRewardsBar";
export { nextTier, previewApplied, reached, rewardsFill, sortedTiers, type RewardKind, type RewardText, type RewardTier } from "./progress";
export { CART_EASE, pop, reducedMotion, useTweenedNumber } from "./motion";
export { FILL_MS, HEX, INHERITED_LOOK, MIN_CONTRAST, THEME_COLORS, autoFixLook, contrastProblems, contrastRatio, customLookOf, iconColorOn, nearestPassing, parseCssColor, readableAccent, type BarAppearance, type BarLook, type CartSpeed, type ContrastProblem } from "./appearance";
export { useReadableAccent } from "./readableAccent";
export { RewardIcon } from "./icons";
export { REWARD_ICON_NAMES, defaultRewardIcon, isRewardIconName, rewardIconOf, type RewardIconName } from "./iconNames";
