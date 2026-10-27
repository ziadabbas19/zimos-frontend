import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
  LOYALTY_ENABLED: true,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/account/points", useRouter: () => ({ push: vi.fn() }) }));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { AccountShell } from "./AccountShell";
import { AccountPoints } from "./AccountWallet";

const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";
const PROGRAM = { earnPointsPerUnit: 1, pointValue: 10, minRedeemPoints: 100, maxRedeemPercent: 50, maxRedeemPointsPerOrder: 300, expiryDays: null, currency: "EGP" };
const ME = { customer: { id: "c1", fullName: "Mona", phone: "201012345003", email: null }, addresses: [] };

let n = 0;
function show(loyalty: object, locale: "en" | "ar" = "en") {
  n += 1;
  const id = `points${n}`;
  window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
  request.mockImplementation(async (path: string) => {
    if (path.endsWith("/account/config")) return { enabled: true, channels: ["sms"] };
    if (path.endsWith("/account/me")) return ME;
    if (path.endsWith("/account/loyalty")) return loyalty;
    return { enabled: false };
  });
  const store = { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
  return render(
    <StoreContextProvider locale={locale} store={store}>
      <AccountShell>
        <AccountPoints />
      </AccountShell>
    </StoreContextProvider>
  );
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe("«نقطي»", () => {
  it("says frozen points wait in the account, with the balance still shown", async () => {
    show({ balance: 450, worth: "4500", currency: "EGP", expiresAt: null, frozen: true, history: [], program: null });
    expect(await screen.findByText(/Your points are paused for now/)).toBeTruthy();
    expect(screen.getByText("450 points")).toBeTruthy();
    expect(screen.queryByText(/This store isn't giving points right now/)).toBeNull();
  });

  it("says the store's cap per order beside its other rules", async () => {
    show({ balance: 450, worth: "4500", currency: "EGP", expiresAt: null, frozen: false, history: [], program: PROGRAM });
    expect(await screen.findByText("One order takes up to 300 points.")).toBeTruthy();
  });

  it("reads the frozen note in Egyptian Arabic", async () => {
    show({ balance: 450, worth: "4500", currency: "EGP", expiresAt: null, frozen: true, history: [], program: null }, "ar");
    expect(await screen.findByText(/نقطك متوقفة مؤقتًا/)).toBeTruthy();
  });
});
