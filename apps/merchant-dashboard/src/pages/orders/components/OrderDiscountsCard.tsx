import { Link } from "react-router-dom";
import { Card, CardContent } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";

const STRINGS = {
  en: {
    title: "Coupon and discounts",
    coupon: "Coupon {code}",
    automatic: "Automatic discount",
    bundle: "Bundle: {name}",
    bundleHint: "Already taken off the item prices above.",
    combo: "Combo saving",
    comboNamed: "Combo saving: {name}",
    freeShipping: "Free shipping",
    type_percentage: "Percentage",
    type_fixed: "Fixed amount",
    type_free_shipping: "Free shipping",
    copyCode: "Copy code",
    manage: "Manage discounts",
    total: "Total saved",
  },
  ar: {
    title: "الكوبون والخصومات",
    coupon: "كوبون {code}",
    automatic: "خصم تلقائي",
    bundle: "باقة: {name}",
    bundleHint: "مخصوم بالفعل من أسعار المنتجات بالأعلى.",
    combo: "توفير الباقة",
    comboNamed: "توفير الباقة: {name}",
    freeShipping: "شحن مجاني",
    type_percentage: "نسبة مئوية",
    type_fixed: "مبلغ ثابت",
    type_free_shipping: "شحن مجاني",
    copyCode: "نسخ الكود",
    manage: "إدارة الخصومات",
    total: "إجمالي التوفير",
  },
} satisfies Messages;

interface Entry {
  kind?: string;
  code?: string | null;
  automatic?: boolean;
  type?: string;
  name?: string;
  amount?: number | string;
  freeShipping?: boolean;
}

/**
 * The order's coupon (or automatic discount) and its bundle and combo savings,
 * each on its own line (SPEC §4.4 card 8), from the order's discounts snapshot.
 * A bundle's or a combo's saving is already in the item prices; the coupon's is the
 * summary's "Discount". Nothing shows for an order without either.
 */
export function OrderDiscountsCard({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const entries = (Array.isArray(order.discountsSnapshot) ? order.discountsSnapshot : []) as Entry[];
  if (entries.length === 0) return null;
  const c = order.currency;
  const typeLabel = (type?: string) =>
    type === "percentage" || type === "fixed" || type === "free_shipping" ? t[`type_${type}`] : null;
  const saved = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <Link to="/discounts" className="text-sm text-primary hover:underline">
            {t.manage}
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {entries.map((e, i) => {
            // A combo's saving is in its lines' prices too, like a bundle's (combos/comboPricing).
            const combo = e.kind === "combo";
            const bundle = e.kind === "bundle" || combo;
            const label = combo
              ? e.name
                ? fmt(t.comboNamed, { name: e.name })
                : t.combo
              : bundle
              ? fmt(t.bundle, { name: e.name ?? "—" })
              : e.code
                ? fmt(t.coupon, { code: e.code })
                : t.automatic;
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-ink">
                    {e.code ? <bdi dir="ltr">{label}</bdi> : label}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                    {!bundle && typeLabel(e.type) && <span>{typeLabel(e.type)}</span>}
                    {bundle && <span>{t.bundleHint}</span>}
                    {e.freeShipping && <StatusBadge value="free_shipping" tone="success" text={t.freeShipping} />}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {e.code && (
                    <CopyButton
                      value={e.code}
                      label={t.copyCode}
                      labelClassName="sr-only"
                      className="min-h-11 rounded-md border border-line bg-paper-raised px-3 text-sm"
                    />
                  )}
                  <span className="font-medium text-ink">− {formatMoney(String(Number(e.amount) || 0), c)}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {entries.length > 1 && (
          <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
            <span>{t.total}</span>
            <span>− {formatMoney(String(saved), c)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
