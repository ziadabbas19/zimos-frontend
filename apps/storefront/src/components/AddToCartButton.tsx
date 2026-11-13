"use client";

import { useState } from "react";
import type { CustomizationInput } from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";
import { cartErrorMessage } from "@/lib/placeOrder";
import { CartGlyph, CheckIcon } from "./Icons";
import { btnPrimary, btnSecondary } from "./ui";

type Status = "idle" | "loading" | "added" | "error";

export function AddToCartButton({
  variantId,
  offerId,
  defaultQuantity = 1,
  disabled = false,
  variant = "primary",
  className = "",
  customizations,
  options,
  beforeAdd,
  onAddError,
}: {
  variantId: string | undefined;
  offerId?: string;
  defaultQuantity?: number;
  /** e.g. the product/variant is out of stock. */
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  /** Answers to the product's custom fields, sent with the line. */
  customizations?: CustomizationInput;
  /** Menu options picked (Size, Extras). */
  options?: import("@store-builder/api-client").MenuOptionsInput;
  /** Runs first; false stops the add (e.g. a required custom field is empty — it says so itself). */
  beforeAdd?: () => boolean;
  /** Gets a failed add first; true when it showed the problem itself. */
  onAddError?: (err: unknown) => boolean;
}) {
  const { addItem, openDrawer } = useCart();
  const { afterAdd } = useCartSheet(openDrawer);
  const { t } = useStore();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const unavailable = disabled || !variantId;

  async function handleClick() {
    if (!variantId || unavailable || status === "loading") return;
    if (beforeAdd && !beforeAdd()) return;
    setStatus("loading");
    setError(null);
    try {
      await addItem(variantId, offerId, defaultQuantity, customizations, options);
      setStatus("added");
      // The cart sheet opens when the merchant wants it to (Settings → Cart,
      // lib/cartSheet); either way the button says "added" and the header's
      // count moves, so the shopper knows without leaving the page.
      afterAdd();
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch (err) {
      if (onAddError && onAddError(err)) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(cartErrorMessage(err, t.form.errors, t.product.addFailed));
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={unavailable || status === "loading"}
        className={`${variant === "primary" ? btnPrimary : btnSecondary} w-full`}
      >
        {status === "added" ? <CheckIcon /> : <CartGlyph />}
        {unavailable
          ? t.product.unavailable
          : status === "loading"
            ? t.product.adding
            : status === "added"
              ? t.product.added
              : t.product.addToCart}
      </button>
      <p aria-live="polite" className="mt-2 min-h-0 text-sm text-danger empty:hidden">
        {status === "error" && error ? error : ""}
      </p>
    </div>
  );
}
