"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorefrontProductDetail, WishlistItem } from "@store-builder/api-client";
import { btnGhostDanger, Notice } from "@/components/account/AccountShell";
import { BoxIcon, CartGlyph, CheckIcon } from "@/components/Icons";
import { StoreLink, useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, card, skeleton } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { defaultOfferOf, offerAppliesTo } from "@/lib/product";
import { useShopperApi, type ShopperApi } from "@/lib/shopperSession";
import { storeHref } from "@/lib/storeHref";
import { useStore } from "@/lib/StoreContext";
import { useWishlist, wishlistErrorMessage } from "@/lib/wishlist";
import { HeartIcon } from "./WishlistHeart";
import { StoreImage } from "@/components/StoreImage";

type CartState = { status: "working" | "added" } | { status: "error"; message: string };

/**
 * The API judges a product saved as a whole by its first variant, so a shirt
 * whose first size is sold out reads "unavailable" while another size is in
 * stock. Those items are checked against the product itself, once each: the
 * product (null when it is no longer for sale), or undefined while unknown.
 */
function useWholeProducts(items: WishlistItem[] | undefined, api: ShopperApi) {
  const [products, setProducts] = useState<Record<string, StorefrontProductDetail | null>>({});
  const asked = useRef(new Set<string>());
  const key = (items ?? [])
    .filter((i) => !i.available && i.variantId === null && i.product)
    .map((i) => i.productId)
    .join(",");

  useEffect(() => {
    const ids = key.split(",").filter((id) => id && !asked.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => asked.current.add(id));
    void Promise.all(
      ids.map((id) =>
        api.client.getStorefrontProduct(api.storeId, id).then(
          (p) => [id, p] as const,
          () => [id, null] as const
        )
      )
    ).then((pairs) => setProducts((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [key, api.client, api.storeId]);

  return products;
}

/**
 * «المفضلة», the account's tab: the shopper's saved
 * products, newest first, each with «أضف للسلة» and «شيل من المفضلة». A
 * product no longer for sale stays, greyed, as «مش متاح» until removed.
 * Sits inside AccountShell, which already handled the store's setting, the
 * sign-in and the shopper's details.
 */
export function AccountWishlist() {
  const { t, money } = useStore();
  const w = t.wishlist;
  const wishlist = useWishlist();
  const api = useShopperApi();
  const cart = useCart();
  const router = useRouter();
  const basePath = useStoreBasePath();
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, CartState>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const whole = useWholeProducts(wishlist.list?.items, api);
  const availableOf = (item: WishlistItem) =>
    item.available || Boolean(item.variantId === null && whole[item.productId]?.variants.some((v) => v.inStock));

  async function remove(item: WishlistItem) {
    if (removing) return;
    setRemoving(item.id);
    setMessage(null);
    try {
      await wishlist.remove(item.id);
      setMessage({ tone: "success", text: w.removed });
    } catch (err) {
      setMessage({ tone: "danger", text: wishlistErrorMessage(err, t) });
    } finally {
      setRemoving(null);
    }
  }

  /**
   * A saved variant goes straight in. A product saved as a whole goes in when
   * it has exactly one variant and nothing to fill in, like the cards'
   * one-tap add; anything with options opens its page to choose them.
   */
  async function addToCart(item: WishlistItem) {
    if (adding[item.id]?.status === "working") return;
    const set = (state: CartState | null) =>
      setAdding((prev) => {
        const next = { ...prev };
        if (state) next[item.id] = state;
        else delete next[item.id];
        return next;
      });
    set({ status: "working" });
    try {
      let variantId = item.variantId;
      let offerId: string | undefined;
      if (!variantId) {
        const product = whole[item.productId] ?? (await api.client.getStorefrontProduct(api.storeId, item.productId));
        const only = product.variants.length === 1 ? product.variants[0] : undefined;
        if (!only || !only.inStock || (product.customFields?.length ?? 0) > 0) {
          set(null);
          router.push(storeHref(basePath, `/products/${item.product?.slug ?? item.productId}`));
          return;
        }
        variantId = only.id;
        const offer = defaultOfferOf(product);
        offerId = offer && offerAppliesTo(offer, only.id) ? offer.id : undefined;
      }
      await cart.addItem(variantId, offerId, 1);
      cart.openDrawer();
      set({ status: "added" });
      window.setTimeout(() => {
        setAdding((prev) => {
          if (prev[item.id]?.status !== "added") return prev;
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 2000);
    } catch {
      set({ status: "error", message: t.product.addFailed });
    }
  }

  if (wishlist.status === "error") {
    return (
      <Notice
        tone="danger"
        title={t.account.loadFailed}
        action={
          <button type="button" onClick={wishlist.reload} className={btnPrimary}>
            {t.account.retry}
          </button>
        }
      />
    );
  }

  const items = wishlist.list?.items;
  if (!items) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${skeleton} h-32 w-full`} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center px-5 py-10 text-center`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <HeartIcon size={24} />
        </span>
        <p className="mt-4 text-base font-semibold text-ink">{w.empty}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{w.emptyHint}</p>
        <StoreLink href="/products" className={`${btnPrimary} mt-5`}>
          {t.common.continueShopping}
        </StoreLink>
      </div>
    );
  }

  return (
    <div>
      <div aria-live="polite" className="mb-4 empty:hidden">
        {message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              message.tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      <p className="mb-3 text-sm text-ink-soft">{w.count(items.length)}</p>

      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const href = item.product ? `/products/${item.product.slug}` : null;
          const name = item.product?.name ?? t.account.noLongerAvailable;
          const state = adding[item.id];
          const price = item.price;
          const available = availableOf(item);
          return (
            <li key={item.id} className={`${card} flex gap-3 p-3 sm:p-4`}>
              <Thumb src={item.product?.imageUrl ?? null} href={href} dim={!available} />
              <div className="flex min-w-0 flex-1 flex-col">
                {href ? (
                  <StoreLink
                    href={href}
                    className={`-my-3 block py-3 text-sm font-semibold leading-snug hover:text-primary ${available ? "text-ink" : "text-ink-soft"}`}
                  >
                    <span className="line-clamp-2">{name}</span>
                  </StoreLink>
                ) : (
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink-soft">{name}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {price && (
                    <span className={`text-sm font-bold ${available ? "text-ink" : "text-ink-soft"}`}>
                      {money(price.amount, price.currency)}
                    </span>
                  )}
                  {price?.compareAt && Number(price.compareAt) > Number(price.amount) && (
                    <span className="text-xs text-ink-soft line-through">{money(price.compareAt, price.currency)}</span>
                  )}
                  {!available && (
                    <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink-soft ring-1 ring-line">
                      {w.unavailable}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  {available && (
                    <button
                      type="button"
                      onClick={() => void addToCart(item)}
                      disabled={state?.status === "working"}
                      aria-busy={state?.status === "working" || undefined}
                      className={`${btnPrimary} flex-1 whitespace-nowrap px-4 py-2 sm:flex-none`}
                    >
                      {state?.status === "added" ? <CheckIcon size={18} /> : <CartGlyph size={18} />}
                      {state?.status === "working" ? t.product.adding : state?.status === "added" ? t.product.added : t.product.addToCart}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    disabled={removing === item.id}
                    aria-label={`${w.remove}: ${name}`}
                    className={`${btnGhostDanger} px-3`}
                  >
                    {w.removeShort}
                  </button>
                </div>
                {state?.status === "error" && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {state.message}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Thumb({ src, href, dim }: { src: string | null; href: string | null; dim: boolean }) {
  const body = src ? (
    <StoreImage src={src} alt="" width={96} height={96} sizes="96px" loading="lazy" className={`h-full w-full object-cover ${dim ? "opacity-60 grayscale" : ""}`} />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-primary/40">
      <BoxIcon size={32} />
    </span>
  );
  const frame = "block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper sm:h-24 sm:w-24";
  return href ? (
    <StoreLink href={href} tabIndex={-1} aria-hidden className={frame}>
      {body}
    </StoreLink>
  ) : (
    <span className={frame}>{body}</span>
  );
}
