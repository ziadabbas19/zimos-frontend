import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreButtonLoader, StoreLoader } from "./StoreLoader";

/**
 * The storefront's loader stays in the store's own colour (its trail a tint of
 * it), not the ZIMOS mark's cyan-to-blue; in a button it takes the text colour.
 */

afterEach(cleanup);

const store = { workspaceId: "w1", id: "w1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;

function show(node: React.ReactNode, locale: "en" | "ar" = "en") {
  return render(
    <StoreContextProvider locale={locale} store={store}>
      {node}
    </StoreContextProvider>
  );
}

describe("StoreLoader", () => {
  it("draws the comet in the store's brand colour, announced in the shopper's language", () => {
    show(<StoreLoader />, "ar");
    const svg = screen.getByRole("status");
    expect(svg.getAttribute("data-tone")).toBe("own");
    expect((svg as unknown as SVGSVGElement).style.getPropertyValue("--zl-c")).toBe("var(--color-primary, #0080e0)");
    expect(svg.getAttribute("aria-label")).toBeTruthy();
  });

  it("takes the text colour at sm and inside a button", () => {
    const { container } = show(
      <>
        <StoreLoader size="sm" label="Loading the cart" />
        <button type="button">
          <StoreButtonLoader label="Loading more">More</StoreButtonLoader>
        </button>
      </>
    );
    for (const svg of Array.from(container.querySelectorAll("svg"))) {
      expect(svg.style.getPropertyValue("--zl-c")).toBe("currentColor");
    }
  });
});
