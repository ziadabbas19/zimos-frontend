import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { Product } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelWizardSheet } from "./FunnelWizard";

// The AI card of the wizard's last question exists only while AI is switched on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  AI_ENABLED: true,
}));

const product = fake<Product>({ id: "p1", name: "Headphones Pro", status: "active", media: [], variants: [], offers: [] });

describe("the new-funnel wizard with AI switched on", () => {
  it("offers the AI template first among the ready funnels, and its questions once chosen", async () => {
    api.listProducts.mockResolvedValue(fake({ products: [product], nextCursor: null }));
    const { user } = renderWithProviders(<FunnelWizardSheet open onOpenChange={() => undefined} onCreated={() => undefined} />);

    await user.click(await screen.findByRole("radio", { name: /Headphones Pro/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    const card = screen.getByRole("radio", { name: /AI template/ });
    expect(screen.getAllByRole("radio", { name: /./ }).filter((el) => el.getAttribute("name") === "funnel-template")[0]).toBe(card);
    expect(screen.queryByLabelText("Who is it for?")).not.toBeInTheDocument();

    await user.click(card);
    expect(card).toBeChecked();
    expect(screen.getByLabelText("Who is it for?")).toBeInTheDocument();
  });

  it("asks for a product before the AI writes anything", async () => {
    api.listProducts.mockResolvedValue(fake({ products: [product], nextCursor: null }));
    const { user } = renderWithProviders(<FunnelWizardSheet open onOpenChange={() => undefined} onCreated={() => undefined} />);

    await user.click(await screen.findByRole("radio", { name: /Continue without a product/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: /AI template/ }));
    await user.type(screen.getByLabelText("Funnel name"), "Spring sale");
    await user.click(screen.getByRole("button", { name: "Build the funnel" }));

    expect(screen.getByRole("alert")).toHaveTextContent("The AI writes the page from a product. Go back and choose one.");
    expect(api.request).not.toHaveBeenCalled();
  });
});
