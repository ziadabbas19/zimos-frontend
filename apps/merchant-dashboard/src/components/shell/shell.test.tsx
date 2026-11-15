import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { NAV_GROUPS, NAV_LABELS, isNavItemVisible } from "@/lib/navigation";
import { api, authMock, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SYSTEM_ROLE_PERMISSIONS } from "@/test/systemRoles";

const GROUPS_KEY = "zimos.nav.groups.collapsed.v2";

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

/** What lib/navigation.ts says this role sees, in its order, the last group at the foot. */
function expectedRows(role: string): string[] {
  const groups = [...NAV_GROUPS.filter((group) => group.id !== "config"), ...NAV_GROUPS.filter((group) => group.id === "config")];
  return groups.flatMap((group) => group.items.filter((item) => isNavItemVisible(item, SYSTEM_ROLE_PERMISSIONS[role])).map((item) => NAV_LABELS.en[item.key]));
}

describe("the side menu", () => {
  it("lists every entry of our navigation, in its order, for the owner", () => {
    store("owner");
    localStorage.setItem(GROUPS_KEY, "{}");
    renderWithProviders(<DashboardLayout />, { route: "/" });
    expect(rowNames(sideMenu())).toEqual(expectedRows("owner"));
    expect(rowNames(sideMenu())).toContain("My Plan");
    expect(rowNames(sideMenu())).toContain("Analytics");
  });

  it("leaves out what a role cannot open", () => {
    store("order_operator");
    localStorage.setItem(GROUPS_KEY, "{}");
    renderWithProviders(<DashboardLayout />, { route: "/" });
    const rows = rowNames(sideMenu());
    expect(rows).toEqual(expectedRows("order_operator"));
    expect(rows).not.toContain("My Plan");
    expect(rows).not.toContain("Analytics");
    expect(rows).not.toContain("Profit");
  });

  it("shows no entry of a feature whose switch is off", () => {
    store("owner");
    localStorage.setItem(GROUPS_KEY, "{}");
    renderWithProviders(<DashboardLayout />, { route: "/" });
    const rows = rowNames(sideMenu());
    for (const name of ["Gift cards", "Blog", "Questions", "Size charts", "Loyalty & rewards", "AI studio"]) expect(rows).not.toContain(name);
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

  it("keeps a group folded as it was left, and still shows the page you are on inside it", async () => {
    store("owner");
    const { user } = renderWithProviders(<DashboardLayout />, { route: "/marketing" });
    // Marketing starts folded: only the row of the open page is there.
    expect(rowNames(sideMenu())).toContain("Marketing");
    expect(rowNames(sideMenu())).not.toContain("Offers");

    await user.click(within(sideMenu()).getByRole("button", { name: "Expand Marketing" }));
    expect(rowNames(sideMenu())).toContain("Offers");
    expect(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}")).toMatchObject({ marketing: false });

    await user.click(within(sideMenu()).getByRole("button", { name: "Collapse Marketing" }));
    expect(rowNames(sideMenu())).not.toContain("Offers");
  });

  it("counts the work waiting on its rows, and says it in words", async () => {
    store("owner");
    waiting({ toConfirm: 4, toShip: 2, unread: 0 });
    renderWithProviders(<DashboardLayout />, { route: "/" });
    const orders = within(sideMenu()).getByRole("link", { name: /^Orders/ });
    await waitFor(() => expect(orders).toHaveTextContent("2"));
    // The digits are for the eye; a screen reader hears the count in words.
    expect(orders).toHaveAccessibleName(/^Orders\s*, 2 ready to ship$/);
    expect(within(sideMenu()).getByRole("link", { name: /Confirmation queue/ })).toHaveTextContent("4");
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
