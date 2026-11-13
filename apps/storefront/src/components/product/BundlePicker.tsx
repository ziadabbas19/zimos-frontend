"use client";

import { useEffect, useMemo, useState } from "react";
import { storefrontShippingQuoteFor, type ApiClient, type StorefrontBundle, type StorefrontBundleTier, type StorefrontProduct, type StorefrontVariant } from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import { useOfferView } from "@/lib/offerViews";
import { variantLabel } from "@/lib/product";
import { getVisitorId } from "@/lib/visitorId";
import type { OrderLine } from "@/lib/placeOrder";
import { CartGlyph, CheckIcon } from "../Icons";
import { btnSecondary, input } from "../ui";
import { pickText } from "@/lib/i18n";

/**
 * The quantity bundle of a product (SPEC §10.1): the shopper picks a tier
 * ("2 pieces — save 5%") and, when the product has variants, a variant for
 * each piece. Every number shown comes from the server: each tier is priced
 * per variant on the product, and a mixed selection is priced by the quote
 * endpoint — the same function the order is charged with.
 */

const TEXT = {
  en: {
    choose: "Choose your offer",
    pieces: (n: number) => (n === 1 ? "1 piece" : `${n} pieces`),
    save: (amount: string) => `Save ${amount}`,
    freeShipping: "Free shipping",
    each: (amount: string) => `${amount} each`,
    piece: (n: number) => `Piece ${n}`,
    pickEach: "Choose each piece",
    soldOut: "sold out",
    addToCart: "Add to cart",
    adding: "Adding…",
    added: "Added to cart",
    addFailed: "Couldn't add to your cart.",
  },
  ar: {
    choose: "اختر عرضك",
    pieces: (n: number) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتان" : `${n} قطع`),
    save: (amount: string) => `وفّر ${amount}`,
    freeShipping: "شحن مجاني",
    each: (amount: string) => `${amount} للقطعة`,
    piece: (n: number) => `القطعة ${n}`,
    pickEach: "اختر كل قطعة",
    soldOut: "نفد",
    addToCart: "أضف للسلة",
    adding: "جارٍ الإضافة…",
    added: "تمت الإضافة للسلة",
    addFailed: "تعذّرت الإضافة للسلة.",
  },
};

export interface BundleSelection {
  bundle: StorefrontBundle;
  tier: StorefrontBundleTier;
  setTierId: (id: string) => void;
  /** The variant of each piece, first to last. */
  unitVariantIds: string[];
  setUnitVariant: (index: number, variantId: string) => void;
  /** The pieces as order lines, one per variant. */
  lines: OrderLine[];
  quantity: number;
  /** Whether every piece's variant can be bought. */
  available: boolean;
  pricing: { full: number; total: number; saving: number };
}

/**
 * The shopper's bundle choice. The first piece follows the page's own variant
 * picker (`mainVariant`); the others start as the same variant and can be
 * changed one by one.
 */
export function useBundleSelection({
  client,
  workspaceId,
  bundle,
  product,
  mainVariant,
}: {
  client: ApiClient;
  workspaceId: string;
  bundle: StorefrontBundle | null;
  product: StorefrontProduct;
  mainVariant: StorefrontVariant | undefined;
}): BundleSelection | null {
  const [tierId, setTierId] = useState(() => bundle?.tiers.find((t) => t.isDefault)?.id ?? bundle?.tiers[0]?.id ?? "");
  // Pieces the shopper set by hand, by position; the rest follow the main variant.
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const tier = bundle?.tiers.find((t) => t.id === tierId) ?? bundle?.tiers[0];
  // The bundle on the page counts as seen (lib/offerViews).
  useOfferView(workspaceId, "bundle", bundle?.id);

  const unitVariantIds = useMemo(() => {
    if (!tier || !mainVariant) return [];
    return Array.from({ length: tier.quantity }, (_, i) =>
      i > 0 && overrides[i] && product.variants.some((v) => v.id === overrides[i]) ? overrides[i] : mainVariant.id
    );
  }, [tier, mainVariant, overrides, product.variants]);

  const lines = useMemo(() => {
    const byVariant = new Map<string, number>();
    for (const id of unitVariantIds) byVariant.set(id, (byVariant.get(id) ?? 0) + 1);
    return [...byVariant.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  }, [unitVariantIds]);

  // A mixed selection is priced by the server's quote; one variant is already priced on the tier.
  const mixed = lines.length > 1;
  const requestKey = mixed ? JSON.stringify(lines) : "";
  const [quoted, setQuoted] = useState<{ key: string; full: number; total: number } | null>(null);
  // Quoted for the store's own country (lib/storeCountry), as the order form starts on it.
  const country = useStoreCountry();
  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      storefrontShippingQuoteFor(client, workspaceId, { country, governorate: null, items: JSON.parse(requestKey) }, { visitorId: getVisitorId(workspaceId) })
        .then((quote) => {
          if (cancelled) return;
          const discount = (quote as { bundleDiscountAmount?: number }).bundleDiscountAmount ?? 0;
          setQuoted({ key: requestKey, full: quote.subtotal + discount, total: quote.subtotal });
        })
        .catch(() => {
          /* the per-variant estimate below stays on screen */
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestKey, client, workspaceId, country]);

  if (!bundle || !tier) return null;

  let pricing = { full: 0, total: 0, saving: 0 };
  if (mixed && quoted && quoted.key === requestKey) {
    pricing = { full: quoted.full, total: quoted.total, saving: Math.max(0, quoted.full - quoted.total) };
  } else {
    // One variant: the tier's own price. Mixed and not quoted yet: each piece at its variant's share.
    for (const id of unitVariantIds) {
      const price = tier.prices[id];
      if (!price) continue;
      pricing.full += price.full / tier.quantity;
      pricing.total += price.total / tier.quantity;
    }
    pricing = { full: Math.round(pricing.full), total: Math.round(pricing.total), saving: 0 };
    pricing.saving = Math.max(0, pricing.full - pricing.total);
  }

  return {
    bundle,
    tier,
    setTierId,
    unitVariantIds,
    setUnitVariant: (index, variantId) => setOverrides((current) => ({ ...current, [index]: variantId })),
    lines,
    quantity: tier.quantity,
    available: unitVariantIds.length > 0 && unitVariantIds.every((id) => product.variants.find((v) => v.id === id)?.inStock),
    pricing,
  };
}

export function BundlePicker({
  selection,
  product,
  mainVariant,
}: {
  selection: BundleSelection;
  product: StorefrontProduct;
  mainVariant: StorefrontVariant | undefined;
}) {
  const { locale, money } = useStore();
  const text = pickText(TEXT, locale);
  const { bundle, tier } = selection;
  const variantId = mainVariant?.id ?? product.variants[0]?.id ?? "";
  const hasVariants = product.variants.length > 1;

  const tierName = (x: StorefrontBundleTier) => x.title || text.pieces(x.quantity);

  return (
    <div className="space-y-3">
      {bundle.displayStyle === "dropdown" ? (
        <div>
          <label htmlFor="bundle-tier" className="mb-2 block text-sm font-semibold text-ink">
            {text.choose}
          </label>
          <select
            id="bundle-tier"
            value={tier.id}
            onChange={(e) => selection.setTierId(e.target.value)}
            className={`${input} min-h-11 cursor-pointer`}
          >
            {bundle.tiers.map((x) => {
              const price = x.prices[variantId];
              return (
                <option key={x.id} value={x.id}>
                  {tierName(x)}
                  {price ? ` — ${money(price.total)}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">{text.choose}</legend>
          <div className={bundle.displayStyle === "cards" ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
            {bundle.tiers.map((x) => {
              const selected = tier.id === x.id;
              const price = x.prices[variantId];
              return (
                <label
                  key={x.id}
                  className={`relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    selected ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
                  }`}
                >
                  <input
                    type="radio"
                    name="bundle-tier"
                    value={x.id}
                    checked={selected}
                    onChange={() => selection.setTierId(x.id)}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{tierName(x)}</span>
                      {x.label && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">{x.label}</span>
                      )}
                      {x.stickerText && (
                        <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
                          {x.stickerText}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                      {price && price.discount > 0 && <span className="text-success">{text.save(money(price.discount))}</span>}
                      {x.freeShipping && <span className="font-medium text-primary">{text.freeShipping}</span>}
                      {price && x.quantity > 1 && (
                        <span className="text-ink-soft">{text.each(money(Math.round(price.total / x.quantity)))}</span>
                      )}
                    </span>
                  </span>
                  {price && (
                    <span className="text-end">
                      <span className="block text-base font-bold text-ink">{money(price.total)}</span>
                      {price.discount > 0 && <span className="block text-xs text-ink-soft line-through">{money(price.full)}</span>}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* A variant for each piece after the first (the first follows the option pickers above). */}
      {hasVariants && tier.quantity > 1 && (
        <fieldset className="rounded-2xl border border-line bg-paper-raised p-3.5">
          <legend className="px-1 text-sm font-semibold text-ink">{text.pickEach}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {selection.unitVariantIds.map((id, index) => (
              <div key={index}>
                <label htmlFor={`bundle-unit-${index}`} className="mb-1 block text-xs font-medium text-ink-soft">
                  {text.piece(index + 1)}
                </label>
                <select
                  id={`bundle-unit-${index}`}
                  value={id}
                  disabled={index === 0}
                  onChange={(e) => selection.setUnitVariant(index, e.target.value)}
                  className={`${input} min-h-11 ${index === 0 ? "opacity-70" : "cursor-pointer"}`}
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={!v.inStock}>
                      {variantLabel(v) || v.sku || text.piece(index + 1)}
                      {v.inStock ? "" : ` — ${text.soldOut}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** Adds every line of the bundle to the cart, one after the other, without clearing what is in it. */
export function BundleAddToCartButton({ selection, disabled }: { selection: BundleSelection; disabled: boolean }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const { addItem, openDrawer } = useCart();
  const { afterAdd } = useCartSheet(openDrawer);
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");

  async function add() {
    if (disabled || status === "loading") return;
    setStatus("loading");
    try {
      for (const line of selection.lines) await addItem(line.variantId, undefined, line.quantity);
      setStatus("added");
      afterAdd();
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void add()} disabled={disabled || status === "loading"} className={`${btnSecondary} w-full`}>
        {status === "added" ? <CheckIcon /> : <CartGlyph />}
        {status === "loading" ? text.adding : status === "added" ? text.added : text.addToCart}
      </button>
      <p aria-live="polite" className="mt-2 text-sm text-danger empty:hidden">
        {status === "error" ? text.addFailed : ""}
      </p>
    </div>
  );
}
