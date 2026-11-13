import {
  CART_REWARD_ICONS,
  type CartRewardIcon,
  type CartRewardType,
  type CartRewardsAppearance,
  type CartRewardsCustomLook,
  type CartRewardsSettings,
  type CartRewardsSettingsPayload,
} from "@store-builder/api-client";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";

/**
 * The cart rewards form's own shape (pages/offers/CartRewardsPage): amounts
 * as typed in major units, turned into the API's payload (minor units) and
 * back, and the automatic names the server gives a reward named nothing.
 */

export interface TierDraft {
  key: string;
  type: CartRewardType;
  /** Major units as typed. */
  threshold: string;
  /** A whole percent, or major units for an amount. */
  value: string;
  labelAr: string;
  labelEn: string;
  /** The icon on its marker; null = by its kind. */
  icon: CartRewardIcon | null;
}

export interface TrustDraft {
  key: string;
  ar: string;
  en: string;
  enabled: boolean;
}

export interface Draft {
  enabled: boolean;
  allowCouponStacking: boolean;
  tiers: TierDraft[];
  trust: TrustDraft[];
  /**
   * The bar's look: the store's theme (`inherit`) or the merchant's (`custom`).
   * The custom values stay here while the store inherits, so going back to
   * "Customize" finds them; null until the merchant first customises.
   */
  appearance: { mode: "inherit" | "custom"; custom: CartRewardsCustomLook | null };
}

let keySeq = 0;
export const newKey = () => `k${++keySeq}`;

export function draftOf(settings: CartRewardsSettings): Draft {
  return {
    enabled: settings.enabled,
    allowCouponStacking: settings.allowCouponStacking,
    tiers: settings.tiers.map((tier) => ({
      key: newKey(),
      type: tier.type,
      threshold: minorToMajorInput(tier.thresholdAmount),
      value: tier.type === "percent" ? String(tier.value ?? "") : tier.type === "fixed" ? minorToMajorInput(tier.value ?? 0) : "",
      labelAr: tier.label?.ar ?? "",
      labelEn: tier.label?.en ?? "",
      icon: tier.icon && (CART_REWARD_ICONS as readonly string[]).includes(tier.icon) ? tier.icon : null,
    })),
    trust: settings.trustItems.map((item) => ({ key: newKey(), ar: item.text.ar, en: item.text.en, enabled: item.enabled })),
    appearance: appearanceOf(settings.appearance),
  };
}

/** The look as saved; an API from before it: the theme's. */
function appearanceOf(appearance: CartRewardsAppearance | undefined): Draft["appearance"] {
  if (!appearance) return { mode: "inherit", custom: null };
  return { mode: appearance.mode === "custom" ? "custom" : "inherit", custom: appearance.custom ? { ...appearance.custom } : null };
}

export function payloadOf(draft: Draft): CartRewardsSettingsPayload {
  return {
    enabled: draft.enabled,
    allowCouponStacking: draft.allowCouponStacking,
    tiers: draft.tiers.map((tier) => ({
      thresholdAmount: majorToMinor(tier.threshold),
      type: tier.type,
      ...(tier.type === "percent" ? { value: tier.value.trim() === "" ? NaN : Number(tier.value) } : {}),
      ...(tier.type === "fixed" ? { value: majorToMinor(tier.value) } : {}),
      label: tier.labelAr.trim() || tier.labelEn.trim() ? { ar: tier.labelAr.trim() || null, en: tier.labelEn.trim() || null } : null,
      icon: tier.icon,
    })),
    trustItems: draft.trust.map((item) => ({ text: { ar: item.ar.trim(), en: item.en.trim() }, enabled: item.enabled })),
    appearance: { mode: draft.appearance.mode, custom: draft.appearance.custom },
  };
}

/** What the bar calls a reward when the merchant names it nothing (the server's own names, cartRewards/cartRewardRules.autoLabel). */
export function autoLabelOf(type: CartRewardType, value: number, currency: string): { ar: string; en: string } {
  if (type === "free_shipping") return { en: "Free shipping", ar: "شحن مجاني" };
  if (type === "percent") return { en: `${value}% off`, ar: `خصم ${value}%` };
  const whole = (n: number, locale: string) => formatMoney(n, currency, locale).replace(/[.,٫]0+(?=\D*$)/, "");
  return { en: `${whole(value, "en-EG")} off`, ar: `خصم ${whole(value, "ar-EG")}` };
}

export const emptyTier = (type: CartRewardType = "free_shipping"): TierDraft => ({ key: newKey(), type, threshold: "", value: "", labelAr: "", labelEn: "", icon: null });
