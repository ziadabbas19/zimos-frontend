"use client";

import { useStore } from "@/lib/StoreContext";
import type { ShippingLine } from "@/lib/useShippingQuote";

/** The value cell of the "Shipping" row in an order summary. */
export function ShippingFee({ line, currency }: { line: ShippingLine; currency?: string }) {
  const { t, money } = useStore();
  switch (line.kind) {
    case "amount":
      return <>{money(line.amount, currency)}</>;
    case "pick_governorate":
      return <>{t.checkout.shippingPickGovernorate}</>;
    case "calculating":
      return <span aria-live="polite">{t.checkout.shippingCalculating}</span>;
    default:
      return <>{t.checkout.shippingOnConfirmation}</>;
  }
}
