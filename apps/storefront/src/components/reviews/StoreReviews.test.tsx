import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError, type StorefrontMeta } from "@store-builder/api-client";
import { StoreRouteProvider } from "@/components/StoreRoute";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";
import { REVIEW_TEXT } from "./reviewText";

/*
 * The store's own reviews: its stars in the footer (only once a counted
 * review exists) linking to its reviews page, and the short review of the
 * store on the thank-you page, offered only while the store takes reviews,
 * with the order's phone filled in.
 */

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request, uploadCustomerPhoto: vi.fn() }) }));
vi.mock("@/lib/visitorId", () => ({ getVisitorId: () => "visitor-1" }));
vi.mock("@/lib/botGuard", () => ({ getDeviceId: () => "device-12345678" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({ workspaceId: "shop" }),
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
}));

import { StoreRatingBadge } from "./StoreRatingBadge";
import { ThankYouStoreReview } from "./ThankYouStoreReview";
import { StoreFooter } from "@/components/StoreFooter";
import { XsFooter } from "@/components/xs/XsFooter";

const en = REVIEW_TEXT.en;
const STARS = { average: 4.333, count: 3, distribution: { "5": 2, "3": 1 } };
const NONE = { average: null, count: 0, distribution: {} };

function meta(storeRating: typeof STARS | typeof NONE, extra: Record<string, unknown> = {}): StorefrontMeta {
  return {
    id: "ws1",
    name: "Shop",
    slug: "shop",
    logoUrl: null,
    tagline: null,
    currency: "EGP",
    themeSettings: {},
    navPages: [],
    headerCollections: [],
    reviews: { open: true, storeRating },
    ...extra,
  } as unknown as StorefrontMeta;
}

function info(open: boolean): StoreInfo {
  return {
    workspaceId: "ws1",
    id: "ws1",
    slug: "shop",
    name: "Shop",
    currency: "EGP",
    logoUrl: null,
    phone: null,
    checkout: {},
    orderBump: null,
    reviews: { open, storeRating: NONE },
  } as unknown as StoreInfo;
}

function inStore(node: ReactNode, { open = true, basePath = "" }: { open?: boolean; basePath?: string } = {}) {
  return render(
    <StoreRouteProvider basePath={basePath}>
      <StoreContextProvider locale="en" store={info(open)}>
        <StoreShellProvider>{node}</StoreShellProvider>
      </StoreContextProvider>
    </StoreRouteProvider>
  );
}

const ratingLink = () => screen.queryByRole("link", { name: /^Store rating/ });

beforeEach(() => {
  request.mockReset();
});
afterEach(cleanup);

describe("the store's stars in the footer", () => {
  it("shows nothing before the first counted review", () => {
    inStore(<StoreRatingBadge store={meta(NONE)} locale="en" />);
    expect(ratingLink()).toBeNull();
  });

  it("links to the store reviews page, on the store's own address or under /store/<slug>", () => {
    inStore(<StoreRatingBadge store={meta(STARS)} locale="en" />);
    const link = ratingLink()!;
    expect(link.getAttribute("href")).toBe("/store-reviews");
    expect(link.getAttribute("aria-label")).toBe("Store rating: 4.3 out of 5 from 3 reviews. See the reviews");
    expect(link.textContent).toContain("4.3");
    cleanup();

    inStore(<StoreRatingBadge store={meta(STARS)} locale="en" />, { basePath: "/store/shop" });
    expect(ratingLink()!.getAttribute("href")).toBe("/store/shop/store-reviews");
  });

  it("sits in the store's footer, the rich footer and a template's footer", () => {
    inStore(<StoreFooter store={meta(STARS)} locale="en" year={2026} />);
    expect(ratingLink()).not.toBeNull();
    cleanup();

    inStore(<StoreFooter store={meta(STARS, { themeSettings: { footer: { layout: "rich" } } })} locale="en" year={2026} />);
    expect(ratingLink()).not.toBeNull();
    cleanup();

    inStore(<XsFooter store={meta(STARS, { themeSettings: { xsLook: "05" } })} locale="en" year={2026} look="05" />);
    expect(ratingLink()).not.toBeNull();
    cleanup();

    inStore(<StoreFooter store={meta(NONE)} locale="en" year={2026} />);
    expect(ratingLink()).toBeNull();
  });
});

describe("reviewing the store on the thank-you page", () => {
  it("is not offered while the store takes no reviews", () => {
    const { container } = inStore(<ThankYouStoreReview workspaceId="ws1" phone="01012345678" />, { open: false });
    expect(container.innerHTML).toBe("");
  });

  it("sends the stars and words with the order's phone, then thanks the shopper", async () => {
    request.mockResolvedValue({ review: { received: true, status: "pending", id: "rev-9" } });
    inStore(<ThankYouStoreReview workspaceId="ws1" phone="01012345678" />);
    // Short: no name, no photos.
    expect(screen.queryByLabelText(new RegExp(`^${en.name}`))).toBeNull();
    expect(screen.queryByText(en.addPhoto)).toBeNull();
    expect((screen.getByLabelText(new RegExp(`^${en.phone}`)) as HTMLInputElement).value).toBe("01012345678");

    fireEvent.click(screen.getByRole("radio", { name: en.stars(5) }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.commentStore}`)), { target: { value: "Fast and friendly" } });
    fireEvent.click(screen.getByRole("button", { name: en.submit }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/store/ws1/store-reviews", {
        method: "POST",
        body: { rating: 5, phone: "01012345678", comment: "Fast and friendly", deviceId: "device-12345678" },
        auth: false,
        headers: { "X-Visitor-Id": "visitor-1" },
      })
    );
    expect(await screen.findByText(en.thanks)).toBeTruthy();
  });

  it("says when this phone already reviewed the store", async () => {
    request.mockRejectedValue(new ApiError("You have already reviewed this", 409, "ALREADY_REVIEWED"));
    inStore(<ThankYouStoreReview workspaceId="ws1" phone="01012345678" />);
    fireEvent.click(screen.getByRole("radio", { name: en.stars(4) }));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    expect(await screen.findByText(en.alreadyStore)).toBeTruthy();
  });
});
