import { Card, CardContent } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { formatMoney, formatOptions } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    items: "Items",
    product: "Product",
    qty: "Qty",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    offer: "Offer",
    sku: "SKU",
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
    listSep: ", ",
  },
  ar: {
    items: "العناصر",
    product: "المنتج",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "الإجمالي",
    offer: "العرض",
    sku: "SKU",
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
    listSep: "، ",
  },
} satisfies Messages;

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between gap-4 " + (strong ? "text-ink font-medium" : "text-ink-soft")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const c = order.currency;
  const address = order.shippingAddressSnapshot;
  const addressText = address
    ? [address.addressLine, address.city, address.province, address.postalCode, address.country]
        .filter(Boolean)
        .join(t.listSep)
    : t.noAddress;

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
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-2 pe-3">
                      <div className="font-medium text-ink">{item.productNameSnapshot}</div>
                      {formatOptions(item.variantOptionsSnapshot) && (
                        <div className="text-xs text-ink-soft">
                          {formatOptions(item.variantOptionsSnapshot)}
                        </div>
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
                    </td>
                    <td className="py-2 pe-3 text-ink-soft">{item.quantity}</td>
                    <td className="py-2 pe-3 text-ink-soft">{formatMoney(item.unitPriceAmount, c)}</td>
                    <td className="py-2 text-end text-ink-soft">{formatMoney(item.lineTotalAmount, c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <AmountRow label={t.subtotal} value={formatMoney(order.subtotalAmount, c)} />
            {Number(order.discountAmount) > 0 && (
              <AmountRow label={t.discount} value={`− ${formatMoney(order.discountAmount, c)}`} />
            )}
            <AmountRow label={t.shipping} value={formatMoney(order.shippingAmount, c)} />
            <AmountRow label={t.tax} value={formatMoney(order.taxAmount, c)} />
            <AmountRow label={t.total} value={formatMoney(order.totalAmount, c)} strong />
            {Number(order.amountPaid) > 0 && <AmountRow label={t.paid} value={formatMoney(order.amountPaid, c)} />}
            {Number(order.amountRefunded) > 0 && (
              <AmountRow label={t.refunded} value={formatMoney(order.amountRefunded, c)} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6 text-sm">
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.customer}</h3>
            <p className="text-ink-soft">{order.contactSnapshot?.fullName || "—"}</p>
            <p className="text-ink-soft">
              {order.contactSnapshot?.phone ? <bdi dir="ltr">{order.contactSnapshot.phone}</bdi> : "—"}
            </p>
            {order.contactSnapshot?.alternatePhone && (
              <p className="text-ink-soft">
                {t.altPhone}: <bdi dir="ltr">{order.contactSnapshot.alternatePhone}</bdi>
              </p>
            )}
            {order.contactSnapshot?.email && (
              <p className="break-all text-ink-soft">
                <bdi dir="ltr">{order.contactSnapshot.email}</bdi>
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.shippingAddress}</h3>
            <p className="text-ink-soft">{addressText}</p>
            {address?.notes && (
              <p className="text-ink-soft">
                {t.note}: {address.notes}
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">{t.payment}</h3>
            <p className="text-ink-soft">{labels.paymentMethod(order.paymentMethod)}</p>
          </div>
          {order.notes && (
            <div>
              <h3 className="mb-1 font-medium text-ink">{t.internalNotes}</h3>
              <p className="whitespace-pre-wrap text-ink-soft">{order.notes}</p>
            </div>
          )}
          {order.riskFlags.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-danger">{t.riskFlags}</h3>
              <ul className="list-inside list-disc text-ink-soft">
                {order.riskFlags.map((flag) => (
                  <li key={flag}>{labels.riskFlag(flag)}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
