import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import type { WebsitePage } from "@store-builder/api-client";
import { PageTabs, type PageManagement } from "./PageTabs";

const page = (id: string, path: string, over: Partial<WebsitePage> = {}) => ({ id, path, title: id, pageType: "custom", ...over }) as WebsitePage;
const pages = [page("Zebra", "/zebra"), page("Home", "/", { pageType: "home" }), page("About", "/about", { menuOrder: 1, showInHeader: true }), page("Faq", "/faq", { menuOrder: 0 })];

function setup() {
  const manage: PageManagement = { onEdit: vi.fn(), onDuplicate: vi.fn(), onToggleMenu: vi.fn(), onReorder: vi.fn() };
  const onDelete = vi.fn();
  render(<PageTabs variant="list" pages={pages} selectedId="Home" onSelect={vi.fn()} onDelete={onDelete} onAdd={vi.fn()} manage={manage} />, { wrapper: LocaleProvider });
  return { manage, onDelete, user: userEvent.setup() };
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("button", { name: `Actions for “${name}”` }));
  return screen.findByRole("menu");
};

describe("managing the pages", () => {
  it("lists home first, then the merchant's order", () => {
    setup();
    const rows = within(screen.getByRole("list", { name: "Pages" })).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent?.match(/^(Home|About|Faq|Zebra)/)?.[0])).toEqual(["Home", "Faq", "About", "Zebra"]);
  });

  it("never lets home be dragged or deleted", async () => {
    const { user } = setup();
    expect(screen.queryByRole("button", { name: "Drag to reorder: Home" })).toBeNull();
    const menu = await openMenu(user, "Home");
    expect(within(menu).queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("switches a page in and out of the header menu", async () => {
    const { manage, user } = setup();
    const menu = await openMenu(user, "About");
    await user.click(within(menu).getByRole("menuitem", { name: "Remove from the header menu" }));
    expect(manage.onToggleMenu).toHaveBeenCalledWith(pages[2], "showInHeader");
  });

  it("moves a page up from its menu, for those who do not drag", async () => {
    const { manage, user } = setup();
    const menu = await openMenu(user, "About");
    await user.click(within(menu).getByRole("menuitem", { name: "Move up" }));
    expect(manage.onReorder).toHaveBeenCalledWith(["About", "Faq", "Zebra"]);
  });

  it("opens details, duplicates and asks to delete", async () => {
    const { manage, onDelete, user } = setup();
    await user.click(within(await openMenu(user, "Faq")).getByRole("menuitem", { name: "Name, address and Google" }));
    expect(manage.onEdit).toHaveBeenCalledWith(pages[3]);
    await user.click(within(await openMenu(user, "Faq")).getByRole("menuitem", { name: "Duplicate" }));
    expect(manage.onDuplicate).toHaveBeenCalledWith(pages[3]);
    await user.click(within(await openMenu(user, "Faq")).getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(pages[3]);
  });
});
