import { buttonVariants, cn } from "@store-builder/ui";
import { IconOrders } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { viewOrder: "View order", viewOrderNumber: "View order {order}" },
  ar: { viewOrder: "عرض الطلب", viewOrderNumber: "عرض الطلب {order}" },
} satisfies Messages;

const SIZE_CLASS = {
  /** Beside a card's big buttons (the confirmation queue). */
  md: "min-h-11 gap-2 rounded-full px-5",
  /** Beside small buttons (a return's approve / reject). */
  sm: "h-8 gap-1.5 rounded-full px-3 pointer-coarse:h-11",
} as const;

/**
 * «عرض الطلب»: the order's page, from a card where the order number used to be
 * the only way there. A link drawn as an outline button with the orders icon,
 * opening in the same tab (a Ctrl / ⌘ click is still the browser's). It is its
 * own element beside the card's buttons, so a press on «Claim», a result or the
 * tick box never reaches it, and a press on it reaches nothing else.
 *
 * Its spoken name adds the order number after the visible words: a list of
 * cards would otherwise read «View order» ten times with nothing to tell them apart.
 */
export function ViewOrderButton({
  orderId,
  orderNumber,
  size = "md",
  className,
}: {
  orderId: string;
  /** Added to the spoken name; left out while the order is not loaded. */
  orderNumber?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const t = useT(STRINGS);
  return (
    <ViewLink
      to={`/orders/${orderId}`}
      data-slot="view-order"
      aria-label={orderNumber ? fmt(t.viewOrderNumber, { order: orderNumber }) : undefined}
      className={cn(buttonVariants({ variant: "outline" }), SIZE_CLASS[size], className)}
    >
      <IconOrders className="size-4" aria-hidden />
      <span className="min-w-0 truncate">{t.viewOrder}</span>
    </ViewLink>
  );
}
