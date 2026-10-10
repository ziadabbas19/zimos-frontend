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
    api.moderateReview.mockImplementation(async (_ws: string, id: string, action: "approve" | "reject") =>
      fake<Review>({ ...waiting, id, status: action === "approve" ? "approved" : "rejected" })
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
});
