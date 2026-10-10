import { orderListExtrasOf, type Order, type OrderStage } from "@store-builder/api-client";
import { formatMoney, placeName } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/pages/fraud/RiskBadge";
import { OrderNetworkRate } from "@/pages/fraud/NetworkRate";
import { STAGE_TONE, useOrderLabels } from "../orderLabels";
import { OrderTimelineLines } from "./OrderTimelineLines";
import { useSourceLabel, type OrderColumn } from "./OrderListFilters";

const STRINGS = {
  en: {
    phoneLabel: "Phone",
    pickup: "Pickup from the store",
    moreItems: "+{n} more",
    dq_good: "Good",
    dq_low: "Poor data",
    noShipment: "Not shipped",
    manualCourier: "Manual",
  },
  ar: {
    phoneLabel: "الهاتف",
    pickup: "استلام من المتجر",
    moreItems: "+{n} أخرى",
    dq_good: "جيدة",
    dq_low: "بيانات ضعيفة",
    noShipment: "لم يُشحن",
    manualCourier: "يدوي",
  },
} satisfies Messages;

export interface OrderRow {
  order: Order;
  stageLabel: string | null;
  flagged: boolean;
  meta: { tags: string[]; source: Parameters<ReturnType<typeof useSourceLabel>>[0] };
}

/** One optional column's cell of the orders table, in whatever order the merchant put the columns. */
export function OrderColumnCell({
  column,
  row,
  paymentLabel,
  now,
}: {
  column: OrderColumn;
  row: OrderRow;
  paymentLabel: string;
  now: number;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = useOrderLabels();
  const sourceLabel = useSourceLabel();
  const { order, stageLabel, flagged, meta } = row;
  const extras = orderListExtrasOf(order);
  const address = order.shippingAddressSnapshot;

  switch (column) {
    case "customer":
      return (
        <td className="px-4 py-3 text-ink-soft">
          <div className="text-ink">{order.contactSnapshot?.fullName || "—"}</div>
          {order.contactSnapshot?.phone && (
            <div className="text-xs">
              <span className="sr-only">{t.phoneLabel}: </span>
              <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
            </div>
          )}
        </td>
      );
    case "products": {
      // What was ordered, at a glance: the first lines by name (the API sends no picture of a line).
      const items = order.items ?? [];
      const shown = items.slice(0, 2);
      return (
        <td className="max-w-56 px-4 py-3 text-xs text-ink-soft">
          {items.length === 0 ? (
            "—"
          ) : (
            <>
              {shown.map((item) => (
                <div key={item.id} className="truncate">
                  <bdi className="text-ink">{item.productNameSnapshot}</bdi> × {item.quantity}
                </div>
              ))}
              {items.length > shown.length && <div>{fmt(t.moreItems, { n: items.length - shown.length })}</div>}
            </>
          )}
        </td>
      );
    }
    case "total":
      return <td className="px-4 py-3 text-ink-soft">{formatMoney(order.totalAmount, order.currency)}</td>;
    case "payment":
      return <td className="px-4 py-3 text-xs text-ink-soft">{paymentLabel}</td>;
    case "stage":
      return (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {order.stage && stageLabel && (
              <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage as OrderStage]} text={stageLabel} />
            )}
            {flagged && <StatusBadge value="flagged" tone="danger" text={labels.flagged} />}
            <RiskBadge order={order} />
            <OrderNetworkRate order={order} />
          </div>
        </td>
      );
    case "timeline":
      return (
        <td className="px-4 py-3">
          <OrderTimelineLines order={order} now={now} />
        </td>
      );
    case "tags":
      return (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {meta.tags.length === 0 ? (
              <span className="text-ink-soft">—</span>
            ) : (
              meta.tags.map((tag) => <StatusBadge key={tag} value={tag} tone="info" text={tag} />)
            )}
          </div>
        </td>
      );
    case "source":
      return <td className="px-4 py-3 text-xs text-ink-soft">{sourceLabel(meta.source)}</td>;
    case "governorate":
      return <td className="px-4 py-3 text-xs text-ink-soft">{order.deliveryMethod === "pickup" ? t.pickup : placeName(address?.province) || "—"}</td>;
    case "address":
      return (
        <td className="max-w-56 px-4 py-3 text-xs text-ink-soft">
          {order.deliveryMethod === "pickup" ? (
            <div className="font-medium text-ink">{t.pickup}</div>
          ) : address ? (
            <>
              <div className="text-ink">{[placeName(address.province), placeName(address.city)].filter(Boolean).join(" · ") || "—"}</div>
              {address.addressLine && <div className="line-clamp-2">{address.addressLine}</div>}
            </>
          ) : (
            "—"
          )}
        </td>
      );
    case "shipping": {
      const shipment = extras.shipment;
      return (
        <td className="px-4 py-3 text-xs text-ink-soft">
          {shipment ? (
            <>
              <div className="text-ink">
                {shipment.carrierCode ? providerName(shipment.carrierCode) : t.manualCourier}
              </div>
              {shipment.waybillNumber && (
                <bdi dir="ltr" className="whitespace-nowrap">
                  {shipment.waybillNumber}
                </bdi>
              )}
            </>
          ) : (
            t.noShipment
          )}
        </td>
      );
    }
    case "ipCountry":
      return (
        <td className="px-4 py-3 text-xs text-ink-soft">
          {extras.ipCountry ? (
            <span title={regionName(extras.ipCountry, locale)}>
              <bdi dir="ltr">{extras.ipCountry}</bdi>
            </span>
          ) : (
            "—"
          )}
        </td>
      );
    case "dataQuality":
      return (
        <td className="px-4 py-3 text-xs">
          {extras.dataQuality === "low" ? (
            <StatusBadge value="low_quality" tone="warning" text={t.dq_low} />
          ) : extras.dataQuality === "good" ? (
            <span className="text-ink-soft">{t.dq_good}</span>
          ) : (
            <span className="text-ink-soft">—</span>
          )}
        </td>
      );
  }
}

/** "Egypt" for "EG", in the viewer's language; the code itself when the browser can't say. */
function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
