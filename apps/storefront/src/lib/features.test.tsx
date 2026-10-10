// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/** Every store switch with its build variable. */
const SWITCHES = {
  SHOPPER_ACCOUNTS_ENABLED: "NEXT_PUBLIC_SHOPPER_ACCOUNTS_ENABLED",
  SIZE_CHARTS_ENABLED: "NEXT_PUBLIC_SIZE_CHARTS_ENABLED",
  PRODUCT_QUESTIONS_ENABLED: "NEXT_PUBLIC_PRODUCT_QUESTIONS_ENABLED",
  PRODUCT_SPECS_ENABLED: "NEXT_PUBLIC_PRODUCT_SPECS_ENABLED",
  STOCK_ALERTS_ENABLED: "NEXT_PUBLIC_STOCK_ALERTS_ENABLED",
  PREORDERS_ENABLED: "NEXT_PUBLIC_PREORDERS_ENABLED",
  HOLIDAY_MODE_ENABLED: "NEXT_PUBLIC_HOLIDAY_MODE_ENABLED",
  URL_REDIRECTS_ENABLED: "NEXT_PUBLIC_URL_REDIRECTS_ENABLED",
  PURCHASE_LIMITS_ENABLED: "NEXT_PUBLIC_PURCHASE_LIMITS_ENABLED",
  GIFT_OPTIONS_ENABLED: "NEXT_PUBLIC_GIFT_OPTIONS_ENABLED",
  GIFT_CARDS_ENABLED: "NEXT_PUBLIC_GIFT_CARDS_ENABLED",
  BLOG_ENABLED: "NEXT_PUBLIC_BLOG_ENABLED",
  LOYALTY_ENABLED: "NEXT_PUBLIC_LOYALTY_ENABLED",
  VIP_TIERS_ENABLED: "NEXT_PUBLIC_VIP_TIERS_ENABLED",
  STORE_CREDIT_ENABLED: "NEXT_PUBLIC_STORE_CREDIT_ENABLED",
  CUSTOMER_REFERRALS_ENABLED: "NEXT_PUBLIC_CUSTOMER_REFERRALS_ENABLED",
  SHOPPER_RETURNS_ENABLED: "NEXT_PUBLIC_SHOPPER_RETURNS_ENABLED",
  AD_PIXELS_ENABLED: "NEXT_PUBLIC_AD_PIXELS_ENABLED",
  HERO_MEDIA_ENABLED: "NEXT_PUBLIC_HERO_MEDIA_ENABLED",
} as const;

type Features = typeof import("./features");
type Name = keyof typeof SWITCHES;
const NAMES = Object.keys(SWITCHES) as Name[];

async function loadWith(env: Partial<Record<Name, string | undefined>>): Promise<Features> {
  vi.resetModules();
  for (const variable of Object.values(SWITCHES)) vi.stubEnv(variable, undefined);
  for (const [name, value] of Object.entries(env)) vi.stubEnv(SWITCHES[name as Name], value);
  return import("./features");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("store feature switches", () => {
  it("are all off when no build variable is set", async () => {
    const features = await loadWith({});
    for (const name of NAMES) expect([name, features[name]]).toEqual([name, false]);
  });

  it("turn on only for exactly \"true\"", async () => {
    for (const name of NAMES) {
      for (const value of ["TRUE", "1", "yes", " true", ""]) {
        expect([name, value, (await loadWith({ [name]: value }))[name]]).toEqual([name, value, false]);
      }
      expect([name, (await loadWith({ [name]: "true" }))[name]]).toEqual([name, true]);
    }
  });

  it("turn on one at a time: a switch never opens another feature", async () => {
    for (const name of NAMES) {
      const features = await loadWith({ [name]: "true" });
      for (const other of NAMES) expect([name, other, features[other]]).toEqual([name, other, other === name]);
    }
  });
});
