import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { ApiClient, MediaAsset, Product } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MediaPicker } from "@/components/MediaPicker";
import { ApiError } from "@/lib/errors";
import { ELEMENT_SPECS } from "./blocks";
import { ImageField } from "./ImageField";
import { InspectorEnvProvider } from "./inspector/env";
import { ProductPickerField } from "./ProductPickerField";

/**
 * Inside the editor a product or a collection is picked from the store's own
 * catalogue instead of typed as an id, and a picture can come from the media
 * library instead of a new upload.
 */

type Collection = Awaited<ReturnType<ApiClient["listCollections"]>>[number];

const HEADPHONES = "11111111-1111-4111-8111-111111111111";
const SPEAKER = "22222222-2222-4222-8222-222222222222";

const products = [
  fake<Product>({ id: HEADPHONES, name: "Headphones Pro", status: "active" }),
  fake<Product>({ id: SPEAKER, name: "Mini speaker", status: "draft" }),
];

afterEach(() => {
  api.listProducts.mockReset();
  api.listCollections.mockReset();
  api.getProduct.mockReset();
  api.listMedia.mockReset();
});

describe("the product picker", () => {
  it("lists the catalogue by name and saves the id", async () => {
    api.listProducts.mockResolvedValue(fake({ products, nextCursor: null }));
    const onChange = vi.fn();
    const { user } = renderWithProviders(<ProductPickerField kind="product" label="Product" value="" onChange={onChange} />);
    const select = await screen.findByRole("combobox", { name: "Product" });
    await screen.findByRole("option", { name: "Headphones Pro" });
    // A draft is offered too, and says what it is.
    expect(screen.getByRole("option", { name: "Mini speaker (draft)" })).toBeTruthy();
    await user.selectOptions(select, HEADPHONES);
    expect(onChange).toHaveBeenCalledWith(HEADPHONES);
    expect(api.listProducts).toHaveBeenCalledWith("ws_1", expect.objectContaining({ status: ["active", "draft"] }));
  });

  it("searches the catalogue as the merchant types", async () => {
    api.listProducts.mockResolvedValue(fake({ products, nextCursor: null }));
    const { user } = renderWithProviders(<ProductPickerField kind="product" label="Product" value="" onChange={vi.fn()} />);
    await screen.findByRole("option", { name: "Headphones Pro" });
    await user.type(screen.getByRole("textbox", { name: "Search products" }), "head");
    await waitFor(() => expect(api.listProducts).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ q: "head" })));
  });

  it("keeps a value saved before the picker existed, and shows it", async () => {
    api.listProducts.mockResolvedValue(fake({ products, nextCursor: null }));
    const onChange = vi.fn();
    renderWithProviders(<ProductPickerField kind="product" label="Product" value="summer-dress" onChange={onChange} />);
    expect(await screen.findByRole("option", { name: "Saved value: summer-dress" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Product" }) as HTMLSelectElement).value).toBe("summer-dress");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names a saved product that is not among the first ones listed", async () => {
    api.listProducts.mockResolvedValue(fake({ products: [products[1]], nextCursor: null }));
    api.getProduct.mockResolvedValue(products[0]);
    renderWithProviders(<ProductPickerField kind="product" label="Product" value={HEADPHONES} onChange={vi.fn()} />);
    expect(await screen.findByRole("option", { name: "Headphones Pro" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit product" }).getAttribute("href")).toBe(`/catalog/${HEADPHONES}`);
  });

  it("lists collections for a collection field", async () => {
    api.listCollections.mockResolvedValue([fake<Collection>({ id: "col_1", name: "Summer" }), fake<Collection>({ id: "col_2", name: "Winter" })]);
    const onChange = vi.fn();
    const { user } = renderWithProviders(<ProductPickerField kind="collection" label="Collection" value="" onChange={onChange} />);
    await screen.findByRole("option", { name: "Summer" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Collection" }), "col_2");
    expect(onChange).toHaveBeenCalledWith("col_2");
    expect(api.listProducts).not.toHaveBeenCalled();
  });

  it("keeps the saved value when the list cannot be loaded", async () => {
    api.listProducts.mockRejectedValue(new Error("offline"));
    renderWithProviders(<ProductPickerField kind="product" label="Product" value="summer-dress" onChange={vi.fn()} />);
    expect(await screen.findByText(/The current value is kept/)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Product" }) as HTMLSelectElement).value).toBe("summer-dress");
  });

  it("is what the blocks ask for wherever a product or collection id was typed", () => {
    const pickers = Object.entries(ELEMENT_SPECS).flatMap(([type, block]) =>
      block.fields.filter((f) => f.key === "productId" || f.key === "collectionId").map((f) => `${type}.${f.key}:${f.kind}`)
    );
    expect(pickers.length).toBeGreaterThan(5);
    for (const entry of pickers) expect(entry).toMatch(/\.productId:product$|\.collectionId:collection$/);
  });
});

describe("the media library", () => {
  const asset = (id: string, mimeType = "image/png") =>
    fake<MediaAsset>({ id, url: `https://cdn.zimos.test/${id}.png`, mimeType, size: 1200, createdAt: "2026-10-01T10:00:00Z" });

  it("offers the store's pictures and hands back the one that is picked", async () => {
    api.listMedia.mockResolvedValue({ media: [asset("m1"), asset("m2"), asset("clip", "video/mp4")], nextCursor: null });
    const onPick = vi.fn();
    const { user } = renderWithProviders(<MediaPicker open onOpenChange={vi.fn()} onPick={onPick} accept="image" />);
    const tiles = await screen.findAllByRole("button", { name: /Use the picture uploaded/ });
    // The video is not a picture: it is not offered here.
    expect(tiles).toHaveLength(2);
    await user.click(tiles[1]);
    await waitFor(() => expect(onPick).toHaveBeenCalledWith({ url: "https://cdn.zimos.test/m2.png", id: "m2" }));
  });

  it("says in words when the role cannot open the library", async () => {
    api.listMedia.mockRejectedValue(new ApiError("Forbidden", 403, "FORBIDDEN"));
    renderWithProviders(<MediaPicker open onOpenChange={vi.fn()} onPick={vi.fn()} accept="image" />);
    expect(await screen.findByText("The media library isn't part of your role")).toBeTruthy();
  });

  it("says the same in the dashboard's own Arabic", async () => {
    api.listMedia.mockResolvedValue({ media: [], nextCursor: null });
    renderWithProviders(<MediaPicker open onOpenChange={vi.fn()} onPick={vi.fn()} accept="image" />, { locale: "ar" });
    expect(await screen.findByText("لا توجد صور بعد")).toBeTruthy();
    expect(screen.getByText("اختيار صورة")).toBeTruthy();
  });
});

describe("a picture field", () => {
  it("is upload only where nothing offers a library", () => {
    renderWithProviders(<ImageField label="Photo" value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose from the library" })).toBeNull();
  });

  it("asks the editor for a library picture, and takes the one it is handed", async () => {
    const onChange = vi.fn();
    let apply: ((url: string) => void) | null = null;
    const env = { compact: false, pairImages: false, requestImage: (fn: (url: string) => void) => void (apply = fn) };
    const { user } = renderWithProviders(
      <InspectorEnvProvider value={env}>
        <ImageField label="Photo" value="" onChange={onChange} />
      </InspectorEnvProvider>
    );
    await user.click(screen.getByRole("button", { name: "Choose from the library" }));
    expect(apply).not.toBeNull();
    apply!("https://cdn.zimos.test/m1.png");
    expect(onChange).toHaveBeenCalledWith("https://cdn.zimos.test/m1.png");
  });
});
