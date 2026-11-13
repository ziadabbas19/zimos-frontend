import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import type { Locale } from "@/lib/i18n";
import type { StoreEmailSignup } from "@store-builder/api-client";

// --- the page's surroundings, stubbed --------------------------------------
const placeCodOrder = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws1" }),
  useRouter: () => ({ push }),
  usePathname: () => "/store/ws1/checkout",
}));

vi.mock("@/components/StoreRoute", () => ({
  StoreLink: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useStoreBasePath: () => "/store/ws1",
}));

vi.mock("@/lib/CartProvider", () => ({
  useCart: () => ({
    cart: {
      currency: "EGP",
      subtotal: 64900,
      guestToken: "cart-token",
      items: [
        {
          id: "line1",
          variantId: "v1",
          quantity: 1,
          lineTotal: 64900,
          variant: { optionValues: {} },
          customizations: [],
        },
      ],
    },
    clearCart: vi.fn(),
  }),
}));

// Every API call the hooks make fails quietly (they all fall back to defaults:
// cash on delivery, the store's own settings, no catalogue, no quote).
vi.mock("@/lib/apiClient", () => ({
  createStorefrontApiClient: () =>
    new Proxy({}, { get: () => () => Promise.reject(new Error("offline in tests")) }),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), EMAIL_CAMPAIGNS_ENABLED: true }));

vi.mock("@/lib/placeOrder", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/placeOrder")>()),
  placeCodOrder: (...args: unknown[]) => placeCodOrder(...args),
}));

const { default: CheckoutPage } = await import("./page");

const BASE: StoreInfo = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

function renderPage(locale: Locale = "ar", emailSignup?: StoreEmailSignup | null) {
  return render(
    <StoreContextProvider locale={locale} store={{ ...BASE, emailSignup }}>
      <CheckoutPage />
    </StoreContextProvider>
  );
}

function fillValid(phone = "01012345678") {
  fireEvent.change(document.getElementById("checkout-fullName")!, { target: { value: "سلمى نبيل" } });
  fireEvent.change(document.getElementById("checkout-phone")!, { target: { value: phone } });
  fireEvent.change(document.getElementById("checkout-governorate")!, { target: { value: "cairo" } });
  fireEvent.change(document.getElementById("checkout-city")!, { target: { value: "مدينة نصر" } });
  fireEvent.change(document.getElementById("checkout-address")!, { target: { value: "١٢ شارع عباس العقاد" } });
}

const confirmButtons = () => screen.getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("type") === "submit");
const TEXT = { ar: { label: null, privacy: null, incentive: null }, en: { label: null, privacy: null, incentive: null } };
const OFF: StoreEmailSignup = { checkout: null, quickOrder: null, cart: null, footer: null, popup: null, text: TEXT };
const BOX = "Email me offers and news from Shop";

async function placeWith(email: string) {
  fillValid();
  fireEvent.change(document.getElementById("checkout-email")!, { target: { value: email } });
  fireEvent.click(confirmButtons()[0]);
  await waitFor(() => expect(placeCodOrder).toHaveBeenCalledTimes(1));
  const [{ payload }] = placeCodOrder.mock.calls[0] as [{ payload: Record<string, unknown> }];
  return payload;
}

beforeEach(async () => {
  placeCodOrder.mockReset();
  placeCodOrder.mockReturnValue(new Promise(() => {}));
  push.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  (await import("@/lib/emailSignup")).forgetSignupMemory();
});
afterEach(cleanup);

// "Email me offers" at checkout with the merchant's places (lib/emailSignup.ts):
// the box starts as set, and what it shows when the order is placed is what is sent.
describe("the checkout's signup box", () => {
  it("starts ticked when the merchant says so; unticked before placing the order, it sends no consent", async () => {
    renderPage("en", { ...OFF, checkout: { preTicked: true } });
    const box = screen.getByRole("checkbox", { name: BOX }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    const payload = await placeWith("buyer@example.com");
    expect(payload.marketingConsent).toBeUndefined();
    expect(payload.marketingConsentSource).toBeUndefined();
  });

  it("left ticked, sends the consent from the checkout", async () => {
    renderPage("en", { ...OFF, checkout: { preTicked: true } });
    const payload = await placeWith("buyer@example.com");
    expect(payload.marketingConsent).toBe(true);
    // The checkout is the default source: nothing more is sent.
    expect(payload.marketingConsentSource).toBeUndefined();
  });

  it("starts unticked by default, and an older API still gets its box", () => {
    renderPage("en", undefined);
    expect((screen.getByRole("checkbox", { name: BOX }) as HTMLInputElement).checked).toBe(false);
  });

  it("is not there when the merchant switched it off, or the feature is off for the store", () => {
    renderPage("en", OFF);
    expect(screen.queryByRole("checkbox", { name: BOX })).toBeNull();
    cleanup();
    renderPage("en", null);
    expect(screen.queryByRole("checkbox", { name: BOX })).toBeNull();
  });

  it("takes the cart's choice: shown again here, sent from the cart unless changed here", async () => {
    sessionStorage.setItem("zimos.emailSignup.cart.ws1", "1");
    renderPage("en", { ...OFF, checkout: { preTicked: false }, cart: { preTicked: false } });
    await waitFor(() => expect((screen.getByRole("checkbox", { name: BOX }) as HTMLInputElement).checked).toBe(true));
    const payload = await placeWith("cart@example.com");
    expect(payload).toEqual(expect.objectContaining({ marketingConsent: true, marketingConsentSource: "cart" }));
  });

  it("sends a ticked cart box with the order when the checkout has no box of its own", async () => {
    sessionStorage.setItem("zimos.emailSignup.cart.ws1", "1");
    renderPage("en", { ...OFF, cart: { preTicked: false } });
    expect(screen.queryByRole("checkbox", { name: BOX })).toBeNull();
    const payload = await placeWith("cart@example.com");
    expect(payload).toEqual(expect.objectContaining({ marketingConsent: true, marketingConsentSource: "cart" }));
  });

  it("sends nothing without an address, ticked or not", async () => {
    renderPage("ar", { ...OFF, checkout: { preTicked: true } });
    fillValid();
    fireEvent.click(confirmButtons()[0]);
    await waitFor(() => expect(placeCodOrder).toHaveBeenCalledTimes(1));
    const [{ payload }] = placeCodOrder.mock.calls[0] as [{ payload: Record<string, unknown> }];
    expect(payload.marketingConsent).toBeUndefined();
  });
});
