import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { PRODUCT_COMBOS_ENABLED } from "@/lib/features";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import app from "../../App.tsx?raw";
import prefetch from "../../routes/prefetch.ts?raw";
import { OffersPage } from "./OffersPage";

/** Product combos with VITE_PRODUCT_COMBOS_ENABLED unset: the dashboard as it was before them. */
describe("combos with the switch off", () => {
  it("is off unless the build turns it on", () => {
    expect(PRODUCT_COMBOS_ENABLED).toBe(false);
  });

  it("has no card on the offers hub", async () => {
    api.request.mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<OffersPage />, { route: "/offers" });
    expect(await screen.findByRole("link", { name: /Bundles/ })).toHaveAttribute("href", "/offers/bundles");
    expect(screen.queryByRole("link", { name: /Combos/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/offers/combos"]')).toBeNull();
  });

  it("has its page only behind the switch, the address going back to the offers hub otherwise", () => {
    expect(app).toContain(
      '<Route path="/offers/combos" element={PRODUCT_COMBOS_ENABLED ? <LazyRoute><CombosPage /></LazyRoute> : <Navigate to="/offers" replace />} />'
    );
    expect(app.match(/<CombosPage \/>/g)).toHaveLength(1);
    expect(prefetch).toContain('if (PRODUCT_COMBOS_ENABLED) registerPrefetch("/offers/combos"');
  });
});
