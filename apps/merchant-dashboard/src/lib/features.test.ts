import { afterEach, describe, expect, it, vi } from "vitest";

/** The switches for the screens still to come from zimos-additions, each with its build variable. */
const PORTED = {
  TWO_FACTOR_ENABLED: "VITE_TWO_FACTOR_ENABLED",
  DOMAIN_REDIRECT_ENABLED: "VITE_DOMAIN_REDIRECT_ENABLED",
  SIZE_CHARTS_ENABLED: "VITE_SIZE_CHARTS_ENABLED",
  PRODUCT_QUESTIONS_ENABLED: "VITE_PRODUCT_QUESTIONS_ENABLED",
  PRODUCT_SPECS_ENABLED: "VITE_PRODUCT_SPECS_ENABLED",
  STOCK_ALERTS_ENABLED: "VITE_STOCK_ALERTS_ENABLED",
  PREORDERS_ENABLED: "VITE_PREORDERS_ENABLED",
  HOLIDAY_MODE_ENABLED: "VITE_HOLIDAY_MODE_ENABLED",
  URL_REDIRECTS_ENABLED: "VITE_URL_REDIRECTS_ENABLED",
  PURCHASE_LIMITS_ENABLED: "VITE_PURCHASE_LIMITS_ENABLED",
  GIFT_OPTIONS_ENABLED: "VITE_GIFT_OPTIONS_ENABLED",
  GIFT_CARDS_ENABLED: "VITE_GIFT_CARDS_ENABLED",
  BLOG_ENABLED: "VITE_BLOG_ENABLED",
  ORDER_MESSAGES_ENABLED: "VITE_ORDER_MESSAGES_ENABLED",
  ORDER_EMAIL_LOCALES_ENABLED: "VITE_ORDER_EMAIL_LOCALES_ENABLED",
  EMAIL_SUPPRESSIONS_ENABLED: "VITE_EMAIL_SUPPRESSIONS_ENABLED",
  WEBHOOK_HEADERS_ENABLED: "VITE_WEBHOOK_HEADERS_ENABLED",
  ORDER_EMAIL_DESIGN_ENABLED: "VITE_ORDER_EMAIL_DESIGN_ENABLED",
  SHOPPER_ACCOUNTS_ENABLED: "VITE_SHOPPER_ACCOUNTS_ENABLED",
  LOYALTY_ENABLED: "VITE_LOYALTY_ENABLED",
  VIP_TIERS_ENABLED: "VITE_VIP_TIERS_ENABLED",
  STORE_CREDIT_ENABLED: "VITE_STORE_CREDIT_ENABLED",
  CUSTOMER_REFERRALS_ENABLED: "VITE_CUSTOMER_REFERRALS_ENABLED",
  SHOPPER_RETURNS_ENABLED: "VITE_SHOPPER_RETURNS_ENABLED",
  TRACKING_PROVIDERS_ENABLED: "VITE_TRACKING_PROVIDERS_ENABLED",
  AD_PIXELS_ENABLED: "VITE_AD_PIXELS_ENABLED",
  STORE_REPORTS_ENABLED: "VITE_STORE_REPORTS_ENABLED",
  LOST_ORDER_TIMING_ENABLED: "VITE_LOST_ORDER_TIMING_ENABLED",
  CONFIRMATION_STATION_ENABLED: "VITE_CONFIRMATION_STATION_ENABLED",
  // Ours, not from zimos-additions: held to the same rule (off unless exactly "true").
  HERO_MEDIA_ENABLED: "VITE_HERO_MEDIA_ENABLED",
} as const;

type Features = typeof import("./features");

async function loadWith(env: Record<string, string | undefined>): Promise<Features> {
  vi.resetModules();
  for (const variable of Object.values(PORTED)) vi.stubEnv(variable, undefined);
  for (const [variable, value] of Object.entries(env)) vi.stubEnv(variable, value);
  return import("./features");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("switches for the ported screens", () => {
  it("are all off when no build variable is set", async () => {
    const features = await loadWith({});
    for (const name of Object.keys(PORTED) as (keyof typeof PORTED)[]) {
      expect([name, features[name]]).toEqual([name, false]);
    }
  });

  it("covers every new switch in the module, and only the two older ones besides", async () => {
    const features = await loadWith({});
    expect(Object.keys(features).sort()).toEqual(
      [...Object.keys(PORTED), "AI_ENABLED", "CUSTOM_DOMAINS_ENABLED"].sort(),
    );
  });

  it("turn on only for exactly \"true\", each with its own variable", async () => {
    for (const [name, variable] of Object.entries(PORTED) as [keyof typeof PORTED, string][]) {
      for (const value of ["TRUE", "1", "yes", " true", ""]) {
        expect([name, value, (await loadWith({ [variable]: value }))[name]]).toEqual([name, value, false]);
      }
      const on = await loadWith({ [variable]: "true" });
      expect([name, on[name]]).toEqual([name, true]);
      const others = (Object.keys(PORTED) as (keyof typeof PORTED)[]).filter((other) => other !== name && on[other]);
      expect([name, others]).toEqual([name, []]);
    }
  });
});
