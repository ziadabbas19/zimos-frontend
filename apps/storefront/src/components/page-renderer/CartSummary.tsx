"use client";

import Link from "next/link";
import { useCart } from "@/lib/CartProvider";

/**
 * The `cart` element. The real cart — quantities, totals, checkout — lives at
 * /store/:workspaceId/cart and is deliberately not duplicated here; this block
 * is the live entry point to it, so a merchant who drops "Cart" onto a page
 * gets a count that is actually theirs rather than a mock.
 */
export function CartSummary({ title, workspaceId }: { title: string; workspaceId: string }) {
  const { itemCount, isLoading } = useCart();

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      {title && <h3 className="font-display text-lg font-medium text-ink">{title}</h3>}
      <p className="mt-1 text-sm text-ink-soft">
        {isLoading
          ? "Loading your cart…"
          : itemCount === 0
            ? "Your cart is empty."
            : `${itemCount} item${itemCount === 1 ? "" : "s"} in your cart.`}
      </p>
      <Link
        href={`/store/${workspaceId}/cart`}
        className="mt-4 inline-flex items-center rounded-[0.5rem] bg-primary px-4 py-2 text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark"
      >
        View cart
      </Link>
    </div>
  );
}
