import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type HomeShortcuts } from "@store-builder/api-client";
import { callsTo, fakeBackend, type FakeCall } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { forgetHomeShortcuts, seedHomeShortcuts, useHomeShortcuts } from "@/lib/homeShortcuts";
import { resetRequestCache } from "@/lib/requestCache";
import { DEFAULT_SHORTCUT_IDS, SHORTCUT_CATALOG } from "./shortcutCatalog";
import { CustomizeShortcutsDialog } from "./CustomizeShortcutsDialog";

const ALL_IDS = SHORTCUT_CATALOG.map((entry) => entry.id as string);

const answer = (over: Partial<HomeShortcuts> = {}): HomeShortcuts => ({
  customized: false,
  shortcuts: [...DEFAULT_SHORTCUT_IDS],
  defaults: [...DEFAULT_SHORTCUT_IDS],
  available: [...ALL_IDS],
  max: 12,
  ...over,
});

/** The editor as QuickActions mounts it, its answer live from the store. */
function Harness({ onClose, permissions }: { onClose: () => void; permissions?: readonly string[] }) {
  const { answer: current } = useHomeShortcuts("ws_1", "user_1");
  const [open, setOpen] = useState(true);
  if (!current) return null;
  return (
    <CustomizeShortcutsDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      workspaceId="ws_1"
      answer={current}
      permissions={permissions}
    />
  );
}

function setup(start: HomeShortcuts = answer(), { locale, permissions, planFeatures, put, del }: { locale?: "en" | "ar"; permissions?: readonly string[]; planFeatures?: unknown; put?: unknown; del?: unknown } = {}) {
  const calls = fakeBackend({
    "GET /home-shortcuts": () => ({ homeShortcuts: start }),
    "GET /plan-features": { planFeatures: planFeatures ?? { features: [], enforced: false } },
    "PUT /home-shortcuts": put ?? ((call: FakeCall) => ({ homeShortcuts: answer({ customized: true, shortcuts: (call.body as { shortcuts: string[] }).shortcuts }) })),
    "DELETE /home-shortcuts": del ?? { homeShortcuts: answer() },
  });
  seedHomeShortcuts("ws_1", start);
  const onClose = vi.fn();
  const view = renderWithProviders(<Harness onClose={onClose} permissions={permissions} />, { locale });
  return { calls, onClose, ...view };
}

const currentSection = () => screen.getByRole("region", { name: "Your shortcuts" });
const addSection = () => screen.getByRole("region", { name: "Add a shortcut" });
const rowTitles = () =>
  within(currentSection())
    .queryAllByRole("listitem")
    .map((row) => row.querySelector("span")?.textContent);
/** The catalogue's row for a page, or null: a section's filter button can have the same name. */
const offered = (name: string) => within(addSection()).queryAllByRole("button", { name }).find((button) => button.closest("li")) ?? null;
function offeredRow(name: string) {
  const row = offered(name);
  if (!row) throw new Error(`no catalogue row named ${name}`);
  return row;
}
const puts = (calls: FakeCall[]) => callsTo(calls, "PUT", "/home-shortcuts");
const deletes = (calls: FakeCall[]) => callsTo(calls, "DELETE", "/home-shortcuts");

beforeEach(() => {
  forgetHomeShortcuts();
  resetRequestCache();
});

describe("showing the row", () => {
  it("lists the shortcuts in order, and everything the member may add by section", async () => {
    setup();
    expect(await screen.findByRole("dialog", { name: "Customize shortcuts" })).toBeInTheDocument();
    expect(rowTitles()).toEqual(["New order", "Add product", "Confirm orders", "All orders", "Lost orders", "Discounts", "Edit website", "Store settings"]);
    expect(screen.getByText("8 of 12")).toBeInTheDocument();
    expect(offeredRow("Customers")).toHaveAttribute("aria-pressed", "false");
    expect(offeredRow("All orders")).toHaveAttribute("aria-pressed", "true");
    expect(within(addSection()).getByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  it("reads the newest row when it opens", async () => {
    const { calls } = setup();
    await waitFor(() => expect(callsTo(calls, "GET", "/home-shortcuts")).toHaveLength(1));
  });

  it("shows in Arabic", async () => {
    setup(answer(), { locale: "ar" });
    expect(await screen.findByRole("dialog", { name: "تخصيص الاختصارات" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "اختصاراتك" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تحريك كل الطلبات لأعلى" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إخفاء كل الطلبات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إعادة ترتيب كل الطلبات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "استعادة الافتراضي" })).toBeInTheDocument();
  });
});

describe("on a phone, where the row fills the sheet", () => {
  it("a button goes to the list to add from", async () => {
    const { user } = setup();
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    await user.click(within(currentSection()).getByRole("button", { name: "Add a shortcut" }));
    expect(scrolled).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Add a shortcut" })).toHaveFocus();
  });
});

describe("hiding", () => {
  it("takes the shortcut off, offers it again, and saves nothing until Done", async () => {
    const { user, calls } = setup();
    await user.click(await screen.findByRole("button", { name: "Hide Discounts" }));
    expect(rowTitles()).not.toContain("Discounts");
    expect(screen.getByText("7 of 12")).toBeInTheDocument();
    expect(offeredRow("Discounts")).toHaveAttribute("aria-pressed", "false");
    expect(puts(calls)).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body).toEqual({ shortcuts: ["new_order", "add_product", "confirmation_queue", "orders", "lost_orders", "website", "store_settings"] });
  });

  it("the keyboard goes on to the next row's button, and the last row's to the one before", async () => {
    const { user } = setup(answer({ shortcuts: ["orders", "customers"] }));
    const hide = await screen.findByRole("button", { name: "Hide All orders" });
    hide.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Hide Customers" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Your shortcuts" })).toHaveFocus();
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });
});

describe("adding", () => {
  it("adds to the end, the button says it is on and takes it off again", async () => {
    const { user, calls } = setup();
    const customers = offeredRow("Customers");
    await user.click(customers);
    expect(rowTitles().at(-1)).toBe("Customers");
    expect(customers).toHaveAttribute("aria-pressed", "true");
    expect(customers).toHaveFocus();
    await user.click(customers);
    expect(rowTitles()).not.toContain("Customers");
    await user.click(customers);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body).toEqual({ shortcuts: [...DEFAULT_SHORTCUT_IDS, "customers"] });
  });

  it("cannot add a thirteenth, says why, and hiding one frees a place", async () => {
    const twelve = [...DEFAULT_SHORTCUT_IDS, "customers", "returns", "fraud", "media"];
    const { user } = setup(answer({ customized: true, shortcuts: twelve }));
    expect(screen.getByText("12 of 12")).toBeInTheDocument();
    expect(screen.getByText(/limit of 12 shortcuts/)).toBeInTheDocument();
    const courses = offeredRow("Courses");
    expect(courses).toHaveAttribute("aria-disabled", "true");
    await user.click(courses);
    expect(rowTitles()).toHaveLength(12);
    expect(rowTitles()).not.toContain("Courses");

    await user.click(screen.getByRole("button", { name: "Hide Customers" }));
    expect(courses).toHaveAttribute("aria-disabled", "false");
    await user.click(courses);
    expect(rowTitles().at(-1)).toBe("Courses");
  });

  it("never lists one twice", async () => {
    const { user } = setup();
    const orders = offeredRow("All orders");
    await user.click(orders);
    await user.click(orders);
    expect(rowTitles().filter((title) => title === "All orders")).toHaveLength(1);
  });

  it("searches both languages and tells when nothing matches", async () => {
    const { user } = setup();
    const search = within(addSection()).getByRole("searchbox", { name: "Search pages" });
    await user.type(search, "media");
    expect(offeredRow("Media library")).toBeInTheDocument();
    expect(offered("Customers")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "العملاء");
    expect(offeredRow("Customers")).toBeInTheDocument();
    expect(offered("Media library")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzzzzzz");
    expect(within(addSection()).getByText("No page matches your search.")).toBeInTheDocument();
  });

  it("filters by section", async () => {
    const { user } = setup();
    const filters = within(addSection()).getByRole("group", { name: "Filter by section" });
    await user.click(within(filters).getByRole("button", { name: "Products" }));
    expect(within(filters).getByRole("button", { name: "Products" })).toHaveAttribute("aria-pressed", "true");
    expect(offeredRow("Media library")).toBeInTheDocument();
    expect(offered("Customers")).not.toBeInTheDocument();
    await user.click(within(filters).getByRole("button", { name: "All" }));
    expect(offeredRow("Customers")).toBeInTheDocument();
  });
});

describe("reordering with the buttons", () => {
  it("moves up and down, keeps the keyboard on the button, and announces the place", async () => {
    const { user, calls } = setup(answer({ shortcuts: ["orders", "customers", "media"] }));
    const down = await screen.findByRole("button", { name: "Move All orders down" });
    down.focus();
    await user.keyboard("{Enter}");
    expect(rowTitles()).toEqual(["Customers", "All orders", "Media library"]);
    expect(screen.getByRole("button", { name: "Move All orders down" })).toHaveFocus();
    expect(screen.getByText("All orders moved to position 2 of 3.")).toHaveAttribute("role", "status");

    await user.click(screen.getByRole("button", { name: "Move Media library up" }));
    expect(rowTitles()).toEqual(["Customers", "Media library", "All orders"]);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].body).toEqual({ shortcuts: ["customers", "media", "orders"] });
  });

  it("at either end the button stays in the tab order and does nothing", async () => {
    const { user } = setup(answer({ shortcuts: ["orders", "customers"] }));
    const up = await screen.findByRole("button", { name: "Move All orders up" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    await user.click(up);
    const down = screen.getByRole("button", { name: "Move Customers down" });
    expect(down).toHaveAttribute("aria-disabled", "true");
    await user.click(down);
    expect(rowTitles()).toEqual(["All orders", "Customers"]);
  });
});

describe("reordering by drag", () => {
  it("the grip is a named control a keyboard can pick up, with instructions", async () => {
    setup(answer({ shortcuts: ["orders", "customers"] }));
    const grip = await screen.findByRole("button", { name: "Reorder All orders" });
    expect(grip).toHaveAttribute("aria-roledescription", "sortable");
    const described = grip.getAttribute("aria-describedby");
    expect(described).toBeTruthy();
    expect(document.getElementById(described as string)).toHaveTextContent(/press Space or Enter/);
  });

  it("Escape while carrying a row cancels the move and nothing else; the next one closes the editor", async () => {
    const { user, onClose } = setup(answer({ shortcuts: ["orders", "customers"] }));
    const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
    const grip = await screen.findByRole("button", { name: "Reorder All orders" });
    grip.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(grip).toHaveAttribute("aria-pressed", "true"));
    await tick();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(grip).not.toHaveAttribute("aria-pressed", "true"));
    expect(onClose).not.toHaveBeenCalled();
    expect(rowTitles()).toEqual(["All orders", "Customers"]);

    await tick();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("gives its instructions in Arabic too", async () => {
    setup(answer({ shortcuts: ["orders", "customers"] }), { locale: "ar" });
    const grip = await screen.findByRole("button", { name: "إعادة ترتيب كل الطلبات" });
    expect(document.getElementById(grip.getAttribute("aria-describedby") as string)).toHaveTextContent(/المسافة/);
  });
});

describe("saving", () => {
  it("with nothing changed, Done closes without a request", async () => {
    const { user, calls, onClose } = setup();
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
    expect(puts(calls)).toHaveLength(0);
    expect(deletes(calls)).toHaveLength(0);
  });

  it("changes undone before Done also send nothing", async () => {
    const { user, calls, onClose } = setup();
    const customers = offeredRow("Customers");
    await user.click(customers);
    await user.click(customers);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
    expect(puts(calls)).toHaveLength(0);
  });

  it("the answer becomes the row, and the editor closes with a word", async () => {
    const { user, onClose } = setup(answer({ shortcuts: ["orders"] }));
    await user.click(offeredRow("Customers"));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText("Shortcuts updated.")).toBeInTheDocument();
    expect(localStorage.getItem("zimos.homeShortcuts.user_1.ws_1")).toBe('["orders","customers"]');
  });

  it("Cancel throws the changes away", async () => {
    const { user, calls, onClose } = setup();
    await user.click(await screen.findByRole("button", { name: "Hide Discounts" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(puts(calls)).toHaveLength(0);
  });

  it("Escape throws the changes away", async () => {
    const { user, calls, onClose } = setup();
    await user.click(await screen.findByRole("button", { name: "Hide Discounts" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(puts(calls)).toHaveLength(0);
  });

  it("a failed save stays open with the changes and says why", async () => {
    const { user, calls, onClose } = setup(answer(), { put: new ApiError("boom", 500, "INTERNAL_SERVER_ERROR") });
    await user.click(await screen.findByRole("button", { name: "Hide Discounts" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(rowTitles()).not.toContain("Discounts");
    expect(puts(calls)).toHaveLength(1);
  });

  it("a page no longer allowed is explained in the merchant's language", async () => {
    const { user } = setup(answer(), { locale: "ar", put: new ApiError("not allowed", 403, "HOME_SHORTCUT_NOT_ALLOWED") });
    await user.click(await screen.findByRole("button", { name: "إخفاء الخصومات" }));
    await user.click(screen.getByRole("button", { name: "تم" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("إحدى هذه الصفحات لم تعد متاحة لك");
  });
});

describe("going back to the default", () => {
  it("draws the default row and forgets the list on Done", async () => {
    const { user, calls, onClose } = setup(answer({ customized: true, shortcuts: ["customers"] }));
    await user.click(await screen.findByRole("button", { name: "Restore defaults" }));
    expect(rowTitles()).toEqual(["New order", "Add product", "Confirm orders", "All orders", "Lost orders", "Discounts", "Edit website", "Store settings"]);
    expect(deletes(calls)).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(deletes(calls)).toHaveLength(1));
    expect(puts(calls)).toHaveLength(0);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("a change after it saves a list instead", async () => {
    const { user, calls } = setup(answer({ customized: true, shortcuts: ["customers"] }));
    await user.click(await screen.findByRole("button", { name: "Restore defaults" }));
    await user.click(screen.getByRole("button", { name: "Hide Discounts" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(deletes(calls)).toHaveLength(0);
  });

  it("on a row never arranged, undoing changes with it asks for nothing", async () => {
    const { user, calls, onClose } = setup();
    await user.click(await screen.findByRole("button", { name: "Hide Discounts" }));
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
    expect(puts(calls)).toHaveLength(0);
    expect(deletes(calls)).toHaveLength(0);
  });

  it("Cancel keeps the arranged row", async () => {
    const { user, calls } = setup(answer({ customized: true, shortcuts: ["customers"] }));
    await user.click(await screen.findByRole("button", { name: "Restore defaults" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deletes(calls)).toHaveLength(0);
  });

  it("does nothing on a row already on the default", async () => {
    const { user, calls } = setup();
    const restore = await screen.findByRole("button", { name: "Restore defaults" });
    expect(restore).toHaveAttribute("aria-disabled", "true");
    await user.click(restore);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(deletes(calls)).toHaveLength(0);
  });
});

describe("what the member may have", () => {
  it("offers only what the role can open", async () => {
    setup(answer({ shortcuts: ["orders"] }), { permissions: ["orders.view"] });
    expect(offeredRow("Returns")).toBeInTheDocument();
    expect(offered("Customers")).not.toBeInTheDocument();
    expect(offered("Discounts")).not.toBeInTheDocument();
  });

  it("offers only what the server's list names", async () => {
    setup(answer({ shortcuts: ["orders"], available: ["orders", "customers"] }));
    expect(offeredRow("Customers")).toBeInTheDocument();
    expect(offered("Media library")).not.toBeInTheDocument();
  });

  it("leaves out what the plan holds back, from the catalogue and from the row", async () => {
    setup(answer({ shortcuts: ["reviews", "orders"] }), { planFeatures: { features: [], enforced: true, growthEnforced: true } });
    await waitFor(() => expect(offered("Reviews")).not.toBeInTheDocument());
    expect(offered("Web analytics")).not.toBeInTheDocument();
    expect(rowTitles()).toEqual(["All orders"]);
  });

  it("a plan that holds the key keeps the page", async () => {
    setup(answer({ shortcuts: ["orders"] }), { planFeatures: { features: ["advanced_analytics", "reviews"], enforced: true, growthEnforced: true } });
    await screen.findByRole("dialog");
    await waitFor(() => expect(offeredRow("Web analytics")).toBeInTheDocument());
    expect(offeredRow("Reviews")).toBeInTheDocument();
  });
});
