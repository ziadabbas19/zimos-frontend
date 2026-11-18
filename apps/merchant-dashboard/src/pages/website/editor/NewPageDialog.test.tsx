import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { ApiError } from "@/lib/errors";
import { NewPageDialog } from "./NewPageDialog";

function setup(overrides: Partial<Parameters<typeof NewPageDialog>[0]> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const onAddProductsToMenu = vi.fn();
  render(
    <NewPageDialog
      open
      onClose={onClose}
      onCreate={onCreate}
      takenPaths={["/", "/about"]}
      language="en"
      productsMenu="available"
      onAddProductsToMenu={onAddProductsToMenu}
      {...overrides}
    />,
    { wrapper: LocaleProvider }
  );
  return { onCreate, onClose, onAddProductsToMenu };
}

const nameBox = () => screen.getByRole("textbox", { name: /Page name/ });
const addressBox = () => screen.getByRole("textbox", { name: /Page address/ });
const addButton = () => screen.getByRole("button", { name: "Add page" });

describe("adding a page", () => {
  it("writes the address from the name and creates the page in the menu", async () => {
    const { onCreate } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /^Questions/ }));
    fireEvent.change(nameBox(), { target: { value: "Delivery Help" } });
    expect((addressBox() as HTMLInputElement).value).toBe("delivery-help");
    fireEvent.click(addButton());
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const payload = onCreate.mock.calls[0]![0];
    expect(payload).toMatchObject({ title: "Delivery Help", path: "/delivery-help", pageType: "static", showInHeader: true, showInFooter: false });
    expect(payload.draftData.sections.length).toBeGreaterThan(1);
  });

  it("keeps the address the merchant wrote when the name changes", () => {
    setup();
    fireEvent.change(nameBox(), { target: { value: "Delivery" } });
    fireEvent.change(addressBox(), { target: { value: "shipping" } });
    fireEvent.change(nameBox(), { target: { value: "Delivery Help" } });
    expect((addressBox() as HTMLInputElement).value).toBe("shipping");
  });

  it.each([
    ["cart", /uses this address for one of its own pages/],
    ["about", /Another page already uses this address/],
    ["Our Page", /small English letters/],
  ])("says what is wrong with the address %s and sends nothing", (address, message) => {
    const { onCreate } = setup();
    fireEvent.change(nameBox(), { target: { value: "My page" } });
    fireEvent.change(addressBox(), { target: { value: address } });
    expect(screen.getByText(message)).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(addButton());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows the server's refusal under the address and stays open", async () => {
    const onCreate = vi.fn().mockRejectedValue(new ApiError("taken", 409, "PAGE_PATH_TAKEN"));
    setup({ onCreate });
    fireEvent.change(nameBox(), { target: { value: "Delivery" } });
    fireEvent.click(addButton());
    expect(await screen.findByText(/Another page already uses this address/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("can leave the page out of the header and put it in the footer", async () => {
    const { onCreate } = setup();
    fireEvent.change(nameBox(), { target: { value: "Terms" } });
    fireEvent.click(screen.getByRole("switch", { name: "Show in the header menu" }));
    fireEvent.click(screen.getByRole("switch", { name: "Show in the footer" }));
    fireEvent.click(addButton());
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ showInHeader: false, showInFooter: true });
  });

  it("adds the store's products page to the menu in one click, making no new page", () => {
    const { onCreate, onAddProductsToMenu, onClose } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /^Products page/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to menu" }));
    expect(onAddProductsToMenu).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when the products page is already in the menu", () => {
    setup({ productsMenu: "added" });
    fireEvent.click(screen.getByRole("radio", { name: /^Products page/ }));
    expect(screen.getByRole("status").textContent).toMatch(/already in your menu/);
    expect((screen.getByRole("button", { name: "Add to menu" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
