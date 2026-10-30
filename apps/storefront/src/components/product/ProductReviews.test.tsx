import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import type { Locale } from "@/lib/i18n";
import { REVIEW_TEXT } from "@/components/reviews/reviewText";

/*
 * The product page's reviews: the form shows only while the store takes
 * reviews (`store.reviews.open`), opens by itself from the store's review
 * request (`?review=<token>#reviews`) and sends that order's token, and
 * every answer is said in the shopper's words.
 */

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request, uploadCustomerPhoto: vi.fn() }) }));
vi.mock("@/lib/visitorId", () => ({ getVisitorId: () => "visitor-1" }));
vi.mock("@/lib/botGuard", () => ({ getDeviceId: () => "device-12345678" }));

import { ProductReviews } from "./ProductReviews";

const NO_STARS = { average: null, count: 0, distribution: {} };
const en = REVIEW_TEXT.en;
const ar = REVIEW_TEXT.ar;
const TOKEN = "AbCdEfGhIjKlMnOpQrStUw.c2lnbmF0dXJlLXNpZ25lZA";

function storeInfo(open: boolean | undefined): StoreInfo {
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
    ...(open === undefined ? {} : { reviews: { open, storeRating: NO_STARS } }),
  } as unknown as StoreInfo;
}

function show({ open, locale = "en", formOnly = false }: { open?: boolean; locale?: Locale; formOnly?: boolean }) {
  return render(
    <StoreContextProvider locale={locale} store={storeInfo(open)}>
      <ProductReviews workspaceId="ws1" productId="prod-1" rating={NO_STARS} reviews={[]} formOnly={formOnly} />
    </StoreContextProvider>
  );
}

const posts = () => request.mock.calls.filter(([, options]) => (options as { method?: string } | undefined)?.method === "POST");

beforeEach(() => {
  request.mockReset();
  window.history.replaceState(null, "", "/products/mug");
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("the review form on a product page", () => {
  it("is not offered while the store takes no reviews, nor by an older API", () => {
    show({ open: false });
    expect(screen.queryByRole("button", { name: en.write })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    // The reviews themselves still show.
    expect(screen.getByRole("heading", { name: en.title })).toBeTruthy();
    cleanup();

    show({ open: undefined });
    expect(screen.queryByRole("button", { name: en.write })).toBeNull();
    cleanup();

    // The builder's review_form element draws nothing at all.
    const { container } = show({ open: false, formOnly: true });
    expect(container.innerHTML).toBe("");

    // Not even from the store's review link.
    cleanup();
    window.history.replaceState(null, "", `/products/mug?review=${TOKEN}#reviews`);
    show({ open: false });
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("opens by itself from the store's review link, sends that order's token and thanks the shopper", async () => {
    window.history.replaceState(null, "", `/products/mug?review=${TOKEN}#reviews`);
    request.mockResolvedValue({ review: { received: true, status: "pending", id: "rev-1" } });
    show({ open: true });

    expect(document.getElementById("reviews")).not.toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: en.stars(4) }));
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${en.comment}`) }), { target: { value: "Lovely mug" } });
    // The order link names the order: no phone needed.
    fireEvent.click(screen.getByRole("button", { name: en.submit }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/store/ws1/products/prod-1/reviews", {
        method: "POST",
        body: { rating: 4, comment: "Lovely mug", orderToken: TOKEN, deviceId: "device-12345678" },
        auth: false,
        headers: { "X-Visitor-Id": "visitor-1" },
      })
    );
    expect(await screen.findByText(en.thanks)).toBeTruthy();
    // The form is gone and cleared.
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: en.write })).toBeNull();
  });

  it("asks for the stars and the phone before anything is sent", async () => {
    show({ open: true });
    fireEvent.click(screen.getByRole("button", { name: en.write }));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    expect(await screen.findByText(en.ratingRequired)).toBeTruthy();
    expect(screen.getByText(en.phoneRequired)).toBeTruthy();
    expect(posts()).toHaveLength(0);

    // With them, the phone, name and words go out as typed.
    request.mockResolvedValue({ review: { received: true, status: "pending", id: "rev-2" } });
    fireEvent.click(screen.getByRole("radio", { name: en.stars(5) }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.phone}`)), { target: { value: " 01012345678 " } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.name}`)), { target: { value: "Mona Ali" } });
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0][1]).toMatchObject({ body: { rating: 5, phone: "01012345678", name: "Mona Ali", deviceId: "device-12345678" } });
    expect(await screen.findByText(en.thanks)).toBeTruthy();
  });

  it("says in the shopper's Arabic when this phone or device already reviewed the product", async () => {
    request.mockRejectedValue(new ApiError("You have already reviewed this", 409, "ALREADY_REVIEWED"));
    show({ open: true, locale: "ar" });
    fireEvent.click(screen.getByRole("button", { name: ar.write }));
    fireEvent.click(screen.getByRole("radio", { name: ar.stars(3) }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${ar.phone}`)), { target: { value: "01012345678" } });
    fireEvent.click(screen.getByRole("button", { name: ar.submit }));
    expect(await screen.findByText("انت قيّمت المنتج ده قبل كده — شكرًا ليك!")).toBeTruthy();
    // The form stays, nothing was thanked for.
    expect(screen.queryByText(ar.thanks)).toBeNull();
  });

  it("names a wrong phone beside the field, and sending closed since the page loaded", async () => {
    show({ open: true });
    fireEvent.click(screen.getByRole("button", { name: en.write }));
    fireEvent.click(screen.getByRole("radio", { name: en.stars(2) }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${en.phone}`)), { target: { value: "123" } });

    request.mockRejectedValueOnce(new ApiError("Enter a valid phone number", 422, "INVALID_PHONE"));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    expect(await screen.findByText(en.invalidPhone)).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(`^${en.phone}`)).getAttribute("aria-invalid")).toBe("true");

    request.mockRejectedValueOnce(new ApiError("Not found", 404, "NOT_FOUND"));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    expect(await screen.findByText(en.closed)).toBeTruthy();

    request.mockRejectedValueOnce(new ApiError("Too many reviews from here", 429, "TOO_MANY_REQUESTS"));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    expect(await screen.findByText(en.tooFast)).toBeTruthy();
  });
});
