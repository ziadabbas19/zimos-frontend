"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";

/**
 * The showcase sections' one-tap "add to cart": the same behaviour as the
 * product card's QuickAddButton (add, then open the cart drawer), with the
 * look left to the section's own class and the wording to the merchant.
 */
export function CartButton({
  variantId,
  offerId,
  label,
  className,
  children,
}: {
  variantId: string;
  offerId?: string;
  label: string;
  className: string;
  /** Replaces the text (an icon); `label` then names the button. */
  children?: ReactNode;
}) {
  const { addItem, openDrawer } = useCart();
  const { afterAdd } = useCartSheet(openDrawer);
  const { t } = useStore();
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");

  async function handleClick(e: MouseEvent) {
    // Some of these sit inside a tappable card (a video, a sliding rail).
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

  const text =
    status === "loading"
      ? t.product.adding
      : status === "added"
        ? t.product.added
        : status === "error"
          ? t.product.addFailed
          : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-busy={status === "loading"}
      aria-label={children ? text : undefined}
    >
      {children ?? <span aria-live="polite">{text}</span>}
    </button>
  );
}
