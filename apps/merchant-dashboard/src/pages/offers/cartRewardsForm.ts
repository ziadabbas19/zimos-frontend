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

export interface Draft {
  enabled: boolean;
  allowCouponStacking: boolean;
  tiers: TierDraft[];
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
    // No trustItems: the lines under the checkout button are the store's cart behavior now (Store settings → Cart behavior).
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

/**
 * The store's accent, as its storefront draws it unless a theme or a template
 * says otherwise: its primary colour in the light look (the dark look's own
 * when it set one), else the storefront's defaults.
 */
export function storeAccentOf(themeSettings: Record<string, unknown> | null | undefined): { light: string; dark: string } {
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : null);
  const light = hex(themeSettings?.primaryColor);
  return { light: light ?? "#1f5d5b", dark: hex(themeSettings?.primaryColorDark) ?? light ?? "#5b8df6" };
}
