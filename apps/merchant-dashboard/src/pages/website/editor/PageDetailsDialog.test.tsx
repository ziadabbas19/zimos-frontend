import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import type { WebsitePage } from "@store-builder/api-client";
import { PageDetailsDialog } from "./PageDetailsDialog";

const page = (over: Partial<WebsitePage> = {}) =>
  ({ id: "p1", title: "About", path: "/about", pageType: "static", seo: { title: "Old", noindex: true }, isLive: true, showInHeader: false, showInFooter: false, ...over }) as WebsitePage;

function setup(target = page()) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<PageDetailsDialog page={target} takenPaths={["/", "/contact"]} onSave={onSave} onClose={onClose} />, { wrapper: LocaleProvider });
  return { onSave, onClose };
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("a page's details", () => {
  it("renames a page without touching anything else", async () => {
    const { onSave, onClose } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: /Page name/ }), { target: { value: "Our story" } });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ title: "Our story" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("says a published page's old address will keep working when it moves", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: /Page address/ }), { target: { value: "our-story" } });
    expect(screen.getByRole("status").textContent).toMatch(/old address will be sent to the new one/);
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ path: "/our-story" }));
  });

  it("promises no redirect for a page that was never published", () => {
    setup(page({ isLive: false }));
    fireEvent.change(screen.getByRole("textbox", { name: /Page address/ }), { target: { value: "our-story" } });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["checkout", /uses this address for one of its own pages/],
    ["contact", /Another page already uses this address/],
  ])("refuses the address %s", (address, message) => {
    const { onSave } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: /Page address/ }), { target: { value: address } });
    expect(screen.getByText(message)).toBeTruthy();
    save();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("switches the page into the menus", async () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("switch", { name: "Show in the header menu" }));
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ showInHeader: true }));
  });

  it("saves how the page reads on Google and keeps the rest of its search settings", async () => {
    const { onSave } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: /Title on Google/ }), { target: { value: "About us" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Description on Google/ }), { target: { value: "Who we are" } });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ seo: { title: "About us", description: "Who we are", noindex: true } }));
  });

  it("closes without saving when nothing changed", () => {
    const { onSave, onClose } = setup();
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("does not offer to move the home page", () => {
    setup(page({ pageType: "home", path: "/" }));
    expect(screen.queryByRole("textbox", { name: /Page address/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Show in the header menu" })).toBeNull();
  });
});
