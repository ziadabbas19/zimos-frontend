"use client";

import { useState } from "react";
import { useCart } from "@/lib/CartProvider";

type Status = "idle" | "loading" | "added" | "error";

export function AddToCartButton({
  variantId,
  offerId,
  defaultQuantity = 1,
  disabled = false,
}: {
  variantId: string | undefined;
  offerId?: string;
  defaultQuantity?: number;
  /** e.g. the product/variant is out of stock. */
  disabled?: boolean;
}) {
  const { addItem } = useCart();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const unavailable = disabled || !variantId;

  async function handleClick() {
    if (!variantId || unavailable || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      await addItem(variantId, offerId, defaultQuantity);
      setStatus("added");
      setTimeout(() => setStatus((s) => (s === "added" ? "idle" : s)), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "تعذّر إضافة المنتج للسلة");
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={unavailable || status === "loading"}
        className="cursor-pointer w-full rounded-[0.5rem] bg-primary px-5 py-3 text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {unavailable
          ? "غير متوفر حاليًا"
          : status === "loading"
            ? "جارٍ الإضافة…"
            : "أضف للسلة"}
      </button>

      {status === "added" && (
        <p className="mt-2 text-sm text-primary-dark">تمت الإضافة للسلة ✓</p>
      )}
      {status === "error" && error && (
        <p className="mt-2 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
