import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError, type StorefrontPaymentMethod } from "@store-builder/api-client";
import type { GiftCardState } from "@/components/giftCards/GiftCardField";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
  LOYALTY_ENABLED: true,
  STORE_CREDIT_ENABLED: true,
}));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { CheckoutTenders, takesTenders, useCheckoutTenders, type CheckoutTendersState } from "./CheckoutTenders";

const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";
const COD = { id: "cod", method: "cod", provider: "cod" } as unknown as StorefrontPaymentMethod;
const CARD = { id: "card", method: "card", provider: "fawaterak" } as unknown as StorefrontPaymentMethod;
const TRANSFER = { id: "m1", method: "manual", provider: "manual" } as unknown as StorefrontPaymentMethod;
const NO_CARD = { off: 0 } as unknown as GiftCardState;
const PROGRAM = { earnPointsPerUnit: 1, pointValue: 10, minRedeemPoints: 100, maxRedeemPercent: 50, expiryDays: null, currency: "EGP" };

// The store's setting and its programme are remembered per store for the page's life: a store per test.
let n = 0;
function aStore(signedIn: boolean) {
  n += 1;
  const id = `tender${n}`;
  if (signedIn) window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
  return { id, store: { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo };
}

/** The store's answers: accounts on, a points programme, 2000 points (worth 200) and 150 of credit. */
function answers({ points = 2000, credit = "15000", spending = true }: { points?: number; credit?: string; spending?: boolean } = {}) {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith("/account/config")) return { enabled: true, channels: ["sms"] };
    if (path.endsWith("/account/loyalty")) return { balance: points, worth: String(points * 10), currency: "EGP", expiresAt: null, history: [], program: PROGRAM };
    if (path.endsWith("/account/store-credit")) return { balance: credit, currency: "EGP", history: [], spendingEnabled: spending };
    if (path.endsWith("/loyalty")) return { program: PROGRAM };
    throw new Error(`unexpected ${path}`);
  });
}

let latest: CheckoutTendersState;
function Checkout({ method, total }: { method: StorefrontPaymentMethod | undefined; total: number }) {
  const state = useCheckoutTenders({ method, total, currency: "EGP", giftCard: NO_CARD });
  latest = state;
  return <CheckoutTenders state={state} />;
}
/** `method` null: no way to pay is handed in. */
function show(store: StoreInfo, method: StorefrontPaymentMethod | null = COD, total = 50000) {
  return render(
    <StoreContextProvider locale="en" store={store}>
      <Checkout method={method ?? undefined} total={total} />
    </StoreContextProvider>
  );
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe("points and store credit at checkout", () => {
  it("go with cash on delivery only", () => {
    expect(takesTenders(COD)).toBe(true);
    expect(takesTenders(CARD)).toBe(false);
    expect(takesTenders(TRANSFER)).toBe(false);
    expect(takesTenders(undefined)).toBe(false);
  });

  it("take the store credit first, then the points up to the store's share, and leave the rest for the courier", async () => {
    const { store, id } = aStore(true);
    answers();
    show(store);
    const signed = { auth: false, headers: { "X-Shopper-Token": TOKEN } };

    fireEvent.click(await screen.findByRole("checkbox", { name: /Use your store credit/ }));
    await waitFor(() => expect(latest.creditOff).toBe(15000));
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/store-credit`, signed);
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/loyalty`, signed);

    // Ticking the points offers them all; half the order is the most they may pay.
    fireEvent.click(screen.getByRole("checkbox", { name: /Use your points/ }));
    await waitFor(() => expect(latest.pointsOff).toBe(20000));
    expect(latest.rest).toBe(50000 - 15000 - 20000);
    expect(latest.payload).toEqual({ loyaltyPoints: 2000, useStoreCredit: true });
    expect(latest.shopperToken).toBe(TOKEN);
    expect(screen.getByText("Pay on delivery")).toBeTruthy();
  });

  it("refuse points under the store's minimum before the order is sent", async () => {
    const { store } = aStore(true);
    answers();
    show(store);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Use your points/ }));
    fireEvent.change(screen.getByLabelText("Points to use"), { target: { value: "50" } });
    expect(latest.check()).toBe("Use at least 100 points.");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(latest.payload).toEqual({});
  });

  it("take nothing and send nothing with an online payment, and say why", async () => {
    const { store } = aStore(true);
    answers();
    show(store, CARD);
    const credit = (await screen.findByRole("checkbox", { name: /Use your store credit/ })) as HTMLInputElement;
    expect(credit.disabled).toBe(true);
    expect(screen.getByText("Points and store credit work with cash on delivery only. Choose cash on delivery to use them.")).toBeTruthy();
    expect(latest.payload).toEqual({});
    expect(latest.anyOff).toBe(false);
  });

  it("offer a signed-out shopper the sign-in, and read no balance", async () => {
    const { store } = aStore(false);
    answers();
    show(store);
    const link = await screen.findByRole("link", { name: "Sign in to use your points" });
    expect(link.getAttribute("href")).toBe("/account?next=/checkout");
    expect(latest.shopperToken).toBeNull();
    expect(request.mock.calls.some(([path]) => /account\/(loyalty|store-credit)$/.test(String(path)))).toBe(false);
  });

  it("take the points off after the API says there are fewer, and read the balance again", async () => {
    const { store, id } = aStore(true);
    answers();
    show(store);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Use your points/ }));
    await waitFor(() => expect(latest.pointsOn).toBe(true));
    const before = request.mock.calls.filter(([path]) => String(path).endsWith("/account/loyalty")).length;

    const refusal = new ApiError("You have 300 points", 422, "LOYALTY_NOT_ENOUGH", { error: { details: [{ field: "loyaltyPoints", message: "You have 300 points" }] } });
    let text: string | null = null;
    await waitFor(() => {
      text = latest.onError(refusal);
      expect(text).toContain("You have fewer points than that.");
    });
    await waitFor(() => expect(latest.pointsOn).toBe(false));
    await waitFor(() => expect(request.mock.calls.filter(([path]) => String(path) === `/store/${id}/account/loyalty`).length).toBeGreaterThan(before));
    // A refusal that is not about points or credit is left to the form.
    expect(latest.onError(new ApiError("Nope", 422, "VALIDATION_ERROR"))).toBeNull();
  });

  it("take no more points than the store's cap for one order, and say so", async () => {
    const { store } = aStore(true);
    const capped = { ...PROGRAM, maxRedeemPointsPerOrder: 500 };
    request.mockImplementation(async (path: string) => {
      if (path.endsWith("/account/config")) return { enabled: true, channels: ["sms"] };
      if (path.endsWith("/account/loyalty")) return { balance: 2000, worth: "20000", currency: "EGP", expiresAt: null, history: [], program: capped };
      if (path.endsWith("/account/store-credit")) return { balance: "0", currency: "EGP", history: [], spendingEnabled: false };
      if (path.endsWith("/loyalty")) return { program: capped };
      throw new Error(`unexpected ${path}`);
    });
    show(store);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Use your points/ }));
    // Half the order would allow 2000 points; the cap leaves 500 (worth 5000).
    await waitFor(() => expect(latest.pointsOff).toBe(5000));
    expect(latest.rest).toBe(45000);
    expect(screen.getByText(/One order takes up to 500 points\./)).toBeTruthy();
  });

  it("say why the API refused the points: frozen, not on this order, or another account on this device", async () => {
    const { store } = aStore(true);
    answers();
    show(store);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Use your points/ }));
    await waitFor(() => expect(latest.pointsOn).toBe(true));
    const refusal = (code: string) => new ApiError("Refused", 422, code, { error: { details: [{ field: "loyaltyPoints", message: "Refused" }] } });
    await waitFor(() => expect(latest.onError(refusal("LOYALTY_FROZEN"))).toContain("This store no longer takes points."));
    await waitFor(() => expect(latest.onError(refusal("LOYALTY_UNAVAILABLE"))).toContain("Points can't be used on this order."));
    await waitFor(() => expect(latest.onError(refusal("LOYALTY_DEVICE_LIMIT"))).toContain("Another account's points were used on this device today."));
    await waitFor(() => expect(latest.pointsOn).toBe(false));
  });

  it("are inert with no way to pay handed in (the features switched off, or a bank transfer chosen)", async () => {
    const { store } = aStore(true);
    answers();
    show(store, null);
    await waitFor(() => expect(latest.canUseCredit).toBe(true));
    expect(latest.usable).toBe(false);
    expect(latest.payload).toEqual({});
    expect(latest.rest).toBe(50000);
  });
});
