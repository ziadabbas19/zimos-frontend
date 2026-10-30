"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { ApiError, storefrontCompare, type StorefrontCompare, type StorefrontProduct } from "@store-builder/api-client";
import { BoxIcon, CrossIcon } from "@/components/Icons";
import { QuickAddButton } from "@/components/QuickAddButton";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, container, focusRing, skeleton } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCompareList } from "@/lib/compareList";
import { pickText } from "@/lib/i18n";
import { defaultOfferOf, firstImage, offerAppliesTo, priceOf } from "@/lib/product";
import { useStore } from "@/lib/StoreContext";
import { useIsClient } from "@/lib/useIsClient";
import { SPEC_TEXT, specName, specValue } from "./specText";
import { StoreImage } from "@/components/StoreImage";

/**
 * The compare page (/compare, frontend-): the products of the
 * shopper's compare list as columns and the store's specifications as rows,
 * with «اعرض الاختلافات بس» to keep only the rows where they differ, and an
 * add-to-cart under each product. The list lives in this browser
 * (lib/compareList); the table itself is the server's (GET /specs/compare) —
 * which keys to show, in what order, and which of them differ.
 */
export function ComparePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { locale, money, store, t } = useStore();
  const text = pickText(SPEC_TEXT, locale);
  const list = useCompareList(store?.id);
  const isClient = useIsClient();
  const toggleId = useId();
  // Our client reads the shopper's language itself; a new one when the language changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => createStorefrontApiClient(), [locale]);

  const ids = list.items.map((p) => p.id);
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; data: StorefrontCompare | null; failed: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [gone, setGone] = useState(false);
  const { remove, clear } = list;

  useEffect(() => {
    if (ids.length < 2) return;
    let alive = true;
    storefrontCompare(client, workspaceId, ids)
      .then((data) => {
        if (!alive) return;
        // A product that is no longer sold comes back missing: it leaves the list too.
        const found = new Set(data.products.map((p) => p.product.id));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length > 0) {
          setGone(true);
          missing.forEach(remove);
          return;
        }
        setState({ key, data, failed: false });
      })
      .catch((err) => {
        if (!alive) return;
        // Fewer than two of them are still sold, and the answer does not say which: the list starts over.
        if (err instanceof ApiError && err.status === 404) {
          setGone(true);
          clear();
          return;
        }
        setState({ key, data: null, failed: true });
      });
    return () => {
      alive = false;
    };
    // `key` stands for `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, workspaceId, key, nonce, remove, clear]);

  const shell = (children: ReactNode) => (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{text.pageTitle}</h1>
      {gone && (
        <p role="status" className="mt-4 rounded-xl bg-paper-raised px-4 py-3 text-sm text-ink ring-1 ring-line">
          {text.gone}
        </p>
      )}
      {children}
    </main>
  );

  if (!isClient) {
    return shell(
      <div className={`${card} mt-6 space-y-4 p-5`} role="status" aria-busy="true" aria-label={text.loading}>
        <span className={`${skeleton} block h-5 w-1/2`} />
        <span className={`${skeleton} block h-5 w-2/3`} />
        <span className={`${skeleton} block h-5 w-1/3`} />
      </div>
    );
  }

  if (ids.length < 2) {
    const only = list.items[0];
    return shell(
      <div className={`${card} mt-6 flex flex-col items-center px-6 py-14 text-center`}>
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BoxIcon size={32} />
        </span>
        <p className="mt-4 text-lg font-semibold text-ink">{text.emptyTitle}</p>
        <p className="mt-1 max-w-md text-sm text-ink-soft">{only ? text.oneBody : text.emptyBody}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {only && (
            <StoreLink href={`/products/${only.slug}`} className={btnSecondary}>
              <bdi>{only.name}</bdi>
            </StoreLink>
          )}
          <StoreLink href="/products" className={btnPrimary}>
            {text.browse}
          </StoreLink>
        </div>
      </div>
    );
  }

  const current = state?.key === key ? state : null;
  if (!current) {
    return shell(
      <div className={`${card} mt-6 space-y-4 p-5`} role="status" aria-busy="true" aria-label={text.loading}>
        <span className={`${skeleton} block h-24 w-full`} />
        <span className={`${skeleton} block h-5 w-2/3`} />
        <span className={`${skeleton} block h-5 w-1/2`} />
      </div>
    );
  }
  if (current.failed || !current.data) {
    return shell(
      <div className={`${card} mt-6 px-6 py-12 text-center`} role="alert">
        <p className="text-sm text-ink-soft">{text.failed}</p>
        <button
          type="button"
          className={`${btnPrimary} mt-5`}
          onClick={() => {
            setState(null);
            setNonce((n) => n + 1);
          }}
        >
          {text.retry}
        </button>
      </div>
    );
  }

  const { keys, products } = current.data;
  const differing = keys.filter((k) => k.differs);
  const rows = differencesOnly ? differing : keys;

  return shell(
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={toggleId} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink has-[:disabled]:cursor-default has-[:disabled]:text-ink-soft">
          <input
            id={toggleId}
            type="checkbox"
            checked={differencesOnly}
            // Nothing to narrow down when no row differs (or there are no rows).
            disabled={differing.length === 0}
            onChange={(e) => setDifferencesOnly(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)] disabled:cursor-default"
          />
          {text.differencesOnly}
        </label>
        <button type="button" onClick={clear} className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-medium text-ink-soft hover:text-danger ${focusRing}`}>
          {text.clear}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-10 w-32 min-w-28 bg-paper-raised px-3 py-3 text-start align-bottom text-xs font-semibold text-ink-soft sm:w-44 sm:px-4">
                {text.spec}
              </th>
              {products.map(({ product }) => (
                <th key={product.id} scope="col" className="min-w-40 border-s border-line px-3 py-4 text-start align-top font-normal sm:px-4">
                  <ProductHead product={product} onRemove={() => list.remove(product.id)} removeLabel={text.removeName(product.name)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <th scope="row" className="sticky start-0 z-10 bg-paper-raised px-3 py-3 text-start font-medium text-ink-soft sm:px-4">
                {text.price}
              </th>
              {products.map(({ product }) => {
                const price = priceOf(product);
                return (
                  <td key={product.id} className="border-s border-line px-3 py-3 text-base font-bold text-ink sm:px-4">
                    {price === undefined ? text.none : money(price)}
                  </td>
                );
              })}
            </tr>
            {rows.map((k) => (
              <tr key={k.id} className="border-t border-line">
                <th scope="row" className="sticky start-0 z-10 bg-paper-raised px-3 py-3 text-start font-medium text-ink-soft sm:px-4">
                  <bdi>{specName(k.name, locale)}</bdi>
                </th>
                {products.map(({ product, values }) => (
                  <td key={product.id} className={`border-s border-line px-3 py-3 sm:px-4 ${k.differs ? "font-semibold text-ink" : "text-ink"}`}>
                    {values[k.id] ? <bdi>{specValue(values[k.id], k.unit)}</bdi> : <span className="text-ink-soft">{text.none}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <th scope="row" className="sticky start-0 z-10 bg-paper-raised px-3 py-3 sm:px-4">
                <span className="sr-only">{text.addToCart}</span>
              </th>
              {products.map(({ product }) => (
                <td key={product.id} className="border-s border-line px-3 pb-4 sm:px-4">
                  <CompareAction product={product} addLabel={t.product.addToCart} viewLabel={text.viewProduct} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-ink-soft empty:hidden">{keys.length === 0 ? text.noSpecs : differencesOnly && rows.length === 0 ? text.allSame : ""}</p>
    </>
  );
}

/** A compared product's column head: its picture and name (a link to its page), and the way out of the comparison. */
function ProductHead({ product, onRemove, removeLabel }: { product: StorefrontProduct; onRemove: () => void; removeLabel: string }) {
  const image = firstImage(product);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className={`absolute -top-2 end-0 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:text-danger ${focusRing}`}
      >
        <CrossIcon size={16} />
      </button>
      <div className="h-24 w-24 overflow-hidden rounded-xl border border-line bg-paper">
        {image ? (
          <StoreImage src={image} alt="" width={96} height={96} sizes="96px" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={32} />
          </div>
        )}
      </div>
      <StoreLink href={`/products/${product.slug}`} className="mt-2 line-clamp-2 block text-sm font-semibold text-ink hover:text-primary">
        <bdi>{product.name}</bdi>
      </StoreLink>
    </div>
  );
}

/** Under a column: one tap into the cart for a product with nothing to choose, else the way to its page. */
function CompareAction({ product, addLabel, viewLabel }: { product: StorefrontProduct; addLabel: string; viewLabel: string }) {
  const only = product.variants.length === 1 ? product.variants[0] : undefined;
  const quickAdd = only && only.inStock && !(product.customFields && product.customFields.length > 0) ? only : undefined;
  const offer = quickAdd ? defaultOfferOf(product) : undefined;
  if (quickAdd) {
    return <QuickAddButton variantId={quickAdd.id} offerId={offer && offerAppliesTo(offer, quickAdd.id) ? offer.id : undefined} label={addLabel} />;
  }
  return (
    <StoreLink href={`/products/${product.slug}`} className={`${btnSecondary} mt-4 w-full`}>
      {viewLabel}
    </StoreLink>
  );
}
