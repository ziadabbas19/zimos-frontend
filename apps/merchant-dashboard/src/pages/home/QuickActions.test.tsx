import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type HomeShortcuts, type Workspace } from "@store-builder/api-client";
import { fake, testWorkspace, workspaceMock } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SYSTEM_ROLES, SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";
import { forgetHomeShortcuts, seedHomeShortcuts } from "@/lib/homeShortcuts";
import { endSession, resetRequestCache } from "@/lib/requestCache";
import { DEFAULT_SHORTCUT_IDS } from "./shortcutCatalog";
import { QuickActions } from "./QuickActions";

const DEFAULT_LABELS = ["New order", "Add product", "Confirm orders", "All orders", "Lost orders", "Discounts", "Edit website", "Store settings"];
const DEFAULT_PATHS = ["/orders/new", "/catalog/new", "/confirmation-queue", "/orders", "/abandoned-carts", "/discounts", "/website", "/store-settings"];

const answer = (over: Partial<HomeShortcuts> = {}): HomeShortcuts => ({
  customized: false,
  shortcuts: [...DEFAULT_SHORTCUT_IDS],
  defaults: [...DEFAULT_SHORTCUT_IDS],
  available: [...DEFAULT_SHORTCUT_IDS, "customers", "media", "reviews", "inbox"],
  max: 12,
  ...over,
});

const links = () => within(screen.getByRole("navigation", { name: "Shortcuts" })).queryAllByRole("link");
const shown = () => links().map((link) => link.textContent);
const paths = () => links().map((link) => link.getAttribute("href"));

beforeEach(() => {
  forgetHomeShortcuts();
  resetRequestCache();
});
afterEach(() => forgetHomeShortcuts());

describe("the row of a member who never arranged it", () => {
  it("is the row Home always had: words, order and paths, with the count on Confirm orders", async () => {
    seedHomeShortcuts("ws_1", answer());
    renderWithProviders(<QuickActions awaiting={5} />);
    expect(links().map((link) => link.querySelector("span.leading-tight")?.textContent)).toEqual(DEFAULT_LABELS);
    expect(paths()).toEqual(DEFAULT_PATHS);
    expect(screen.getByRole("link", { name: /Confirm orders/ })).toHaveTextContent("5");
    expect(screen.getByRole("link", { name: "New order" }).className).toContain("bg-primary");
  });

  it("no count, no badge", () => {
    seedHomeShortcuts("ws_1", answer());
    const zero = renderWithProviders(<QuickActions awaiting={0} />);
    expect(screen.getByRole("link", { name: "Confirm orders" })).toBeInTheDocument();
    zero.unmount();
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(screen.getByRole("link", { name: "Confirm orders" })).toBeInTheDocument();
  });

  it("in Arabic, the row's own Arabic words", () => {
    seedHomeShortcuts("ws_1", answer());
    renderWithProviders(<QuickActions awaiting={null} />, { locale: "ar" });
    const nav = screen.getByRole("navigation", { name: "اختصارات" });
    for (const word of ["طلب جديد", "إضافة منتج", "تأكيد الطلبات", "كل الطلبات", "الطلبات المفقودة", "الخصومات", "تعديل الموقع", "إعدادات المتجر"]) {
      expect(within(nav).getByRole("link", { name: word })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "تخصيص الاختصارات" })).toBeInTheDocument();
  });

  it("shows before any answer, and the customize button only once there is one", async () => {
    let answerNow: (body: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      answerNow = resolve;
    });
    fakeBackend({ "GET /home-shortcuts": () => pending });
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(paths()).toEqual(DEFAULT_PATHS);
    expect(screen.queryByRole("button", { name: "Customize shortcuts" })).not.toBeInTheDocument();
    answerNow({ homeShortcuts: answer() });
    expect(await screen.findByRole("button", { name: "Customize shortcuts" })).toBeInTheDocument();
    expect(paths()).toEqual(DEFAULT_PATHS);
  });

  it("with an API that doesn't have the feature: the default row, and nothing to customize", async () => {
    const calls = fakeBackend({ "GET /home-shortcuts": new ApiError("Not found", 404, "NOT_FOUND") });
    renderWithProviders(<QuickActions awaiting={null} />);
    await waitFor(() => expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(1));
    await waitFor(() => expect(paths()).toEqual(DEFAULT_PATHS));
    expect(screen.queryByRole("button", { name: "Customize shortcuts" })).not.toBeInTheDocument();
  });

  it.each(SYSTEM_ROLES)("leaves out for %s what the role cannot open", (role) => {
    const permissions = SYSTEM_ROLE_PERMISSIONS[role];
    Object.assign(workspaceMock, { currentWorkspace: fake<Workspace>({ ...testWorkspace, permissions }) });
    seedHomeShortcuts("ws_1", answer());
    renderWithProviders(<QuickActions awaiting={null} />);
    const holds = (...any: string[]) => permissions.includes("*") || any.some((p) => permissions.includes(p));
    const expected = [
      holds("orders.view") && "/orders/new",
      holds("products.view") && "/catalog/new",
      holds("orders.confirm", "orders.manage") && "/confirmation-queue",
      holds("orders.view") && "/orders",
      holds("orders.view") && "/abandoned-carts",
      holds("discounts.manage") && "/discounts",
      holds("website.edit") && "/website",
      holds("website.edit") && "/store-settings",
    ].filter(Boolean);
    expect(paths()).toEqual(expected);
  });
});

describe("no new request for Home", () => {
  it("asks for nothing when the bootstrap handed the row over, however often Home opens", () => {
    const calls = fakeBackend({});
    seedHomeShortcuts("ws_1", answer());
    const first = renderWithProviders(<QuickActions awaiting={null} />);
    first.unmount();
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(calls).toEqual([]);
  });

  it("without a bootstrap answer it asks once, and going back to Home reads what is kept", async () => {
    const calls = fakeBackend({ "GET /home-shortcuts": { homeShortcuts: answer() } });
    const first = renderWithProviders(<QuickActions awaiting={null} />);
    await screen.findByRole("button", { name: "Customize shortcuts" });
    first.unmount();
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(1);
  });

  it("a read that failed is asked again on the next visit, once, and then kept", async () => {
    let fail = true;
    const calls = fakeBackend({ "GET /home-shortcuts": () => (fail ? new Error("offline") : { homeShortcuts: answer() }) });
    const first = renderWithProviders(<QuickActions awaiting={null} />);
    await waitFor(() => expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(1));
    await waitFor(() => expect(paths()).toEqual(DEFAULT_PATHS));
    first.unmount();

    fail = false;
    const second = renderWithProviders(<QuickActions awaiting={null} />);
    expect(await screen.findByRole("button", { name: "Customize shortcuts" })).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(2);
    second.unmount();

    renderWithProviders(<QuickActions awaiting={null} />);
    expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(2);
  });

  it("a member with the reviews or inbox shortcut reads the menu's counts without asking", () => {
    const calls = fakeBackend({});
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["reviews", "inbox"] }));
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(shown()).toEqual(["Reviews", "WhatsApp inbox"]);
    expect(calls).toEqual([]);
  });
});

describe("the row as arranged", () => {
  it("follows the member's order", () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers", "new_order", "media"] }));
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(shown()).toEqual(["Customers", "New order", "Media library"]);
    expect(paths()).toEqual(["/customers", "/orders/new", "/media"]);
  });

  it("keeps the count on Confirm orders wherever it sits", () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers", "confirmation_queue"] }));
    renderWithProviders(<QuickActions awaiting={7} />);
    expect(screen.getByRole("link", { name: /Confirm orders/ })).toHaveTextContent("7");
  });

  it("takes twelve", () => {
    const shortcuts = ["new_order", "add_product", "confirmation_queue", "orders", "lost_orders", "discounts", "website", "store_settings", "customers", "media", "reviews", "inbox"];
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts }));
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(links()).toHaveLength(12);
  });

  it("an emptied row says so, and can still be customized", () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: [] }));
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(links()).toHaveLength(0);
    expect(screen.getByText(/No shortcuts here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize shortcuts" })).toBeInTheDocument();
  });

  it("hides what the role cannot open or the server left out, even if a stale answer names it", () => {
    Object.assign(workspaceMock, { currentWorkspace: fake<Workspace>({ ...testWorkspace, permissions: ["orders.view"] }) });
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers", "orders", "lost_orders"], available: ["orders", "customers"] }));
    renderWithProviders(<QuickActions awaiting={null} />);
    // customers: the role lacks it. lost_orders: the server's list lacks it.
    expect(shown()).toEqual(["All orders"]);
  });

  it("ignores an id this build does not know", () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["from_the_future", "orders"], available: ["from_the_future", "orders"] }));
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(shown()).toEqual(["All orders"]);
  });
});

describe("each member's own row, on a shared device", () => {
  it("before the answer, draws what this device last saw this member arrange, for this store only", async () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers"] }));
    const seen = renderWithProviders(<QuickActions awaiting={null} />);
    await waitFor(() => expect(localStorage.getItem("zimos.homeShortcuts.user_1.ws_1")).toBe('["customers"]'));
    seen.unmount();

    forgetHomeShortcuts();
    fakeBackend({ "GET /home-shortcuts": () => new Promise(() => undefined) });
    const again = renderWithProviders(<QuickActions awaiting={null} />);
    expect(shown()).toEqual(["Customers"]);
    again.unmount();

    // Another store, nothing remembered.
    Object.assign(workspaceMock, { currentWorkspace: fake<Workspace>({ ...testWorkspace, id: "ws_2" }) });
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(paths()).toEqual(DEFAULT_PATHS);
  });

  it("another account on this device sees nothing of it", async () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers"] }));
    const seen = renderWithProviders(<QuickActions awaiting={null} />);
    await waitFor(() => expect(localStorage.getItem("zimos.homeShortcuts.user_1.ws_1")).not.toBeNull());
    seen.unmount();

    forgetHomeShortcuts();
    fakeBackend({ "GET /home-shortcuts": () => new Promise(() => undefined) });
    renderWithProviders(<QuickActions awaiting={null} />, { auth: { user: fake({ id: "user_2" }) } });
    expect(paths()).toEqual(DEFAULT_PATHS);
  });

  it("the row kept in memory goes with the session", () => {
    seedHomeShortcuts("ws_1", answer({ customized: true, shortcuts: ["customers"] }));
    localStorage.clear();
    endSession();
    fakeBackend({ "GET /home-shortcuts": () => new Promise(() => undefined) });
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(paths()).toEqual(DEFAULT_PATHS);
  });

  it("going back to the default forgets what this device remembered", async () => {
    localStorage.setItem("zimos.homeShortcuts.user_1.ws_1", '["customers"]');
    seedHomeShortcuts("ws_1", answer());
    renderWithProviders(<QuickActions awaiting={null} />);
    await waitFor(() => expect(localStorage.getItem("zimos.homeShortcuts.user_1.ws_1")).toBeNull());
    expect(paths()).toEqual(DEFAULT_PATHS);
  });

  it("a remembered list of something else is ignored", () => {
    localStorage.setItem("zimos.homeShortcuts.user_1.ws_1", "not json");
    fakeBackend({ "GET /home-shortcuts": () => new Promise(() => undefined) });
    renderWithProviders(<QuickActions awaiting={null} />);
    expect(paths()).toEqual(DEFAULT_PATHS);
  });
});

describe("opening the editor", () => {
  it("loads it on demand and shows the row", { timeout: 30000 }, async () => {
    fakeBackend({
      "GET /home-shortcuts": { homeShortcuts: answer() },
      "GET /plan-features": { planFeatures: { features: [], enforced: false } },
    });
    seedHomeShortcuts("ws_1", answer());
    const { user } = renderWithProviders(<QuickActions awaiting={null} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Customize shortcuts" }));
    // Its first load is an import of its own.
    expect(await screen.findByRole("dialog", { name: "Customize shortcuts" }, { timeout: 15000 })).toBeInTheDocument();
  });
});
