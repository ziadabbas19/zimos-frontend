import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Review } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReviewsPage } from "./ReviewsPage";

/**
 * Reviews from other sites: the merchant brings a real review from Facebook,
 * Google or elsewhere, with where it was written. It shows with that source,
 * never as a buyer's, and an older review added by hand can be given one.
 */

function row(id: string, fields: Record<string, unknown>): Review {
  return fake<Review>({
    id,
    workspaceId: "ws_1",
    kind: "product",
    productId: "p1",
    rating: 5,
    comment: null,
    status: "approved",
    photos: [],
    purchase: { state: "none", orderId: null, orderNumber: null },
    createdAt: "2026-10-09T10:00:00Z",
    updatedAt: "2026-10-09T10:00:00Z",
    product: { id: "p1", name: "Headphones Pro" },
    customer: null,
    customerId: null,
    ...fields,
  });
}

const shopper = row("r1", {
  source: "customer",
  comment: "Sound is great",
  customerId: "c1",
  customer: { id: "c1", fullName: "Mona Adel" },
  purchase: { state: "delivered", orderId: "o1", orderNumber: "ORD-1" },
});
const fromFacebook = row("r2", { source: "external", externalSource: "facebook", authorName: "Hany", comment: "Loved it on the page" });
const fromJumia = row("r3", {
  source: "external",
  externalSource: "other",
  externalSourceLabel: "Jumia",
  externalUrl: "https://www.jumia.com.eg/review/1",
  reviewedAt: "2026-09-14",
  authorName: "Omar",
  rating: 4,
  comment: "Good value",
});
const byHand = row("r4", { source: "manual", authorName: "Sara", rating: 4, comment: "From a call", photos: ["https://cdn.example.com/a.jpg"] });

/** The calls the page made to one path, with what they sent. */
function callsTo(path: string): Array<{ method?: string; body?: Record<string, unknown> }> {
  return api.request.mock.calls.filter(([url]) => url === path).map(([, options]) => (options ?? {}) as { method?: string; body?: Record<string, unknown> });
}

afterEach(() => {
  api.listReviews.mockReset();
  api.listProducts.mockReset();
  api.request.mockReset();
});

describe("reviews from other sites", () => {
  it("adds one about the whole store: the honesty notice first, a source required, no product sent", async () => {
    api.listReviews.mockResolvedValue([]);
    api.listProducts.mockResolvedValue(fake({ products: [] }));
    api.request.mockResolvedValue({ review: fromFacebook });
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    await user.click((await screen.findAllByRole("button", { name: "Add a review from another site" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add a review from another site" });
    expect(within(dialog).getByText("Add only real reviews that actually reached you from your customers.")).toBeInTheDocument();
    expect(within(dialog).getByText(/don't count in your stars/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Reviewer's name/), "Hany");
    await user.click(within(dialog).getByRole("radio", { name: "The whole store" }));
    // A store review has no product to pick.
    expect(within(dialog).queryByLabelText(/^Product/)).not.toBeInTheDocument();

    // Without a source nothing is sent.
    await user.click(within(dialog).getByRole("button", { name: "Add review" }));
    expect(await within(dialog).findByText("Choose where it was written.")).toBeInTheDocument();
    expect(callsTo("/workspaces/ws_1/reviews")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Facebook" }));
    // A bare address gets https:// in front of it.
    await user.type(within(dialog).getByLabelText(/Link to the review/), "facebook.com/nile/posts/1");
    await user.click(within(dialog).getByRole("button", { name: "Add review" }));

    await waitFor(() => expect(callsTo("/workspaces/ws_1/reviews")).toHaveLength(1));
    const [sent] = callsTo("/workspaces/ws_1/reviews");
    expect(sent.method).toBe("POST");
    expect(sent.body).toMatchObject({
      kind: "store",
      externalSource: "facebook",
      externalSourceLabel: null,
      externalUrl: "https://facebook.com/nile/posts/1",
      reviewedAt: null,
      authorName: "Hany",
      rating: 5,
      status: "approved",
    });
    expect(sent.body).not.toHaveProperty("productId");
    expect(await screen.findByText("Review added.")).toBeInTheDocument();
  });

  it("asks for the name of an other source, and refuses a link that is not a web address", async () => {
    api.listReviews.mockResolvedValue([]);
    api.listProducts.mockResolvedValue(fake({ products: [{ id: "p1", name: "Headphones Pro" }] }));
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    await user.click((await screen.findAllByRole("button", { name: "Add a review from another site" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Add a review from another site" });
    await user.click(within(dialog).getByRole("button", { name: "Other" }));
    await user.type(within(dialog).getByLabelText(/Link to the review/), "javascript:alert(1)");
    await user.click(within(dialog).getByRole("button", { name: "Add review" }));

    expect(await within(dialog).findByText("Write where it was written.")).toBeInTheDocument();
    expect(within(dialog).getByText("Write a full web address, like https://…")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose the product this review is about.")).toBeInTheDocument();
    expect(callsTo("/workspaces/ws_1/reviews")).toHaveLength(0);
  });

  it("edits a review added by hand from the row's menu, and choosing a source makes it one from another site", async () => {
    api.listReviews.mockResolvedValue([byHand]);
    api.listProducts.mockResolvedValue(fake({ products: [{ id: "p1", name: "Headphones Pro" }] }));
    api.request.mockImplementation((async (_path: string, options?: { body?: object }) => ({
      review: { ...byHand, ...options?.body, source: "external", updatedAt: "2026-10-29T10:00:00Z" },
    })) as never);
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all" });

    await user.click((await screen.findAllByRole("button", { name: "Actions for this review" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the review" });
    expect(within(dialog).getByLabelText(/Reviewer's name/)).toHaveValue("Sara");
    // The one line that says what a source does to it.
    expect(within(dialog).getByText(/turn it into a review from another site/)).toBeInTheDocument();
    // Whether it shows is the list's business once it exists.
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Google" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const path = "/workspaces/ws_1/reviews/r4/content";
    await waitFor(() => expect(callsTo(path)).toHaveLength(1));
    const [sent] = callsTo(path);
    expect(sent.method).toBe("PATCH");
    expect(sent.body).toMatchObject({ kind: "product", productId: "p1", authorName: "Sara", rating: 4, comment: "From a call", externalSource: "google" });
    // Unchanged photos go back untouched, and an edit never sends a status.
    expect(sent.body).not.toHaveProperty("photos");
    expect(sent.body).not.toHaveProperty("status");

    expect((await screen.findAllByText("From Google")).length).toBeGreaterThan(0);
    expect(screen.getByText("Review saved.")).toBeInTheDocument();
  });

  it("shows where an external review was written in Quick Look, with its link and day, and edits it from there", async () => {
    api.listReviews.mockResolvedValue([fromJumia]);
    api.listProducts.mockResolvedValue(fake({ products: [{ id: "p1", name: "Headphones Pro" }] }));
    api.request.mockImplementation((async (_path: string, options?: { body?: object }) => ({ review: { ...fromJumia, ...options?.body } })) as never);
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all" });

    await user.click(await screen.findByRole("button", { name: "Preview the review of Headphones Pro by Omar" }));
    const peek = (await screen.findAllByText("Where it was written")).at(-1)?.closest("section") as HTMLElement;
    expect(within(peek).getByText("From Jumia")).toBeInTheDocument();
    expect(within(peek).getByText(/Written .*2026/)).toBeInTheDocument();
    const link = within(peek).getByRole("link", { name: /original review/ });
    expect(link).toHaveAttribute("href", "https://www.jumia.com.eg/review/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the review" });
    expect(within(dialog).getByRole("button", { name: "Other" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByLabelText(/Its name/)).toHaveValue("Jumia");
    await user.click(within(dialog).getByRole("button", { name: "3 out of 5" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const path = "/workspaces/ws_1/reviews/r3/content";
    await waitFor(() => expect(callsTo(path)).toHaveLength(1));
    expect(callsTo(path)[0].body).toMatchObject({
      rating: 3,
      externalSource: "other",
      externalSourceLabel: "Jumia",
      externalUrl: "https://www.jumia.com.eg/review/1",
      reviewedAt: "2026-09-14",
    });
  });

  it("narrows the list to reviews from other sites or from customers, and reads the older ?source= links", async () => {
    api.listReviews.mockResolvedValue([shopper, fromFacebook, byHand]);
    const first = renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all&source=external" });
    expect((await screen.findAllByText("Loved it on the page")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Sound is great")).not.toBeInTheDocument();
    expect(screen.queryByText("From a call")).not.toBeInTheDocument();
    expect(screen.getByText("Source: From other sites")).toBeInTheDocument();
    first.unmount();

    const second = renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all&source=customer" });
    expect((await screen.findAllByText("Sound is great")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Loved it on the page")).not.toBeInTheDocument();
    second.unmount();

    // A link from before the origin filter: hand-added reviews.
    renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all&source=manual" });
    expect((await screen.findAllByText("From a call")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Loved it on the page")).not.toBeInTheDocument();
    expect(screen.getByText("Source: Added by hand before")).toBeInTheDocument();
  });

  it("chooses the origin in the filter sheet", async () => {
    api.listReviews.mockResolvedValue([shopper, fromFacebook]);
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all" });

    expect((await screen.findAllByText("Sound is great")).length).toBeGreaterThan(0);
    // The list cached by the test before shows first: wait for this store's own.
    await waitFor(() => expect(screen.queryByText("From a call")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Filters" }));
    // No hand-added reviews in this store: that choice is not offered.
    expect(screen.queryByRole("button", { name: "Added by hand before" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "From other sites" }));

    await waitFor(() => expect(screen.queryByText("Sound is great")).not.toBeInTheDocument());
    expect(screen.getAllByText("Loved it on the page").length).toBeGreaterThan(0);
  });

  it("gives an external review its source badge and never the purchase badge", async () => {
    // Even a row that says "delivered" (it never should) is not shown as a buyer's.
    const odd = row("r5", { source: "external", externalSource: "instagram", authorName: "Nour", purchase: { state: "delivered", orderId: "o9", orderNumber: "ORD-9" } });
    api.listReviews.mockResolvedValue([fromFacebook, odd, shopper]);
    renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all&source=external" });

    expect((await screen.findAllByText("From Instagram")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("From Facebook").length).toBeGreaterThan(0);
    expect(screen.queryByText("Did not buy")).not.toBeInTheDocument();
    expect(screen.queryByText("Bought — delivered")).not.toBeInTheDocument();
    // The note about hand-added reviews is for those only.
    expect(screen.queryByText(/no longer count in your stars/)).not.toBeInTheDocument();
  });

  it("names the source in the dashboard's Arabic", async () => {
    api.listReviews.mockResolvedValue([fromFacebook, fromJumia]);
    renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all", locale: "ar" });

    expect((await screen.findAllByText("من Jumia")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("من فيسبوك").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "إضافة تقييم من مصدر خارجي" }).length).toBeGreaterThan(0);
  });
});
