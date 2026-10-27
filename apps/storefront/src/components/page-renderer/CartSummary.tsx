"use client";

import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary } from "@/components/ui";
import { useCart } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { StoreLoader } from "@/components/StoreLoader";

/**
 * The `cart` element. The real cart — quantities, totals, checkout — lives on
 * the store’s own /cart page and is deliberately not duplicated here; this block
 * is the live entry point to it, so a merchant who drops "Cart" onto a page
 * gets a count that is actually theirs rather than a mock.
 */
export function CartSummary({ title }: { title: string }) {
  const { itemCount, isLoading } = useCart();
  const { t } = useStore();

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-5">
      <h3 className="text-lg font-semibold text-ink">{title || t.renderer.yourCart}</h3>
      <p className="mt-1 text-sm text-ink-soft">
        {isLoading
          ? <StoreLoader size="sm" label={t.renderer.cartLoading} className="inline-block align-middle" />
          : itemCount === 0
            ? t.renderer.cartEmpty
            : t.renderer.cartCount(itemCount)}
      </p>
      <StoreLink href="/cart" className={`${btnPrimary} mt-4`}>
        {t.renderer.viewCart}
      </StoreLink>
    </div>
  );
}
