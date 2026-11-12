// Imported as `@store-builder/ui/cart-rewards`, apart from the package's main
// entry, like `z-loader`: the storefront takes these files only and none of the
// shadcn components. The dashboard's settings preview draws the same bar.

export { CartRewardsBar, cartRewardsStatus, type CartRewardsBarProps, type CartRewardsLocale, type CartRewardsNote, type CartRewardsStatusInput } from "./CartRewardsBar";
export { nextTier, previewApplied, reached, rewardsFill, sortedTiers, type RewardKind, type RewardText, type RewardTier } from "./progress";
export { CART_EASE, pop, reducedMotion, useTweenedNumber } from "./motion";
