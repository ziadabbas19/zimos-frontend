import type { ProductMedia } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";

/**
 * An imported template's own demo catalogue (templates/xs/products/xsNN.products.json):
 * its product groups, its products with their pictures and prices, and the
 * words its product grid prints. Taking the template from the gallery can
 * bring these into the store, so it opens looking exactly like the template.
 *
 * The pictures are served by the storefront (public/xs/NN/products/), so a
 * product's picture address is the storefront's own. Prices are in Egyptian
 * pounds; each name and description comes in English and in Arabic, and the
 * Arabic template (`xs-NN-ar`) brings the Arabic ones.
 */
export interface XsCatalog {
  look: string;
  /** What the prices are in. */
  currency?: string;
  /** The template's pages link to its groups (`/products?collection=<slug>`), so they are made even when its products are left out. */
  linkedGroups?: boolean;
  collections: Array<{ name: string; nameAr?: string; slug: string }>;
  products: Array<{
    name: string;
    nameAr?: string;
    /** Its address name, for the bands that name products one by one (xs_journey, xs_reels); absent, made from its name. */
    slug?: string;
    description?: string;
    descriptionAr?: string;
    /** The lowest of its prices, shown before a choice is made. */
    price: number;
    compareAt?: number;
    image: string;
    images?: string[];
    collections: string[];
    /** Its choices (colour, size…), each in English and in Arabic, value for value. */
    options?: Array<{ name: string; nameAr?: string; values: string[]; valuesAr?: string[] }>;
    /** One per combination of choices: its values in the options' order (English) and its own price. */
    variants?: Array<{ values: string[]; price: number; compareAt?: number }>;
  }>;
  wording?: Record<string, string>;
  wordingAr?: Record<string, string>;
}

/** Which of a catalogue's two wordings a store is given. */
export type CatalogLanguage = "en" | "ar";

const FILES = import.meta.glob<XsCatalog>("../templates/xs/products/*.products.json", { eager: true, import: "default" });

/** Every template's catalogue, by look. */
export const XS_CATALOGS: Readonly<Record<string, XsCatalog>> = Object.fromEntries(
  Object.values(FILES)
    .filter((catalog) => catalog && typeof catalog.look === "string" && Array.isArray(catalog.products) && catalog.products.length > 0)
    .map((catalog) => [catalog.look, catalog])
);

/** The catalogue of a template's look, or null when it brings none. */
export function xsCatalogOf(look: string | null | undefined): XsCatalog | null {
  return look ? (XS_CATALOGS[look] ?? null) : null;
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

function mediaOf(path: string): ProductMedia {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return { url: `${STOREFRONT_URL}${path}`, path, mimeType: MIME[ext] ?? "image/jpeg", size: 0 };
}

/** One card of a catalogue: a template may show several cards of the same name with different pictures. */
const cardKey = (name: string, picture: string) => `${name.trim().toLowerCase()}|${picture}`;

/** The path of a product's first picture, however it was stored. */
function firstPicturePath(media: ProductMedia[] | undefined): string {
  const first = media?.[0];
  if (!first) return "";
  if (first.path) return first.path;
  try {
    return new URL(first.url).pathname;
  } catch {
    return first.url ?? "";
  }
}

/** Money as the API stores it: whole minor units. */
const minor = (amount: number) => Math.max(0, Math.round(amount * 100));

type CatalogOption = NonNullable<XsCatalog["products"][number]["options"]>[number];

/** A choice's name in the store's language. */
const optionName = (option: CatalogOption, ar: boolean) => (ar && option.nameAr) || option.name;

/** The `i`th value of a choice in the store's language. */
const optionValue = (option: CatalogOption, i: number, ar: boolean) => (ar && option.valuesAr?.[i]) || option.values[i];

/**
 * A template's groups as collections in the store, by their address (one
 * already there is used as it is); what each address's collection id is.
 * Also run alone for a catalogue whose pages link to its groups, when its
 * products are left out, so those links lead to a group and not to nothing.
 */
export async function addXsGroups(workspaceId: string, catalog: XsCatalog, language: CatalogLanguage = "en"): Promise<Map<string, string>> {
  const ar = language === "ar";
  const collectionIds = new Map<string, string>();
  const existingCollections = await apiClient.listCollections(workspaceId);
  for (const collection of existingCollections) collectionIds.set(collection.slug, collection.id);
  for (const collection of catalog.collections) {
    if (collectionIds.has(collection.slug)) continue;
    try {
      const created = await apiClient.createCollection(workspaceId, { name: (ar && collection.nameAr) || collection.name, slug: collection.slug });
      collectionIds.set(created.slug ?? collection.slug, created.id);
    } catch {
      /* the products still come; they are just not grouped */
    }
  }
  return collectionIds;
}

export interface CatalogResult {
  added: number;
  skipped: number;
  failed: number;
}

/**
 * Brings a template's catalogue into a store: its groups as collections (one
 * already there by the same address is used as it is) and its products, active
 * and stocked, each in its groups — one with choices gets a variant per
 * combination, at that combination's price. A product the store already has with the same
 * name and first picture is left alone, so taking the template again adds
 * nothing twice (cards of one name with different pictures are each a product).
 */
export async function addXsCatalog(
  workspaceId: string,
  catalog: XsCatalog,
  onProgress?: (done: number, total: number) => void,
  language: CatalogLanguage = "en"
): Promise<CatalogResult> {
  const result: CatalogResult = { added: 0, skipped: 0, failed: 0 };
  const ar = language === "ar";
  const collectionIds = await addXsGroups(workspaceId, catalog, language);

  const names = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const { products, nextCursor } = await apiClient.listProducts(workspaceId, { limit: 100, cursor, status: ["draft", "active", "archived"] });
    for (const product of products) names.add(cardKey(product.name, firstPicturePath(product.media as ProductMedia[] | undefined)));
    if (!nextCursor) break;
    cursor = nextCursor;
  }

  const total = catalog.products.length;
  let done = 0;
  for (const product of catalog.products) {
    done += 1;
    const name = (ar && product.nameAr) || product.name;
    const description = (ar && product.descriptionAr) || product.description;
    if (names.has(cardKey(name, product.image))) {
      result.skipped += 1;
      onProgress?.(done, total);
      continue;
    }
    try {
      const pictures = product.images && product.images.length > 0 ? product.images : [product.image];
      const options = product.variants?.length ? (product.options ?? []) : [];
      const { product: created } = await apiClient.createProduct(workspaceId, {
        name,
        ...(product.slug ? { slug: product.slug } : {}),
        status: "active",
        ...(description ? { description } : {}),
        media: pictures.map(mediaOf),
        ...(options.length > 0
          ? { options: options.map((option) => ({ name: optionName(option, ar), values: option.values.map((_, i) => optionValue(option, i, ar)) })) }
          : {
              variant: {
                priceAmount: minor(product.price),
                compareAtAmount: product.compareAt && product.compareAt > product.price ? minor(product.compareAt) : null,
                stockOnHand: 50,
              },
            }),
      });
      // A product with choices gets one variant per combination, a few at a time.
      const variants = options.length > 0 ? (product.variants ?? []) : [];
      for (let at = 0; at < variants.length; at += 5) {
        await Promise.all(
          variants.slice(at, at + 5).map((variant) =>
            apiClient.createVariant(workspaceId, created.id, {
              optionValues: Object.fromEntries(
                options.map((option, i) => [optionName(option, ar), optionValue(option, Math.max(0, option.values.indexOf(variant.values[i])), ar)])
              ),
              priceAmount: minor(variant.price),
              compareAtAmount: variant.compareAt && variant.compareAt > variant.price ? minor(variant.compareAt) : null,
              stockOnHand: 50,
            })
          )
        );
      }
      names.add(cardKey(name, product.image));
      for (const slug of product.collections) {
        const id = collectionIds.get(slug);
        if (id) await apiClient.addProductToCollection(workspaceId, created.id, id).catch(() => undefined);
      }
      result.added += 1;
    } catch {
      result.failed += 1;
    }
    onProgress?.(done, total);
  }
  return result;
}
