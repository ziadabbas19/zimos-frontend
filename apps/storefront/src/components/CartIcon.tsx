"use client";

import { StoreLink } from "@/components/StoreRoute";
import { useCart } from "@/lib/CartProvider";
import { useCartSheet } from "@/lib/cartSheet";
import { useStore } from "@/lib/StoreContext";
import { CartGlyph } from "./Icons";
import { iconBtn } from "./ui";

/**
 * The header's cart control with its live count. It is a link to the cart
 * page — that is where it goes without JavaScript and where a middle-click
 * opens — but while the merchant has the cart icon open the cart sheet (the
 * default; Store settings → Cart behavior, lib/cartSheet) a plain tap opens the sheet
 * instead, so the shopper never leaves the page they were on. On the cart and
 * checkout pages themselves the sheet would only repeat the page, so there
 * the link goes through.
 */
export function CartIcon() {
  const { itemCount, openDrawer } = useCart();
  const { onCartLinkClick } = useCartSheet(openDrawer);
  const { t, intlLocale } = useStore();

  return (
    <StoreLink
      href="/cart"
      onClick={onCartLinkClick}
      aria-label={itemCount > 0 ? t.common.cartWithCount(itemCount) : t.common.cart}
      className={iconBtn}
    >
      <CartGlyph />
      {itemCount > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-on-primary">
          {new Intl.NumberFormat(intlLocale).format(itemCount)}
        </span>
      )}
    </StoreLink>
  );
}
