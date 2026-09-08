"use client";

import Link from "next/link";
import { useCart } from "@/lib/CartProvider";

export function CartIcon({ workspaceId }: { workspaceId: string }) {
  const { itemCount } = useCart();

  return (
    <Link
      href={`/store/${workspaceId}/cart`}
      aria-label={itemCount > 0 ? `عربة التسوق — ${itemCount} عنصر` : "عربة التسوق"}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink transition-colors hover:border-primary hover:text-primary-dark"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-paper-raised">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
