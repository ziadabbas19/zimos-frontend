import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { StorefrontExternalReview } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import type { Locale } from "@/lib/i18n";
import { REVIEW_TEXT } from "./reviewText";

/*
 * Reviews the merchant brought from other sites: their own block after the
 * shoppers' reviews, each with where it came from and a link to the
 * original, never "verified", never in the stars — and nothing at all while
 * there are none.
 */

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request, uploadCustomerPhoto: vi.fn() }) }));
vi.mock("@/lib/visitorId", () => ({ getVisitorId: () => "visitor-1" }));
vi.mock("@/lib/botGuard", () => ({ getDeviceId: () => "device-12345678" }));

import { ExternalReviews } from "./ExternalReviews";
import { StoreReviews } from "./StoreReviews";
import { ProductReviews } from "@/components/product/ProductReviews";

const en = REVIEW_TEXT.en;
const ar = REVIEW_TEXT.ar;
const STORE = { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null, reviews: { open: false, storeRating: { average: null, count: 0, distribution: {} } } } as unknown as StoreInfo;

function external(extra: Partial<StorefrontExternalReview> = {}): StorefrontExternalReview {
  return {
    id: `ext-${Math.random().toString(36).slice(2)}`,
    rating: 5,
    comment: "Great quality",
    authorName: "Mona",
    photos: [],
    source: "facebook",
    sourceLabel: null,
    url: null,
    reviewedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    ...extra,
  };
}

function inStore(node: ReactNode, locale: Locale = "en") {
  return render(
    <StoreContextProvider locale={locale} store={STORE}>
      {node}
    </StoreContextProvider>
  );
}

const block = () => document.querySelector<HTMLElement>("[data-external-reviews]");

afterEach(cleanup);

describe("reviews from other sites", () => {
  it("draws nothing while there are none", () => {
    const { container } = inStore(<ExternalReviews reviews={[]} />);
    expect(container.innerHTML).toBe("");
    cleanup();
    inStore(<ExternalReviews reviews={undefined} />);
    expect(block()).toBeNull();
    cleanup();

    // Nor on the product page or the store reviews page.
    inStore(<ProductReviews workspaceId="ws1" productId="prod-1" rating={{ average: null, count: 0, distribution: {} }} reviews={[]} />);
    expect(screen.queryByText(en.externalTitle)).toBeNull();
    expect(screen.getByText(en.none)).toBeTruthy();
    cleanup();
    inStore(<StoreReviews workspaceId="ws1" rating={{ average: null, count: 0, distribution: {} }} reviews={[]} externalReviews={[]} />);
    expect(screen.queryByText(en.externalTitle)).toBeNull();
  });

  it("names where each came from, in Arabic and in English", () => {
    const list = [
      external({ id: "fb", source: "facebook" }),
      external({ id: "g", source: "google" }),
      external({ id: "ig", source: "instagram" }),
      external({ id: "wa", source: "whatsapp" }),
      external({ id: "named", source: "other", sourceLabel: "Jumia" }),
      external({ id: "unnamed", source: "other", sourceLabel: null }),
      external({ id: "blank", source: "other", sourceLabel: "   " }),
    ];
    const badges = () => [...document.querySelectorAll("[data-review-source]")].map((el) => el.textContent);

    inStore(<ExternalReviews reviews={list} />, "ar");
    expect(screen.getByRole("heading", { name: "آراء من مواقع تانية" })).toBeTruthy();
    expect(badges()).toEqual(["من فيسبوك", "من جوجل", "من إنستجرام", "من واتساب", "من Jumia", "من موقع تاني", "من موقع تاني"]);
    cleanup();

    inStore(<ExternalReviews reviews={list} />, "en");
    expect(screen.getByRole("heading", { name: "Reviews from other sites" })).toBeTruthy();
    expect(badges()).toEqual(["From Facebook", "From Google", "From Instagram", "From WhatsApp", "From Jumia", "From another site", "From another site"]);
  });

  it("is never marked verified, and shows the text only when published with it", () => {
    inStore(<ExternalReviews reviews={[external({ id: "a", comment: "Lovely" }), external({ id: "b", comment: null })]} />);
    expect(screen.queryByText(new RegExp(en.verified))).toBeNull();
    expect(screen.getByText("Lovely").getAttribute("dir")).toBe("auto");
    const cards = within(block()!).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[1].querySelector("p[dir='auto']")).toBeNull();
  });

  it("links to the original in a new tab, with no referrer and no ranking passed on", () => {
    inStore(
      <ExternalReviews
        reviews={[
          external({ id: "linked", url: "https://www.facebook.com/shop/posts/1" }),
          external({ id: "none", url: null }),
          external({ id: "unsafe", url: "javascript:alert(1)" }),
        ]}
      />
    );
    const links = screen.getAllByRole("link", { name: new RegExp(`^${en.seeOriginal}`) });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://www.facebook.com/shop/posts/1");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
    expect(links[0].textContent).toBe(en.seeOriginal);

    cleanup();
    inStore(<ExternalReviews reviews={[external({ url: "https://maps.google.com/x" })]} />, "ar");
    expect(screen.getByRole("link", { name: new RegExp(`^${ar.seeOriginal}`) }).textContent).toBe("شوف التقييم الأصلي");
  });

  it("dates it by the day the merchant gave, else by when it was added", () => {
    inStore(
      <ExternalReviews
        reviews={[external({ id: "given", reviewedAt: "2025-03-07" }), external({ id: "added", reviewedAt: null, createdAt: "2026-10-01T10:00:00.000Z" })]}
      />
    );
    const text = block()!.textContent ?? "";
    expect(text).toContain(new Date(2025, 2, 7).toLocaleDateString("en-EG", { year: "numeric", month: "short", day: "numeric" }));
    expect(text).toContain(new Date("2026-10-01T10:00:00.000Z").toLocaleDateString("en-EG", { year: "numeric", month: "short", day: "numeric" }));
  });

  it("comes after the shoppers' reviews and leaves the stars as they were", () => {
    const rating = { average: 4, count: 2, distribution: { "5": 1, "3": 1 } };
    const shopper = { id: "r1", rating: 5, comment: "From a shopper", createdAt: "2026-10-02T10:00:00.000Z", authorName: "Ali", photos: [], verified: true };
    inStore(
      <ProductReviews
        workspaceId="ws1"
        productId="prod-1"
        rating={rating}
        reviews={[shopper]}
        externalReviews={[external({ rating: 1, comment: "From elsewhere" }), external({ rating: 1, comment: "Also elsewhere" })]}
      />
    );
    // The summary counts the shoppers' reviews only: 4.0 from 2, five stars once, three once, one star never.
    expect(screen.getByText("4.0")).toBeTruthy();
    expect(screen.getByText(en.basedOn(2))).toBeTruthy();
    const oneStarRow = screen.getByText(/^1 ★$/).closest("li")!;
    expect(oneStarRow.textContent).toMatch(/0$/);

    // The shoppers' review first, then the block from other sites.
    const shopperText = screen.getByText("From a shopper");
    const externalBlock = block()!;
    expect(shopperText.compareDocumentPosition(externalBlock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(externalBlock).getByText("From elsewhere")).toBeTruthy();
    // Only the shopper's review is verified.
    expect(screen.getAllByText(new RegExp(en.verified))).toHaveLength(1);
    expect(within(externalBlock).queryByText(new RegExp(en.verified))).toBeNull();
    cleanup();

    // The store's page too.
    inStore(<StoreReviews workspaceId="ws1" rating={rating} reviews={[shopper]} externalReviews={[external({ comment: "Store from elsewhere" })]} />);
    expect(screen.getByText(en.basedOn(2))).toBeTruthy();
    expect(within(block()!).getByText("Store from elsewhere")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: en.externalTitle })).toBeTruthy();
  });
});
