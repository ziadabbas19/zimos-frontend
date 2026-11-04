import { renderToStaticMarkup } from "react-dom/server";
import type { StorefrontProduct } from "@store-builder/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "./ProductCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/", useParams: () => ({ workspaceId: "w" }), useSearchParams: () => new URLSearchParams() }));

/**
 * `?fields=card` leaves description, seo and cms out of a list. Everything a page
 * draws from such a list goes through this card, so a card with those fields gone
 * has to be the same card, to the last character.
 */
const PRODUCT = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Lamp",
  slug: "lamp",
  description: "A long description of a lamp",
  productType: "physical",
  media: [{ url: "https://media.example.com/lamp.webp" }],
  tags: ["home"],
  seo: { title: "Lamp title" },
  cms: { features: [{ title: "Bright" }] },
  variants: [
    { id: "00000000-0000-4000-8000-000000000002", sku: "L1", optionValues: { Size: "M" }, priceAmount: 5000, compareAtAmount: 9000, currency: "EGP", weightGrams: 100, imageUrl: null, inStock: true },
    { id: "00000000-0000-4000-8000-000000000003", sku: "L2", optionValues: { Size: "L" }, priceAmount: 7000, compareAtAmount: null, currency: "EGP", weightGrams: 100, imageUrl: null, inStock: false },
  ],
  options: [{ name: "Size", values: ["M", "L"] }],
  priority: 0,
  specialOfferText: "Today only",
  shippingMode: "default",
  pageSettings: { skip_cart: false },
  offers: [{ id: "00000000-0000-4000-8000-000000000004", name: "Two", pricingMode: "fixed", priceAmount: 8000, currency: "EGP", badge: "Save", isDefault: true, lines: [] }],
  customFields: [],
  hasOptionGroups: false,
} as unknown as StorefrontProduct;

const { description, seo, cms, ...card } = PRODUCT as unknown as Record<string, unknown>;
void description;
void seo;
void cms;

describe("a product card from a list of cards", () => {
  it("draws exactly what it draws from the whole product", () => {
    for (const locale of ["ar", "en", "fr"] as const) {
      const whole = renderToStaticMarkup(<ProductCard product={PRODUCT} workspaceId="w" locale={locale} />);
      const fromCards = renderToStaticMarkup(<ProductCard product={card as unknown as StorefrontProduct} workspaceId="w" locale={locale} />);
      expect(fromCards).toBe(whole);
      expect(whole).toContain("Lamp");
    }
  });
});

describe("what the lists ask for", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is nothing extra with the switch off, and cards with it on", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_STORE_LIST_CARD_FIELDS_ENABLED", "");
    expect((await import("@/lib/cardFields")).CARD_FIELDS).toEqual({});
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_STORE_LIST_CARD_FIELDS_ENABLED", "true");
    expect((await import("@/lib/cardFields")).CARD_FIELDS).toEqual({ fields: "card" });
  });
});
