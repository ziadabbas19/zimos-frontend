import { useId } from "react";
import { Label } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatKg } from "@/lib/weight";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useTierLabel } from "@/pages/shipping/weightTiers";

const STRINGS = {
  en: {
    weight: "Order weight",
    weightValue: "{kg} kg",
    unknown: "Unknown",
    estimated: "Estimated",
    estimatedHint: "Some items have no weight; your default item weight was used for them.",
    tier: "Weight tier",
    noTier: "No tier",
    overLastTier: "Heavier than your last tier — charged and booked as the last tier.",
    bookAs: "Book as",
    orderTier: "Order's tier ({label})",
    orderTierNone: "Store default package",
    unmapped: "This tier has no package mapped for {carrier}. Choose another tier, or map it in the {carrier} settings.",
  },
  ar: {
    weight: "وزن الأوردر",
    weightValue: "{kg} كجم",
    unknown: "غير معروف",
    estimated: "تقديري",
    estimatedHint: "بعض المنتجات ليس لها وزن، فاستُخدم الوزن الافتراضي للمنتج بدلًا منه.",
    tier: "شريحة الوزن",
    noTier: "بدون شريحة",
    overLastTier: "أثقل من آخر شريحة — اتحسب واتحجز كآخر شريحة.",
    bookAs: "الحجز كـ",
    orderTier: "شريحة الأوردر ({label})",
    orderTierNone: "نوع الطرد الافتراضي للمتجر",
    unmapped: "هذه الشريحة ليس لها نوع طرد مربوط في {carrier}. اختر شريحة أخرى، أو اربطها من إعدادات {carrier}.",
  },
} satisfies Messages;

/**
 * The order's weight and tier on the courier booking form, with a tier
 * override. `value` "" books with the order's own tier.
 */
export function BookingWeightField({
  order,
  carrierName,
  value,
  onChange,
  unmapped,
  disabled,
}: {
  order: Order;
  carrierName: string;
  value: string;
  onChange: (tierId: string) => void;
  unmapped: boolean;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const tierLabel = useTierLabel();
  const workspaceId = useWorkspaceId();
  const selectId = useId();
  // Needs shipping.manage; without it the weight still shows, just no override.
  const tiers = useAsync(() => apiClient.getWeightTiers(workspaceId).then((s) => s.tiers), [workspaceId]);

  const snapshot = order.weightTierSnapshot ?? null;
  const overLast = Boolean(snapshot?.flags?.includes("weight_over_last_tier"));
  const weight = order.totalWeightGrams;
  const tierList = tiers.data ?? [];

  return (
    <div className="space-y-3 rounded-[0.5rem] border border-line p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-ink-soft">{t.weight}</p>
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
            {weight === null || weight === undefined ? t.unknown : fmt(t.weightValue, { kg: formatKg(weight) })}
            {order.weightEstimated && (
              <span title={t.estimatedHint}>
                <StatusBadge value="estimated" tone="warning" text={t.estimated} />
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{t.tier}</p>
          <p className="font-medium text-ink">{snapshot ? tierLabel(snapshot) : t.noTier}</p>
        </div>
      </div>
      {overLast && <p className="text-xs text-accent-dark">{t.overLastTier}</p>}

      {tierList.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor={selectId}>{t.bookAs}</Label>
          <Select
            id={selectId}
            className="h-11"
            value={value}
            disabled={disabled}
            aria-invalid={unmapped || undefined}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{snapshot ? fmt(t.orderTier, { label: tierLabel(snapshot) }) : t.orderTierNone}</option>
            {tierList.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tierLabel(tier)}
              </option>
            ))}
          </Select>
          {unmapped && <p className="text-xs font-medium text-danger">{fmt(t.unmapped, { carrier: carrierName })}</p>}
        </div>
      )}
    </div>
  );
}
