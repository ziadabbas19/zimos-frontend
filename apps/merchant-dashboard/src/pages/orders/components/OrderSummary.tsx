import { Link } from "react-router-dom";
import { Card, CardContent } from "@store-builder/ui";
import { menuOptionsLabel, type Order, type OrderItem, type ShippingRule } from "@store-builder/api-client";
import { formatMoney, formatOptions } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderLabels } from "../orderLabels";
import { CustomizationList } from "./CustomizationList";
import { OrderAddressTools, OrderContactTools } from "./OrderCustomerTools";
import { ShippingOptionNote } from "./ShippingOptionNote";
import { PreorderLineNote } from "./PreorderLineNote";
import { PREORDERS_ENABLED } from "@/lib/features";
import { HiddenValue, LockedOrderNotice, isHidden, isLockedOrder } from "@/components/OrdersLock";

const STRINGS = {
  en: {
    items: "Items",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    offer: "Offer",
    sku: "SKU",
    bumpBadge: "Checkout add-on",
    upsellBadge: "Extra offer",
    combo: "Combo: {name}",
    comboUnnamed: "Combo",
    comboSaving: "Combo saving: − {amount}",
    linkedOrders: "Extra offers placed as separate orders",
    linkedOrdersHint: "The customer took these funnel offers after this order had left its offers window. They ship free of charge.",
    linkedFrom: "A funnel offer taken after order {order}; its shipping is free.",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    tax: "Tax",
    total: "Total",
    paid: "Paid",
    refunded: "Refunded",
    customer: "Customer",
    altPhone: "Alt",
    shippingAddress: "Shipping address",
    noAddress: "No shipping address",
    note: "Note",
    payment: "Payment",
    internalNotes: "Internal notes",
    riskFlags: "Risk flags",
    cancelUnconfirmedHint:
      "A delivery cancelled in the courier's dashboard still shows as moving there. Check the courier's dashboard; details under Shipments.",
    listSep: ", ",
    rule_no_destination: "No address, so no shipping was charged",
    rule_offer_override: "The offer's own shipping price",
    rule_all_items_free: "Every product in the order ships free",
    rule_free_threshold: "Free: the order reached the free-shipping amount",
    rule_governorate_rate: "The governorate's shipping price",
    rule_profile_rate: "The shipping group's price",
    rule_zone_rate: "Shipping zone rate",
    rule_zone_tier_price: "Zone price for the weight tier",
    rule_default_rate: "Default shipping price",
    rule_no_rate: "No shipping price was set",
    ruleExtras: "{rule} + {amount} in product extra fees",
  },
  ar: {
    items: "العناصر",
    product: "المنتج",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "الإجمالي",
    offer: "العرض",
    sku: "SKU",
    bumpBadge: "إضافة عند الدفع",
    upsellBadge: "عرض إضافي",
    combo: "باقة: {name}",
    comboUnnamed: "باقة",
    comboSaving: "توفير الباقة: − {amount}",
    linkedOrders: "عروض إضافية في طلبات منفصلة",
    linkedOrdersHint: "قبِل العميل هذه العروض من مسار البيع بعد انتهاء نافذة العروض لهذا الطلب. تُشحن بدون رسوم شحن.",
    linkedFrom: "عرض إضافي من مسار البيع بعد الطلب {order}، وشحنه مجاني.",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    shipping: "الشحن",
    tax: "الضريبة",
    total: "الإجمالي",
    paid: "المدفوع",
    refunded: "المسترد",
    customer: "العميل",
    altPhone: "رقم بديل",
    shippingAddress: "عنوان الشحن",
    noAddress: "لا يوجد عنوان شحن",
    note: "ملاحظة",
    payment: "الدفع",
    internalNotes: "ملاحظات داخلية",
    riskFlags: "علامات الاشتباه",
    cancelUnconfirmedHint:
      "شحنة أُلغيت من لوحة تحكم شركة الشحن ما زالت تظهر كأنها تتحرك هناك. راجع لوحة تحكم الشركة؛ التفاصيل في قسم الشحنات.",
    listSep: "، ",
    rule_no_destination: "لا يوجد عنوان، لذلك لم يُحتسب شحن",
    rule_offer_override: "سعر الشحن الخاص بالعرض",
    rule_all_items_free: "كل منتجات الطلب مجانية الشحن",
    rule_free_threshold: "مجاني: بلغ الطلب حد الشحن المجاني",
    rule_governorate_rate: "سعر الشحن الخاص بالمحافظة",
    rule_profile_rate: "سعر مجموعة الشحن",
    rule_zone_rate: "سعر منطقة الشحن",
    rule_zone_tier_price: "سعر المنطقة حسب شريحة الوزن",
    rule_default_rate: "سعر الشحن الافتراضي",
    rule_no_rate: "لم يكن هناك سعر شحن محدد",
    ruleExtras: "{rule} + {amount} رسوم إضافية للمنتجات",
  },
} satisfies Messages;

interface LineGroup {
  key: string;
  /** null: ordinary lines, as they always were. */
  comboKey: string | null;
  name: string | null;
  /** The combo's saving: what the server took off its lines (line_discount_amount). */
  saving: number;
  items: OrderItem[];
}

/**
 * The order's lines in their order, the lines of one combo bought once
 * (sharing a comboKey) gathered where its first line is. An order without a
 * combo is one group holding every line.
 */
function lineGroups(items: readonly OrderItem[]): LineGroup[] {
  const groups: LineGroup[] = [];
  const combos = new Map<string, LineGroup>();
  for (const item of items) {
    const comboKey = item.comboKey ?? null;
    if (comboKey) {
      let group = combos.get(comboKey);
      if (!group) {
        group = { key: `combo:${comboKey}`, comboKey, name: item.comboNameSnapshot ?? null, saving: 0, items: [] };
        combos.set(comboKey, group);
        groups.push(group);
      }
      group.items.push(item);
      group.saving += Number(item.lineDiscountAmount) || 0;
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.comboKey === null) last.items.push(item);
    else groups.push({ key: `lines:${item.id}`, comboKey: null, name: null, saving: 0, items: [item] });
  }
  return groups;
}

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between gap-4 " + (strong ? "text-ink font-medium" : "text-ink-soft")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummary({ order, onChanged }: { order: Order; onChanged?: () => void }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const c = order.currency;
  const address = order.shippingAddressSnapshot;
  // Locked (components/OrdersLock): hidden fields read as hidden; the governorate still shows.
  const locked = isLockedOrder(order);
  const shown = (value: string | null | undefined) => (isHidden(value) ? <HiddenValue /> : value);
  const addressText = address
    ? [address.addressLine, address.city, address.province, address.postalCode, address.country]
        .filter((part) => Boolean(part) && !isHidden(part))
        .join(t.listSep)
    : t.noAddress;

  // A combo's lines sit a step in under its heading.
  const itemRow = (item: OrderItem, inCombo: boolean) => (
    <tr key={item.id} className="border-b border-line last:border-0 align-top">
      <td className={inCombo ? "py-2 ps-3 pe-3" : "py-2 pe-3"}>
        <div className="font-medium text-ink">{item.productNameSnapshot}</div>
        {(item.isOrderBump || item.isUpsell) && (
          <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
            {item.isUpsell ? t.upsellBadge : t.bumpBadge}
          </span>
        )}
        {formatOptions(item.variantOptionsSnapshot) && (
          <div className="text-xs text-ink-soft">
            {formatOptions(item.variantOptionsSnapshot)}
          </div>
        )}
        {/* Menu options the line was sold with (Size, Extras). */}
        {menuOptionsLabel(item.optionsSnapshot) && (
          <div className="text-xs font-medium text-ink">{menuOptionsLabel(item.optionsSnapshot)}</div>
        )}
        {item.offerNameSnapshot && (
          <div className="text-xs text-ink-soft">
            {t.offer}: {item.offerNameSnapshot}
          </div>
        )}
        {item.skuSnapshot && (
          <div className="text-xs text-ink-soft">
            {t.sku}: <bdi dir="ltr">{item.skuSnapshot}</bdi>
          </div>
        )}
        <CustomizationList customizations={item.customizations} className="mt-2" currency={c} />
        {/* Sold beyond stock as a pre-order: when it ships (lib/features). */}
        {PREORDERS_ENABLED && <PreorderLineNote item={item} />}
      </td>
      <td className="py-2 pe-3 text-ink-soft">{item.quantity}</td>
      <td className="py-2 pe-3 text-ink-soft">{formatMoney(item.unitPriceAmount, c)}</td>
      <td className="py-2 text-end text-ink-soft">{formatMoney(item.lineTotalAmount, c)}</td>
    </tr>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Items — every field is the snapshot taken at purchase, not live catalog data. */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-display text-lg font-medium text-ink">{t.items}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.product}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.qty}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.unitPrice}
                  </th>
                  <th scope="col" className="py-2 font-medium text-end">
                    {t.lineTotal}
                  </th>
                </tr>
              </thead>
              {lineGroups(order.items).map((group) =>
                group.comboKey === null ? (
                  <tbody key={group.key} className="border-line [&:not(:first-of-type)]:border-t">
                    {group.items.map((item) => itemRow(item, false))}
                  </tbody>
                ) : (
                  // One combo bought once: its lines under its name, its saving already in their totals.
                  <tbody key={group.key} data-slot="order-combo" className="border-line [&:not(:first-of-type)]:border-t">
                    <tr className="border-b border-line">
                      <th scope="rowgroup" colSpan={4} className="py-2 text-start font-medium">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                          <span className="min-w-0 text-ink">
                            <bdi>{group.name ? fmt(t.combo, { name: group.name }) : t.comboUnnamed}</bdi>
                          </span>
                          {group.saving > 0 && (
                            <span className="text-xs text-success tabular-nums">{fmt(t.comboSaving, { amount: formatMoney(String(group.saving), c) })}</span>
                          )}
                        </div>
                      </th>
                    </tr>
                    {group.items.map((item) => itemRow(item, true))}
                  </tbody>
                )
              )}
            </table>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <AmountRow label={t.subtotal} value={formatMoney(order.subtotalAmount, c)} />
            {Number(order.discountAmount) > 0 && (
              <AmountRow label={t.discount} value={`− ${formatMoney(order.discountAmount, c)}`} />
            )}
            <AmountRow label={t.shipping} value={formatMoney(order.shippingAmount, c)} />
            {order.shippingSnapshot && (
              <p className="text-end text-xs text-ink-soft">
                {order.shippingSnapshot.extraFeesAmount > 0
                  ? fmt(t.ruleExtras, {
                      rule: t[`rule_${order.shippingSnapshot.rule as ShippingRule}`],
                      amount: formatMoney(order.shippingSnapshot.extraFeesAmount, c),
                    })
                  : t[`rule_${order.shippingSnapshot.rule as ShippingRule}`]}
              </p>
            )}
            <ShippingOptionNote order={order} />
            <AmountRow label={t.tax} value={formatMoney(order.taxAmount, c)} />
            <AmountRow label={t.total} value={formatMoney(order.totalAmount, c)} strong />
            {Number(order.amountPaid) > 0 && <AmountRow label={t.paid} value={formatMoney(order.amountPaid, c)} />}
            {Number(order.amountRefunded) > 0 && (
              <AmountRow label={t.refunded} value={formatMoney(order.amountRefunded, c)} />
            )}
          </div>

          {order.linkedFromOrder && (
            <p className="mt-4 rounded-[0.5rem] bg-paper px-3 py-2 text-sm text-ink-soft">
              {t.linkedFrom.split("{order}")[0]}
              <Link to={`/orders/${order.linkedFromOrder.id}`} className="font-medium text-primary hover:underline">
                <bdi dir="ltr">{order.linkedFromOrder.orderNumber}</bdi>
              </Link>
              {t.linkedFrom.split("{order}")[1]}
            </p>
          )}

          {order.linkedOrders && order.linkedOrders.length > 0 && (
            <section className="mt-4 space-y-2 border-t border-line pt-3" aria-labelledby={`linked-${order.id}`}>
              <h3 id={`linked-${order.id}`} className="text-sm font-medium text-ink">
                {t.linkedOrders}
              </h3>
              <p className="text-xs text-ink-soft">{t.linkedOrdersHint}</p>
              <ul className="space-y-1">
                {order.linkedOrders.map((linked) => (
                  <li key={linked.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to={`/orders/${linked.id}`} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                      <bdi dir="ltr">{linked.orderNumber}</bdi>
                    </Link>
                    <span className="text-ink-soft">{formatMoney(linked.totalAmount, linked.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6 text-sm">
          {locked && <LockedOrderNotice order={order} />}
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.customer}</h3>
            <p className="text-ink-soft">{shown(order.contactSnapshot?.fullName) || "—"}</p>
            <p className="text-ink-soft">
              {isHidden(order.contactSnapshot?.phone) ? (
                <HiddenValue />
              ) : order.contactSnapshot?.phone ? (
                <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
              ) : (
                "—"
              )}
            </p>
            {order.contactSnapshot?.alternatePhone && (
              <p className="text-ink-soft">
                {t.altPhone}: {isHidden(order.contactSnapshot.alternatePhone) ? <HiddenValue /> : <bdi dir="ltr">{order.contactSnapshot.alternatePhone}</bdi>}
              </p>
            )}
            {order.contactSnapshot?.email && (
              <p className="break-all text-ink-soft">
                {isHidden(order.contactSnapshot.email) ? <HiddenValue /> : <bdi dir="ltr">{order.contactSnapshot.email}</bdi>}
              </p>
            )}
            {/* Call, WhatsApp, edit: nothing to act on while the details are hidden. */}
            {!locked && <OrderContactTools order={order} onChanged={onChanged} />}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.shippingAddress}</h3>
            <p className="text-ink-soft">
              {addressText}
              {locked && address && (
                <>
                  {addressText ? t.listSep : null}
                  <HiddenValue />
                </>
              )}
            </p>
            {!locked && <OrderAddressTools order={order} />}
            {address?.notes && (
              <p className="text-ink-soft">
                {t.note}: {shown(address.notes)}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.payment}</h3>
            <p className="text-ink-soft">
              {labels.paymentMethod(order.paymentMethod)}
              {order.paymentProvider && ` · ${providerName(order.paymentProvider)}`}
            </p>
          </div>
          {order.notes && (
            <div>
              <h3 className="mb-1 font-medium text-ink">{t.internalNotes}</h3>
              <p className="whitespace-pre-wrap text-ink-soft">{shown(order.notes)}</p>
            </div>
          )}
          {order.riskFlags.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-danger">{t.riskFlags}</h3>
              <ul className="list-inside list-disc text-ink-soft">
                {order.riskFlags.map((flag) => (
                  <li key={flag}>
                    {labels.riskFlag(flag)}
                    {flag === "carrier_cancel_unconfirmed" && (
                      <span className="block ps-5 text-xs">{t.cancelUnconfirmedHint}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
