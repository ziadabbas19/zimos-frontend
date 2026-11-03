import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { XS_CATALOGS } from "../../gallery/xsCatalog";

/**
 * The imported templates' own demo catalogues (./products), which "Use this
 * template" can bring into a store: every picture they name is served by the
 * storefront, every product sits in groups the catalogue lists, and prices
 * are prices.
 */

const PUBLIC = fileURLToPath(new URL("../../../../../../storefront/public/", import.meta.url));

describe("the imported templates' catalogues", () => {
  it("name only pictures the storefront carries", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      for (const product of catalog.products) {
        for (const picture of [product.image, ...(product.images ?? [])]) {
          expect(picture.startsWith(`/xs/${catalog.look}/`), `${catalog.look}: ${picture}`).toBe(true);
          expect(existsSync(join(PUBLIC, picture.slice(1))), `${catalog.look}: ${picture}`).toBe(true);
        }
      }
    }
  });

  it("put each product in groups the catalogue lists, at a real price", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      const slugs = new Set(catalog.collections.map((collection) => collection.slug));
      for (const product of catalog.products) {
        expect(product.name.trim(), catalog.look).not.toBe("");
        expect(Number.isFinite(product.price) && product.price >= 0, `${catalog.look}: ${product.name}`).toBe(true);
        for (const slug of product.collections) expect(slugs.has(slug), `${catalog.look}: ${product.name} → ${slug}`).toBe(true);
      }
    }
  });

  it("name every product once, in English and in Arabic, with a few words about it in both", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      const names = catalog.products.map((product) => product.name.trim().toLowerCase());
      expect(new Set(names).size, `${catalog.look}: a name is used twice`).toBe(names.length);
      const arabic = catalog.products.map((product) => product.nameAr?.trim() ?? "");
      expect(new Set(arabic).size, `${catalog.look}: an Arabic name is used twice`).toBe(arabic.length);
      for (const product of catalog.products) {
        expect(product.nameAr ?? "", `${catalog.look}: ${product.name}`).toMatch(/[؀-ۿ]/);
        expect((product.description ?? "").trim(), `${catalog.look}: ${product.name}`).not.toBe("");
        expect(product.descriptionAr ?? "", `${catalog.look}: ${product.name}`).toMatch(/[؀-ۿ]/);
        expect(product.description!.toLowerCase(), `${catalog.look}: ${product.name}`).not.toMatch(/lorem|ipsum/);
      }
      for (const collection of catalog.collections) expect(collection.nameAr ?? "", `${catalog.look}: ${collection.slug}`).toMatch(/[؀-ۿ]/);
    }
  });

  it("price in Egyptian pounds, with a was-price only above the price, and no guessed figures", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      expect(catalog.currency, catalog.look).toBe("EGP");
      for (const product of catalog.products) {
        expect(Number.isInteger(product.price) && product.price > 0, `${catalog.look}: ${product.name}`).toBe(true);
        if (product.compareAt !== undefined) expect(product.compareAt, `${catalog.look}: ${product.name}`).toBeGreaterThan(product.price);
        for (const flag of ["priceGuessed", "nameGuessed"]) expect(flag in product, `${catalog.look}: ${product.name} ${flag}`).toBe(false);
      }
    }
  });

  it("give a product's choices in both languages, and each variant one value of each at a real price", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      const slugs = catalog.products.flatMap((product) => (product.slug ? [product.slug] : []));
      expect(new Set(slugs).size, `${catalog.look}: a slug is used twice`).toBe(slugs.length);
      for (const slug of slugs) expect(slug, catalog.look).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      for (const product of catalog.products) {
        const label = `${catalog.look}: ${product.name}`;
        expect(Boolean(product.options?.length), label).toBe(Boolean(product.variants?.length));
        if (!product.options || !product.variants) continue;
        for (const option of product.options) {
          expect(option.values.length, label).toBeGreaterThan(0);
          expect(option.nameAr ?? "", label).toMatch(/[؀-ۿ]/);
          expect(option.valuesAr?.length, `${label}: ${option.name}`).toBe(option.values.length);
        }
        const combos = product.variants.map((variant) => variant.values.join("|"));
        expect(new Set(combos).size, `${label}: a combination is listed twice`).toBe(combos.length);
        for (const variant of product.variants) {
          expect(variant.values.length, label).toBe(product.options.length);
          variant.values.forEach((value, i) => expect(product.options![i].values, label).toContain(value));
          expect(Number.isInteger(variant.price) && variant.price > 0, label).toBe(true);
          if (variant.compareAt !== undefined) expect(variant.compareAt, label).toBeGreaterThan(variant.price);
        }
        expect(product.price, `${label}: the lowest variant price`).toBe(Math.min(...product.variants.map((variant) => variant.price)));
      }
    }
  });

  it("fill every group they list, so no tab of the template's product grid is empty", () => {
    for (const catalog of Object.values(XS_CATALOGS)) {
      for (const collection of catalog.collections) {
        expect(
          catalog.products.some((product) => product.collections.includes(collection.slug)),
          `${catalog.look}: ${collection.slug} is empty`
        ).toBe(true);
      }
    }
  });
});
