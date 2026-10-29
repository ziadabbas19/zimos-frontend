"use client";

import { useState } from "react";
import { ApiError, type StorefrontCombo } from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { cartErrorMessage } from "@/lib/placeOrder";
import { variantLabel } from "@/lib/product";
import {
  comboImages,
  comboOptionNames,
  comboPriceFor,
  comboSelectionOf,
  comboSoldOut,
  initialComboPicks,
  type ComboPicks,
} from "@/lib/combos";
import { StoreLink } from "../StoreRoute";
import { StoreImage } from "../StoreImage";
import { BoxIcon, CartGlyph, CheckIcon } from "../Icons";
import { btnPrimary, input } from "../ui";
import { comboText } from "./comboText";

/**
 * "Buy it as a combo" on a product's page: one card per combo the product is
 * in (`product.combos`, sent only while the server's combos are on — none,
 * and nothing is drawn). Each card shows what the combo holds, a chooser for
 * every product whose variant the shopper picks, the price for those picks
 * against the products bought apart, and adds the whole combo as one cart
 * line. The cart and the checkout price it again.
 */
export function ProductCombos({ combos }: { combos: StorefrontCombo[] }) {
  const { locale } = useStore();
  const text = comboText(locale);
  if (combos.length === 0) return null;
  return (
    <section aria-labelledby="product-combos-title" className="zt-combos mt-12">
      <h2 id="product-combos-title" className="text-xl font-semibold text-ink">
        {text.title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((combo) => (
          <ComboCard key={combo.id} combo={combo} />
        ))}
      </div>
    </section>
  );
}

/** One combo, drawn as a product card with a "Combo" badge. */
export function ComboCard({ combo }: { combo: StorefrontCombo }) {
  const { locale, money, t } = useStore();
  const text = comboText(locale);
  const { addItem, openDrawer } = useCart();
  const [picks, setPicks] = useState<ComboPicks>(() => initialComboPicks(combo));
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");
  const [error, setError] = useState("");

  const price = comboPriceFor(combo, picks);
  const selection = comboSelectionOf(combo, picks);
  const soldOut = comboSoldOut(combo, picks);
  const images = comboImages(combo);
  const titleId = `combo-${combo.id}-title`;

  async function add() {
    if (!selection || soldOut || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      await addItem({ comboId: combo.id, comboSelection: selection }, undefined, 1);
      setStatus("added");
      openDrawer();
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch (err) {
      setStatus("error");
      // Gone since the page was drawn (archived, or combos switched off): said as such.
      setError(err instanceof ApiError && err.status === 404 ? text.gone : cartErrorMessage(err, t.form.errors, text.addFailed));
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      className="zt-card zt-product zt-combo relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised transition-[border-color,box-shadow] hover:border-primary hover:shadow-lg"
    >
      <div className="zt-combo-media relative aspect-[4/3] overflow-hidden bg-paper">
        {images.length > 0 ? (
          // The combo's own picture, else its products' side by side.
          <div className="flex h-full w-full gap-px bg-line">
            {images.map((src) => (
              <StoreImage
                key={src}
                src={src}
                alt=""
                width={images.length > 1 ? 300 : 600}
                height={450}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                loading="lazy"
                decoding="async"
                className="h-full min-w-0 flex-1 bg-paper object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={48} />
          </div>
        )}
        <span className="absolute start-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">{text.badge}</span>
        {soldOut && (
          <span className="absolute end-3 top-3 rounded-full bg-paper-raised/95 px-2.5 py-1 text-xs font-semibold text-danger">{text.soldOut}</span>
        )}
      </div>

      <div className="zt-product-body flex flex-1 flex-col p-4">
        <h3 id={titleId} className="zt-product-title text-base font-semibold leading-snug text-ink">
          {combo.name}
        </h3>
        {combo.description && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{combo.description}</p>}

        <ul aria-label={text.contents} className="mt-3 space-y-3">
          {combo.items.map((item) => {
            const name = item.product?.name ?? text.missingProduct;
            const selectId = `combo-${combo.id}-${item.id}`;
            const fixedLabel = !item.pickVariant ? variantLabel(item.variants[0]) : "";
            return (
              <li key={item.id} className="text-sm">
                <p className="text-ink">
                  {item.product?.slug ? (
                    <StoreLink href={`/products/${item.product.slug}`} className="font-medium hover:text-primary">
                      {name}
                    </StoreLink>
                  ) : (
                    <span className="font-medium">{name}</span>
                  )}
                  <span className="text-ink-soft"> × {item.quantity}</span>
                </p>
                {fixedLabel && <p className="mt-0.5 text-xs text-ink-soft">{fixedLabel}</p>}
                {item.pickVariant && item.variants.length > 0 && (
                  <>
                    <label htmlFor={selectId} className="sr-only">
                      {text.chooseFor(name)}
                    </label>
                    <select
                      id={selectId}
                      value={picks[item.id] ?? ""}
                      onChange={(e) => setPicks((current) => ({ ...current, [item.id]: e.target.value }))}
                      className={`${input} mt-1.5 min-h-11 cursor-pointer`}
                    >
                      <option value="" disabled>
                        {text.choose(comboOptionNames(item))}
                      </option>
                      {item.variants.map((v) => (
                        <option key={v.id} value={v.id} disabled={!v.inStock}>
                          {variantLabel(v) || v.sku}
                          {v.inStock ? "" : ` — ${text.soldOut}`}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-4">
          <p className="zt-product-price flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-bold text-ink">{money(price.total)}</span>
            {price.saving > 0 && (
              <span className="text-sm text-ink-soft line-through">
                <span className="sr-only">{text.separately} </span>
                {money(price.full)}
              </span>
            )}
          </p>
          {price.saving > 0 && <p className="mt-0.5 text-sm font-medium text-success">{text.save(money(price.saving))}</p>}
          <button type="button" onClick={() => void add()} disabled={!selection || soldOut || status === "loading"} className={`${btnPrimary} mt-3 w-full`}>
            {status === "added" ? <CheckIcon /> : <CartGlyph />}
            {soldOut ? text.soldOut : status === "loading" ? text.adding : status === "added" ? text.added : text.add}
          </button>
          {!soldOut && !selection && <p className="mt-2 text-xs text-ink-soft">{text.pickFirst}</p>}
          <p aria-live="polite" className="mt-2 text-sm text-danger empty:hidden">
            {status === "error" ? error : ""}
          </p>
        </div>
      </div>
    </article>
  );
}
