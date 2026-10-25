import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { TrackingPixelList } from "@store-builder/api-client";
import { fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { TrackingPixelsSection } from "@/pages/marketing/TrackingPixelsSection";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** The Platform field is a list with the platforms' icons (components/IconSelect): opened, its options' spoken names in order. */
async function platformChoices(user: UserEvent, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("combobox", { name: /^Platform/ }));
  return within(screen.getByRole("listbox", { name: /^Platform/ }))
    .getAllByRole("option")
    .map((option) => {
      // The icons (a logo, or a letter in a circle) are hidden from screen readers.
      const copy = option.cloneNode(true) as Element;
      copy.querySelectorAll("[aria-hidden]").forEach((icon) => icon.remove());
      return copy.textContent;
    });
}

// No switch is mocked here: this is the dashboard as it ships, reports and extra pixels off.
describe("store reports, customer groups and extra pixels while switched off", () => {
  it("offers only the platforms the store always had, whatever the API lists", async () => {
    const list = {
      pixels: [],
      platforms: [
        { name: "meta", capi: true, testEventCode: true },
        { name: "pinterest", capi: true, testEventCode: true },
        { name: "x", capi: true, testEventCode: false },
        { name: "taboola", capi: false, testEventCode: false },
      ],
    } as unknown as TrackingPixelList;
    fakeBackend({ "GET /tracking-pixels": list });
    const { user } = renderWithProviders(<TrackingPixelsSection />);
    await user.click((await screen.findAllByRole("button", { name: "Add pixel" }))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(await platformChoices(user, dialog)).toEqual(["Meta (Facebook & Instagram)"]);
  });

  it("keeps every new address, tab, card and section behind the reports switch", () => {
    const app = read("../../../App.tsx");
    expect(app).toMatch(/path="\/analytics\/reports\/:report\?"\s+element=\{STORE_REPORTS_ENABLED \? /);
    expect(read("../reports/ReportsPage.tsx")).toContain("{STORE_REPORTS_ENABLED && <StoreReportsMenu />}");
    const contacts = read("../../customers/ContactsPage.tsx");
    expect(contacts).toContain('...(STORE_REPORTS_ENABLED ? [{ value: "groups" as const, label: t.groups }] : []),');
    expect(contacts).toContain("const group = STORE_REPORTS_ENABLED && isRfmLabel(askedGroup) ? askedGroup : null;");
    expect(read("../../customers/CustomerDetailPage.tsx")).toContain("{STORE_REPORTS_ENABLED && <CustomerRfmCard customerId={customer.id} />}");
    // In Settings the summary reports sit in the Notifications section, still behind the switch
    // (the open section is keyed by the store, so the card needs no key of its own).
    const settings = read("../../settings/SettingsPage.tsx");
    expect(settings).toContain("{STORE_REPORTS_ENABLED && <SummaryReportsSection />}");
    expect(settings.match(/<SummaryReportsSection/g)).toHaveLength(1);
  });
});
