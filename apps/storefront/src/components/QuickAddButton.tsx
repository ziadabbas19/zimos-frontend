"use client";

import { useState, type MouseEvent } from "react";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";
import { CartGlyph, CheckIcon } from "./Icons";
import { focusRing } from "./ui";

/**
 * The one-tap "add to cart" on a product card, for a product with a single
 * variant: nothing to choose, so it goes straight into the cart and the
 * drawer opens — the shopper stays on the grid. Sits above the card's
 * stretched link (`relative z-10`) so the tap does not also open the product.
 *
 * A product with options gets no such button; its card says "choose options"
 * and the whole card still opens the product page.
 */
export function QuickAddButton({
  variantId,
  offerId,
  label,
}: {
  variantId: string;
  offerId?: string;
  label: string;
}) {
  const { addItem, openDrawer } = useCart();
  const { afterAdd } = useCartSheet(openDrawer);
  const { t } = useStore();
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");

  async function handleClick(e: MouseEvent) {
    // The card behind is one big link; this tap is the button's alone.
    e.preventDefault();
    e.stopPropagation();
    if (status === "loading") return;
    setStatus("loading");
    try {
      await addItem(variantId, offerId, 1);
      setStatus("added");
      afterAdd();
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus((s) => (s === "error" ? "idle" : s)), 3000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      aria-busy={status === "loading"}
      className={`zt-btn zt-btn-primary relative z-10 mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
    >
      {status === "added" ? <CheckIcon size={18} /> : <CartGlyph size={18} />}
      <span aria-live="polite">
        {status === "loading"
          ? t.product.adding
          : status === "added"
            ? t.product.added
            : status === "error"
              ? t.product.addFailed
              : label}
      </span>
    </button>
  );
}
