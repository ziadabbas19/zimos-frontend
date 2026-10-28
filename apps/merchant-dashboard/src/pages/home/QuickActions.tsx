import { Link } from "react-router-dom";
import { Globe, PackagePlus, PhoneCall, Plus, ShoppingBag, ShoppingCart, Store, Tag, type LucideIcon } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { findNavItem, isNavItemVisible } from "@/lib/navigation";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Shortcuts",
    newOrder: "New order",
    newProduct: "Add product",
    confirm: "Confirm orders",
    orders: "All orders",
    carts: "Lost orders",
    discount: "Discounts",
    website: "Edit website",
    settings: "Store settings",
    waiting: "{count} waiting",
  },
  ar: {
    title: "اختصارات",
    newOrder: "طلب جديد",
    newProduct: "إضافة منتج",
    confirm: "تأكيد الطلبات",
    orders: "كل الطلبات",
    carts: "الطلبات المفقودة",
    discount: "الخصومات",
    website: "تعديل الموقع",
    settings: "إعدادات المتجر",
    waiting: "{count} في الانتظار",
  },
} satisfies Messages;

type Key = "newOrder" | "newProduct" | "confirm" | "orders" | "carts" | "discount" | "website" | "settings";

const ACTIONS: Array<{ key: Key; to: string; icon: LucideIcon; primary?: boolean }> = [
  { key: "newOrder", to: "/orders/new", icon: Plus, primary: true },
  { key: "newProduct", to: "/catalog/new", icon: PackagePlus },
  { key: "confirm", to: "/confirmation-queue", icon: PhoneCall },
  { key: "orders", to: "/orders", icon: ShoppingBag },
  { key: "carts", to: "/abandoned-carts", icon: ShoppingCart },
  { key: "discount", to: "/discounts", icon: Tag },
  { key: "website", to: "/website", icon: Globe },
  { key: "settings", to: "/store-settings", icon: Store },
];

/**
 * The things a merchant does most, one tap from the home page. A shortcut is
 * left out when the role cannot open the page it leads to.
 */
export function QuickActions({ awaiting }: { awaiting: number | null }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const permissions = currentWorkspace?.permissions;
  const actions = ACTIONS.filter((action) => {
    const item = findNavItem(action.to);
    return !item || isNavItemVisible(item, permissions);
  });

  return (
    <nav aria-label={t.title} className="mt-5">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {actions.map(({ key, to, icon: Icon, primary }) => (
          <li key={key}>
            <Link
              to={to}
              className={
                primary
                  ? "quick-action flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                  : "quick-action flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl border border-line bg-paper-raised/75 p-3 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5 hover:border-primary/50"
              }
            >
              <span className="flex items-center justify-between gap-2">
                <Icon className={primary ? "size-[18px]" : "size-[18px] text-primary"} strokeWidth={1.75} aria-hidden />
                {key === "confirm" && awaiting !== null && awaiting > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent-dark" title={t.waiting.replace("{count}", String(awaiting))}>
                    {awaiting}
                  </span>
                )}
              </span>
              <span className="leading-tight">{t[key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
