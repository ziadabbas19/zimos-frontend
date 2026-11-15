import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NAV_GROUPS, NAV_GROUP_LABELS, NAV_LABELS, isNavItemVisible } from "@/lib/navigation";
import { api, authMock, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";

function store(role: string) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role, permissions: SYSTEM_ROLE_PERMISSIONS[role] });
  workspaceMock.workspaces = [workspaceMock.currentWorkspace];
}

/** The work waiting in the store: calls due, orders to ship, unread messages. */
function waiting(counts: { toConfirm: number; toShip: number; unread: number }) {
  api.getConfirmationQueueCounts.mockResolvedValue(fake({ pendingDue: counts.toConfirm }));
  api.getOrderPipeline.mockResolvedValue(fake({ stages: { ready_to_ship: counts.toShip } }));
  // Only the inbox's own request is answered; anything else the shell asks stays pending, as by default.
  api.request.mockImplementation(((path: string) =>
    String(path).includes("/inbox/")
      ? Promise.resolve({ conversations: [], nextCursor: null, counts: { unread: counts.unread } })
      : new Promise<never>(() => undefined)) as never);
}

// The counts are one poll shared by the whole shell (lib/workCounts.ts): every test answers it,
// so a request left hanging by one test is not what the next one waits behind.
beforeEach(() => waiting({ toConfirm: 0, toShip: 0, unread: 0 }));

function sideMenu() {
  return screen.getByRole("navigation", { name: "Main navigation" });
}

function rowNames(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole("link")
    .map((row) => row.querySelector("span.min-w-0")?.textContent ?? "");
}

/** The page rows of the side menu, in order: the open place's pages, then the foot group. */
function pageNames(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll<HTMLElement>('a[data-slot="menu-row"]')).map((row) => row.querySelector("span.min-w-0")?.textContent ?? "");
}

const visibleIn = (role: string, groupId: string) =>
  NAV_GROUPS.find((group) => group.id === groupId)!.items.filter((item) => !item.under && isNavItemVisible(item, SYSTEM_ROLE_PERMISSIONS[role]));

/** The dock's short names, where a heading is too long to sit under a tile. */
const DOCK_SHORT: Record<string, string> = { store: "Store", money: "Money" };

/** The places lib/navigation.ts gives this role, in its order, as the dock writes them under its tiles. */
const dockNames = (role: string) =>
  NAV_GROUPS.filter((group) => group.id !== "config" && visibleIn(role, group.id).length > 0).map(
    (group) => DOCK_SHORT[group.id] ?? (group.labelKey ? NAV_GROUP_LABELS.en[group.labelKey] : NAV_LABELS.en.overview)
  );

const footRows = (role: string) => visibleIn(role, "config").map((item) => NAV_LABELS.en[item.key]);

describe("the side menu", () => {
  it("shows only the place chosen in the dock: its tile and name, its pages under them, then the foot group", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/orders/ord_1" });
    expect(within(sideMenu()).getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(sideMenu().querySelector('[data-place-open="orders"] [data-place-tile="orders"]')).not.toBeNull();
    expect(pageNames(sideMenu())).toEqual([...visibleIn("owner", "orders").map((item) => NAV_LABELS.en[item.key]), ...footRows("owner")]);
    // No other place is listed in the side menu: they are the dock's.
    expect(rowNames(sideMenu())).not.toContain("Offers");
    expect(rowNames(sideMenu())).not.toContain("Analytics");
    expect(pageNames(sideMenu())).toContain("My Plan");
  });

  it("shows Home with the member's Home shortcuts under it, and Home's on a page of the foot group", () => {
    store("owner");
    const { unmount } = renderWithProviders(<DashboardLayout />, { route: "/" });
    expect(within(sideMenu()).getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(within(sideMenu()).getByRole("link", { name: /^Home/ })).toHaveAttribute("aria-current", "page");
    expect(within(sideMenu()).getByRole("link", { name: /^All orders/ })).toHaveAttribute("href", "/orders");
    unmount();

    renderWithProviders(<DashboardLayout />, { route: "/settings" });
    expect(within(sideMenu()).getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(within(sideMenu()).getByRole("link", { name: /^Settings/ })).toHaveAttribute("aria-current", "page");
  });

  it("leaves out what a role cannot open", () => {
    store("order_operator");
    renderWithProviders(<DashboardLayout />, { route: "/orders" });
    expect(pageNames(sideMenu())).toEqual([...visibleIn("order_operator", "orders").map((item) => NAV_LABELS.en[item.key]), ...footRows("order_operator")]);
    const rows = rowNames(sideMenu());
    expect(rows).not.toContain("My Plan");
    expect(rows).not.toContain("Profit");
    const dock = screen.getByRole("navigation", { name: "Places" });
    expect(within(dock).getAllByRole("link").map((tile) => tile.querySelector("[data-dock-label]")?.textContent)).toEqual(dockNames("order_operator"));
  });

  it("shows no entry of a feature whose switch is off", () => {
    store("owner");
    for (const route of ["/catalog", "/marketing", "/website", "/customers"]) {
      const { unmount } = renderWithProviders(<DashboardLayout />, { route });
      const rows = rowNames(sideMenu());
      for (const name of ["Gift cards", "Blog", "Questions", "Size charts", "Loyalty & rewards", "AI studio"]) expect(rows).not.toContain(name);
      unmount();
    }
  });

  it("lights one row: the page you are on, also from a page deeper in it", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/orders/ord_1" });
    const current = within(sideMenu())
      .getAllByRole("link")
      .filter((row) => row.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Orders");
    expect(current[0]).toHaveAttribute("href", "/orders");
  });

  it("counts the work waiting on its rows, and says it in words", async () => {
    store("owner");
    waiting({ toConfirm: 4, toShip: 2, unread: 0 });
    renderWithProviders(<DashboardLayout />, { route: "/orders" });
    // The digits are for the eye; a screen reader hears the count in words.
    const orders = sideMenu().querySelector<HTMLElement>('a[data-slot="menu-row"][href="/orders"]')!;
    await waitFor(() => expect(orders).toHaveTextContent("2"));
    expect(orders).toHaveAccessibleName(/^Orders\s*, 2 ready to ship$/);
    expect(within(sideMenu()).getByRole("link", { name: /Confirmation queue/ })).toHaveTextContent("4");
  });

  it("has the dock of places over the page from md up, the current one marked, the others with their waiting work", async () => {
    store("owner");
    waiting({ toConfirm: 4, toShip: 2, unread: 0 });
    renderWithProviders(<DashboardLayout />, { route: "/marketing/email-campaigns" });
    const dock = screen.getByRole("navigation", { name: "Places" });
    const tiles = within(dock).getAllByRole("link");
    expect(tiles.map((tile) => tile.querySelector("[data-dock-label]")?.textContent)).toEqual(dockNames("owner"));
    expect(within(dock).getByRole("link", { name: "Marketing" })).toHaveAttribute("aria-current", "page");
    const orders = within(dock).getByRole("link", { name: "Orders" });
    expect(orders).toHaveAttribute("href", "/orders");
    // The calls due come before the orders to ship.
    await waitFor(() => expect(orders).toHaveTextContent("4"));
  });

  it("carries our logo and the store's name", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/" });
    const aside = sideMenu().closest("aside")!;
    expect(aside.querySelector(".zimos-logo")).not.toBeNull();
    expect(within(aside).getByRole("button", { name: "Switch store" })).toHaveTextContent("Nile Store");
  });
});

describe("the toolbar", () => {
  it("has search, the store's link with copy, the language, light or dark, alerts and the account", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/orders" });
    const toolbar = screen.getByRole("banner", { name: "Toolbar" });
    expect(within(toolbar).getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("link", { name: /nile/ })).toHaveAttribute("target", "_blank");
    expect(within(toolbar).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /Arabic|العربية|عربي/ })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /dark|light/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /notification/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    // Where you are: the group, then the page.
    expect(within(toolbar).getByRole("navigation", { name: "You are here" })).toHaveTextContent("Orders");
  });

  it("asks before signing out from the account menu", async () => {
    store("owner");
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/" });
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("alertdialog", { name: "Sign out?" })).toBeInTheDocument();
    expect(authMock.logout).not.toHaveBeenCalled();
  });

  it("hides and shows the side menu, and remembers it", async () => {
    store("owner");
    const { user, container } = renderWithProviders(<DashboardLayout />, { route: "/" });
    const frame = container.querySelector(".glass-app")!;
    expect(frame).not.toHaveAttribute("data-focus");

    await user.click(screen.getByRole("button", { name: "Hide the side menu" }));
    expect(frame).toHaveAttribute("data-focus", "on");
    expect(localStorage.getItem("zimos.focus")).toBe("on");

    await user.click(screen.getByRole("button", { name: "Show the side menu" }));
    expect(frame).not.toHaveAttribute("data-focus");
  });
});

describe("the phone dock and menu", () => {
  function dock() {
    return screen.getByRole("navigation", { name: "Quick navigation" });
  }
  function slots(): string[] {
    return [...dock().querySelectorAll('[data-slot="dock-item"]')].map((slot) => slot.querySelector(".zimos-dock-label")?.textContent ?? "");
  }

  it("has the four everyday pages and More, each at our navigation's address", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/orders" });
    expect(slots()).toEqual(["Today", "Orders", "Confirm", "Products", "More"]);
    expect(within(dock()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/", "/orders", "/confirmation-queue", "/catalog"]);
    expect(within(dock()).getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
  });

  it("gives a role only the slots it has a use for", () => {
    store("editor");
    renderWithProviders(<DashboardLayout />, { route: "/" });
    expect(slots()).toEqual(["Today", "Products", "More"]);
  });

  it("shows the calls waiting on the Confirm slot", async () => {
    store("owner");
    waiting({ toConfirm: 3, toShip: 0, unread: 0 });
    renderWithProviders(<DashboardLayout />, { route: "/" });
    await waitFor(() => expect(within(dock()).getByRole("link", { name: /Confirm/ })).toHaveTextContent("3 waiting for a call"));
  });

  it("opens the whole menu from More, without the dock's own pages, and closes on Escape", async () => {
    store("owner");
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();

    await user.click(within(dock()).getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    const tiles = rowNames(within(sheet).getByRole("navigation", { name: "Main navigation" }));
    const expected = NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => !["/", "/orders", "/confirmation-queue", "/catalog"].includes(item.to))
      .map((item) => NAV_LABELS.en[item.key]);
    expect(tiles).toEqual(expected);
    // The store, its link, the language and light or dark are in the sheet too.
    expect(within(sheet).getByRole("button", { name: "Switch store" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /dark|light/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("names the slots in formal Arabic", () => {
    store("owner");
    renderWithProviders(<DashboardLayout />, { route: "/", locale: "ar" });
    const names = [...screen.getByRole("navigation", { name: "التنقل السريع" }).querySelectorAll(".zimos-dock-label")].map((label) => label.textContent);
    expect(names).toEqual(["اليوم", "الطلبات", "التأكيد", "المنتجات", "المزيد"]);
  });
});
