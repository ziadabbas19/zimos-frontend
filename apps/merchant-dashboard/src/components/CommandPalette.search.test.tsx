import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { CommandPalette } from "@/components/CommandPalette";
import { api, fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";

function store(role = "owner") {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role });
  workspaceMock.workspaces = [workspaceMock.currentWorkspace];
}

/** The server's answers: the plan of the store, and the records search (both optional; anything else never answers). */
function server({ plan, records }: { plan?: { features: string[]; enforced: boolean }; records?: unknown } = {}) {
  api.request.mockImplementation(((path: string) => {
    if (plan && path === "/workspaces/ws_1/plan-features") return Promise.resolve({ planFeatures: plan });
    if (records && path.startsWith("/workspaces/ws_1/search?")) return Promise.resolve(records);
    return new Promise(() => undefined);
  }) as never);
}

function renderPalette(locale: "en" | "ar" = "en", route = "/") {
  const view = renderWithProviders(<CommandPalette />, { route, locale });
  const open = async () => view.user.click(screen.getByRole("button", { name: locale === "ar" ? "بحث" : "Search" }));
  const type = async (text: string) => {
    await view.user.clear(screen.getByRole("combobox"));
    await view.user.type(screen.getByRole("combobox"), text);
    return screen.getByRole("listbox");
  };
  return { ...view, open, type };
}

describe("Spotlight finds every place in the dashboard", () => {
  it("opens the section of a single setting", async () => {
    store();
    const { open, type, user } = renderPalette();
    await open();
    const list = await type("favicon");
    const option = within(list).getByRole("option", { name: /Tab icon \(favicon\)/ });
    // Where it is, under its name.
    expect(option).toHaveTextContent("Store settings › General");
    await user.click(option);
    expect(currentPath()).toBe("/store-settings/general");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with Enter the closest match, on the tab of the section", async () => {
    store();
    const { open, type, user } = renderPalette();
    await open();
    const list = await type("whatsapp token");
    expect(within(list).getAllByRole("option")[0]).toHaveAccessibleName(/WhatsApp access token/);
    await user.keyboard("{Enter}");
    expect(currentPath()).toBe("/settings?tab=whatsapp");
  });

  it("groups the places under their side-menu heading", async () => {
    store();
    const { open, type } = renderPalette();
    await open();
    const list = await type("whatsapp");
    const headings = Array.from(list.querySelectorAll("p")).map((heading) => heading.textContent);
    expect(headings).toEqual(expect.arrayContaining(["Customers", "Settings", "Online store"]));
    // Each heading once: a group is together.
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("finds Arabic typed without its marks and hamzas, and English on an Arabic screen", async () => {
    store();
    const { open, type } = renderPalette("ar");
    await open();
    let list = await type("اعدادات المتجر");
    expect(within(list).getAllByRole("option")[0]).toHaveAccessibleName(/إعدادات المتجر/);
    list = await type("الإِعْدَادَات");
    expect(within(list).getByRole("option", { name: /^الإعدادات/ })).toBeInTheDocument();
    list = await type("favicon");
    expect(within(list).getByRole("option", { name: /أيقونة التبويب \(favicon\)/ })).toHaveTextContent("إعدادات المتجر › عام");
  });

  it("forgives a slip of the finger", async () => {
    store();
    const { open, type } = renderPalette();
    await open();
    const list = await type("pasword");
    expect(within(list).getByRole("option", { name: /^Password/ })).toBeInTheDocument();
  });

  it("opens with Ctrl+K on an Arabic keyboard layout too", () => {
    store();
    renderPalette("ar");
    fireEvent.keyDown(window, { key: "ن", code: "KeyK", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("walks the results with the arrows and closes with Escape", async () => {
    store();
    const { open, type, user } = renderPalette();
    await open();
    const list = await type("settings");
    expect(within(list).getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(within(list).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(within(list).getAllByRole("option").at(-1)).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("what a role and a plan allow", () => {
  it("offers nothing the role cannot open", async () => {
    store("editor");
    const { open, type } = renderPalette();
    await open();
    expect(within(await type("delivery report")).queryByRole("option", { name: /Delivery report/ })).not.toBeInTheDocument();
    expect(within(await type("invoices")).queryByRole("option", { name: /^Invoices/ })).not.toBeInTheDocument();
  });

  it("offers it to a role that can", async () => {
    store("owner");
    const { open, type } = renderPalette();
    await open();
    expect(within(await type("delivery report")).getByRole("option", { name: /Delivery report/ })).toBeInTheDocument();
    expect(within(await type("invoices")).getByRole("option", { name: /^Invoices/ })).toBeInTheDocument();
  });

  it("marks what the plan holds back and leads to the plans", async () => {
    store("owner");
    server({ plan: { features: ["custom_domain"], enforced: true } });
    const { open, type, user } = renderPalette();
    await open();
    const list = await type("invite");
    const option = await within(list).findByRole("option", { name: /Invite a team member.*Not in your plan/ });
    await user.click(option);
    expect(currentPath()).toBe("/subscription?tab=plans");
  });

  it("marks nothing while the plan does not refuse", async () => {
    store("owner");
    server({ plan: { features: [], enforced: false } });
    const { open, type } = renderPalette();
    await open();
    const list = await type("invite");
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/workspaces/ws_1/plan-features"));
    expect(within(list).getByRole("option", { name: /Invite a team member/ })).not.toHaveTextContent("Not in your plan");
  });
});

describe("the records search, as it was", () => {
  it("lists orders from the server under Orders and opens one", async () => {
    store();
    server({
      records: {
        orders: [{ id: "ord_1", orderNumber: "ZM-1001", customerName: "Mona Adel", totalAmount: 25000, currency: "EGP" }],
        products: [],
        customers: [],
        funnels: [],
      },
    });
    const { open, type, user } = renderPalette();
    await open();
    const list = await type("1001");
    const order = await within(list).findByRole("option", { name: /ZM-1001/ });
    expect(order).toHaveTextContent("Mona Adel");
    expect(within(list).getByText("Orders")).toBeInTheDocument();
    await user.click(order);
    expect(currentPath()).toBe("/orders/ord_1");
    // What found a record (a number, a phone, a name) is not kept among the recent searches.
    await open();
    expect(within(screen.getByRole("listbox")).queryByText("Recent searches")).not.toBeInTheDocument();
  });
});

describe("before anything is typed", () => {
  it("offers the last searches and the places opened before", async () => {
    store();
    const { open, type, user } = renderPalette("en", "/orders");
    await open();
    await user.click(within(await type("favicon")).getByRole("option", { name: /Tab icon/ }));
    expect(currentPath()).toBe("/store-settings/general");

    await open();
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Recent searches")).toBeInTheDocument();
    expect(within(list).getByText("Recently opened")).toBeInTheDocument();
    // The page that was open before; not the one open now.
    expect(within(list).getByRole("option", { name: /^Orders/ })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /^General/ })).not.toBeInTheDocument();
    // A recent search is searched again.
    await user.click(within(list).getByRole("option", { name: "favicon" }));
    expect(screen.getByRole("combobox")).toHaveValue("favicon");
  });

  it("is a launcher the first time: actions, then the first pages", async () => {
    store();
    const { open } = renderPalette();
    await open();
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Actions")).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /New product/ })).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /^Orders/ })).toBeInTheDocument();
  });
});
