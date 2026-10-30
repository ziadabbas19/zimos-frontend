import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Review } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReviewsPage } from "./ReviewsPage";

/**
 * Reviews wait for the merchant before they show in the store: one press
 * approves or hides, and the toast takes it back with the same call.
 */

function review(id: string, status: Review["status"], comment: string): Review {
  return fake<Review>({
    id,
    workspaceId: "ws_1",
    productId: "p1",
    customerId: "c1",
    orderId: "o1",
    rating: 5,
    comment,
    status,
    createdAt: "2026-10-09T10:00:00Z",
    updatedAt: "2026-10-09T10:00:00Z",
    product: { id: "p1", name: "Headphones Pro" },
    customer: { id: "c1", fullName: "Mona Adel" },
  });
}

const waiting = review("r1", "pending", "Sound is great");
const shown = review("r2", "approved", "Arrived fast");

afterEach(() => {
  api.listReviews.mockReset();
  api.moderateReview.mockReset();
  api.request.mockReset();
});

describe("the reviews page", () => {
  it("counts the reviews by where they stand, and offers no import", async () => {
    api.listReviews.mockResolvedValue([waiting, shown]);
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    expect((await screen.findAllByText(/Sound is great/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Waiting for you/ })).toHaveTextContent("1");
    // The whole list is read once, with no status in the request: the chips count it in the browser.
    expect(api.listReviews).toHaveBeenCalledWith("ws_1");

    await user.click(screen.getByRole("button", { name: "Tools" }));
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent).join(" ")).not.toMatch(/import/i);
  });

  it("approves a waiting review in one press and takes it back from the toast", async () => {
    api.listReviews.mockResolvedValue([waiting]);
    api.moderateReview.mockImplementation(async (_ws: string, id: string, action: string) =>
      fake<Review>({ ...waiting, id, status: action === "reject" ? "rejected" : "approved", showText: action !== "approve_stars" })
    );
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    await user.click((await screen.findAllByRole("button", { name: "Approve" }))[0]);
    await waitFor(() => expect(api.moderateReview).toHaveBeenCalledWith("ws_1", "r1", "approve"));
    expect(await screen.findByText("Approved — it shows in your store now.")).toBeInTheDocument();

    // The way back is named for what it does.
    await user.click(screen.getByRole("button", { name: "Hide it" }));
    await waitFor(() => expect(api.moderateReview).toHaveBeenLastCalledWith("ws_1", "r1", "reject"));
  });

  it("reads in the dashboard's own Arabic", async () => {
    api.listReviews.mockResolvedValue([waiting]);
    renderWithProviders(<ReviewsPage />, { route: "/reviews", locale: "ar" });

    expect((await screen.findAllByText("ينتظر موافقتك")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /تنتظر موافقتك/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "موافقة" }).length).toBeGreaterThan(0);
  });

  it("deletes a shopper's review too, after asking", async () => {
    api.listReviews.mockResolvedValue([waiting]);
    api.request.mockResolvedValue({ deleted: true, id: "r1" });
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    await user.click((await screen.findAllByRole("button", { name: "Actions for this review" }))[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete review" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/reviews/r1", { method: "DELETE" }));
  });

  it("says whether the reviewer bought, and publishes the stars alone from the row's menu", async () => {
    const bought = fake<Review>({ ...waiting, purchase: { state: "delivered", orderId: "o1", orderNumber: "ORD-1" } });
    const stranger = fake<Review>({ ...review("r3", "pending", "Never ordered"), customerId: null, customer: null, authorName: "Visitor", purchase: { state: "none", orderId: null, orderNumber: null } });
    api.listReviews.mockResolvedValue([bought, stranger]);
    api.moderateReview.mockImplementation(async (_ws: string, id: string, action: string) =>
      fake<Review>({ ...bought, id, status: "approved", showText: action !== "approve_stars" })
    );
    const { user } = renderWithProviders(<ReviewsPage />, { route: "/reviews" });

    expect((await screen.findAllByText("Bought — delivered")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Did not buy").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Actions for this review" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Publish the stars only" }));
    await waitFor(() => expect(api.moderateReview).toHaveBeenCalledWith("ws_1", "r1", "approve_stars"));
    expect(await screen.findByText("Published — your store shows its stars only.")).toBeInTheDocument();
  });

  it("names a store review as one of the store, and tells about the reviews added by hand", async () => {
    const storeReview = fake<Review>({ ...review("r4", "pending", "Lovely shop"), kind: "store", productId: null, product: null });
    const manual = fake<Review>({ ...review("r5", "approved", "From WhatsApp"), source: "manual", authorName: "Sara", customerId: null, customer: null });
    api.listReviews.mockResolvedValue([storeReview, manual]);
    renderWithProviders(<ReviewsPage />, { route: "/reviews?status=all" });

    expect((await screen.findAllByText("Your store")).length).toBeGreaterThan(0);
    expect(screen.getByText(/no longer count in your stars/)).toBeInTheDocument();
  });
});
