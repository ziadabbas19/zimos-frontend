import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StoreEmailSignup } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import type { Locale } from "@/lib/i18n";
import productLanding from "../product/ProductLanding.tsx?raw";
import layout from "../../app/store/[workspaceId]/layout.tsx?raw";

// The store's email signup places (lib/emailSignup.ts): the footer band, the
// popup, the cart's box and the quick order form's. Each shows only where the
// merchant switched it on, in the shopper's language and direction, works
// from the keyboard, and starts ticked or not as the merchant chose.

const request = vi.fn();
let pathname = "/store/ws1";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), EMAIL_CAMPAIGNS_ENABLED: true }));

const { EmailSignupPopup, FooterEmailSignup } = await import("./EmailSignup");
const { CartConsentBox } = await import("./CartConsentBox");
const signupLib = await import("@/lib/emailSignup");

const TEXT = { ar: { label: null, privacy: null, incentive: null }, en: { label: null, privacy: null, incentive: null } };
const OFF: StoreEmailSignup = { checkout: null, quickOrder: null, cart: null, footer: null, popup: null, text: TEXT };

function storeWith(emailSignup: StoreEmailSignup | null | undefined, email: "hidden" | "optional" | "required" = "optional"): StoreInfo {
  return {
    workspaceId: "shop",
    id: "ws1",
    slug: "shop",
    name: "Nour",
    currency: "EGP",
    logoUrl: null,
    phone: null,
    checkout: { email, postal_code: "hidden", notes: "optional" },
    orderBump: null,
    emailSignup,
  };
}

function renderIn(node: React.ReactNode, signup: StoreEmailSignup | null | undefined, locale: Locale = "en", email: "hidden" | "optional" | "required" = "optional") {
  return render(
    <StoreContextProvider locale={locale} store={storeWith(signup, email)}>
      <div dir={locale === "ar" ? "rtl" : "ltr"}>{node}</div>
    </StoreContextProvider>
  );
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ ok: true });
  pathname = "/store/ws1";
  localStorage.clear();
  sessionStorage.clear();
  signupLib.forgetSignupMemory();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the footer signup", () => {
  it("shows only while the merchant has it on", () => {
    renderIn(<FooterEmailSignup />, OFF);
    expect(document.querySelector("[data-email-signup='footer']")).toBeNull();
    cleanup();
    renderIn(<FooterEmailSignup />, null);
    expect(document.querySelector("[data-email-signup='footer']")).toBeNull();
    cleanup();
    // An API from before the places: the checkout box only, no footer.
    renderIn(<FooterEmailSignup />, undefined);
    expect(document.querySelector("[data-email-signup='footer']")).toBeNull();
    cleanup();
    renderIn(<FooterEmailSignup />, { ...OFF, footer: {} });
    expect(document.querySelector("[data-email-signup='footer']")).not.toBeNull();
  });

  it("signs up from the keyboard, sends the honeypot empty and says thank you", async () => {
    renderIn(<FooterEmailSignup />, { ...OFF, footer: {}, text: { ...TEXT, en: { label: "Hear from Nour", privacy: "Only good news.", incentive: "10% off your next order" } } });
    expect(screen.getByText("Hear from Nour")).toBeTruthy();
    expect(screen.getByText("10% off your next order")).toBeTruthy();
    expect(screen.getByText("Only good news.")).toBeTruthy();
    const field = screen.getByLabelText("Email address") as HTMLInputElement;
    expect(field.type).toBe("email");
    expect(field.getAttribute("autocomplete")).toBe("email");
    expect(field.getAttribute("dir")).toBe("ltr");
    fireEvent.change(field, { target: { value: " shopper@example.com " } });
    fireEvent.submit(field.closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("You're subscribed"));
    expect(request).toHaveBeenCalledWith("/store/ws1/email-signup", { method: "POST", body: { email: "shopper@example.com", source: "footer" }, auth: false });
  });

  it("checks the address before sending, and says why the server refused", async () => {
    renderIn(<FooterEmailSignup />, { ...OFF, footer: {} });
    const field = screen.getByLabelText("Email address");
    fireEvent.change(field, { target: { value: "not-an-address" } });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address.");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(request).not.toHaveBeenCalled();

    const { ApiError } = await import("@store-builder/api-client");
    request.mockRejectedValueOnce(Object.assign(Object.create(ApiError.prototype), { status: 429, message: "slow down" }));
    fireEvent.change(field, { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Too many tries. Please wait a minute and try again."));
  });

  it("speaks Arabic, right to left, with the address kept left to right", () => {
    renderIn(<FooterEmailSignup />, { ...OFF, footer: {} }, "ar");
    expect(screen.getByText("خليك أول من يعرف بعروضنا على الإيميل")).toBeTruthy();
    const button = screen.getByRole("button", { name: "اشترك" });
    expect(button.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
    expect((screen.getByLabelText("البريد الإلكتروني") as HTMLInputElement).getAttribute("dir")).toBe("ltr");
    // Large enough to hit.
    expect(button.className).toContain("min-h-11");
  });
});

describe("the popup", () => {
  const POPUP_DELAY: StoreEmailSignup = { ...OFF, popup: { trigger: "delay", delaySeconds: 5 } };

  it("opens after the merchant's seconds, once per visitor", () => {
    vi.useFakeTimers();
    renderIn(<EmailSignupPopup />, POPUP_DELAY);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Escape closes it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    // The next page, the next visit: not again.
    renderIn(<EmailSignupPopup />, POPUP_DELAY);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("zimos.emailSignup.popup.ws1")).toBe("1");
  });

  it("closes from its button, a 44px target with a name", () => {
    vi.useFakeTimers();
    renderIn(<EmailSignupPopup />, POPUP_DELAY, "ar");
    act(() => vi.advanceTimersByTime(5000));
    const close = screen.getByRole("button", { name: "إغلاق" });
    expect(close.className).toContain("h-11");
    expect(close.className).toContain("w-11");
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["/store/ws1/checkout", "/store/ws1/orders/abc", "/store/ws1/pay/abc", "/checkout", "/track"])("never opens on %s", (path) => {
    vi.useFakeTimers();
    pathname = path;
    renderIn(<EmailSignupPopup />, POPUP_DELAY);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Not used up there either.
    expect(localStorage.getItem("zimos.emailSignup.popup.ws1")).toBeNull();
  });

  it("opens on exit intent with a mouse, and waits the seconds on a touch screen", () => {
    vi.useFakeTimers();
    const exit: StoreEmailSignup = { ...OFF, popup: { trigger: "exit_intent", delaySeconds: 8 } };
    const media = vi.fn((query: string) => ({ matches: query.includes("pointer: fine"), media: query, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("matchMedia", media);
    renderIn(<EmailSignupPopup />, exit);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Leaving through the top of the page.
    act(() => {
      document.dispatchEvent(new MouseEvent("mouseout", { clientY: 0, relatedTarget: null, bubbles: true }));
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    cleanup();
    localStorage.clear();
    signupLib.forgetSignupMemory();

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    );
    renderIn(<EmailSignupPopup />, exit);
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("dialog")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("still works, once, when the browser refuses storage", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    renderIn(<EmailSignupPopup />, POPUP_DELAY);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    cleanup();
    // Remembered for this page, so another view of it doesn't open it again.
    renderIn(<EmailSignupPopup />, POPUP_DELAY);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not drawn at all while the place is off", () => {
    vi.useFakeTimers();
    renderIn(<EmailSignupPopup />, { ...OFF, footer: {} });
    act(() => vi.advanceTimersByTime(600_000));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the cart's box", () => {
  it("shows only while on and while the order form asks for an email", () => {
    renderIn(<CartConsentBox />, OFF);
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();
    renderIn(<CartConsentBox />, { ...OFF, cart: { preTicked: false } }, "en", "hidden");
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();
    renderIn(<CartConsentBox />, { ...OFF, cart: { preTicked: false } });
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("starts as the merchant set it, with the privacy line under it, and remembers the shopper's choice for checkout", () => {
    renderIn(<CartConsentBox />, { ...OFF, cart: { preTicked: true } });
    const box = screen.getByRole("checkbox", { name: "Email me offers and news from Nour" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toBe("You can unsubscribe from any email, in one click.");
    // Shown ticked: what the checkout will send unless the shopper unticks it.
    expect(signupLib.cartChoice("ws1")).toBe(true);
    // Space on a focused checkbox toggles it (fired as the click a browser makes).
    box.focus();
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(signupLib.cartChoice("ws1")).toBe(false);
  });

  it("is unticked by default, in Arabic, with the merchant's own words", () => {
    renderIn(<CartConsentBox />, { ...OFF, cart: { preTicked: false }, text: { ...TEXT, ar: { label: "عايز عروضنا؟", privacy: "مش هنزعجك.", incentive: null } } }, "ar");
    const box = screen.getByRole("checkbox", { name: "عايز عروضنا؟" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText("مش هنزعجك.")).toBeTruthy();
    expect(box.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
  });
});

describe("the quick order form's box", () => {
  it("asks for an email as an option only while its box is on and the store's form has the field", () => {
    expect(signupLib.quickFormEmailMode("hidden", "optional", true)).toBe("optional");
    expect(signupLib.quickFormEmailMode("hidden", "optional", false)).toBe("hidden");
    expect(signupLib.quickFormEmailMode("hidden", "hidden", true)).toBe("hidden");
    expect(signupLib.quickFormEmailMode("required", "required", true)).toBe("required");
  });

  it("starts as the merchant set it and sends what it shows, from the quick order form", () => {
    expect(productLanding).toContain('const [marketingOptIn, setMarketingOptIn] = useState(() => signup?.quickOrder?.preTicked === true);');
    expect(productLanding).toContain('const quickBoxShown = quickBoxOn && formOf(fields).some((f) => f.key === "email");');
    expect(productLanding).toContain('...(EMAIL_CAMPAIGNS_ENABLED && quickBoxShown && marketingOptIn && values.email.trim()');
    expect(productLanding).toContain('? { marketingConsent: true, marketingConsentSource: "quick_order" as const }');
  });
});

describe("the places, read from the store", () => {
  it("are nothing while off, the checkout box alone from an older API, the store's own otherwise", () => {
    expect(signupLib.signupPlaces({ ...OFF, footer: {} }, false)).toBeNull();
    expect(signupLib.signupPlaces(null, true)).toBeNull();
    expect(signupLib.signupPlaces(undefined, true)).toEqual(expect.objectContaining({ checkout: { preTicked: false }, footer: null, popup: null, cart: null, quickOrder: null }));
    expect(signupLib.signupPlaces({ ...OFF, footer: {} }, true)?.footer).toEqual({});
  });

  it("are drawn by the layout above the footer and as a popup, on the store's pages only", () => {
    expect(layout).toContain("<FooterEmailSignup />");
    expect(layout).toContain("<EmailSignupPopup />");
    expect(layout).toContain("emailSignup: storeEmailSignupOf(store),");
  });
});
