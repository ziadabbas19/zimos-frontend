import { Card, CardContent } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { formatAddress, formatMoney, formatOptions, humanize } from "@/lib/format";

function AmountRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between " + (strong ? "text-ink font-medium" : "text-ink-soft")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  const c = order.currency;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Items — every field is the snapshot taken at purchase, not live catalog data. */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-display text-lg font-medium text-ink">Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Unit price</th>
                  <th className="py-2 font-medium text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-ink">{item.productNameSnapshot}</div>
                      {formatOptions(item.variantOptionsSnapshot) && (
                        <div className="text-xs text-ink-soft">
                          {formatOptions(item.variantOptionsSnapshot)}
                        </div>
                      )}
                      {item.offerNameSnapshot && (
                        <div className="text-xs text-ink-soft">Offer: {item.offerNameSnapshot}</div>
                      )}
                      {item.skuSnapshot && (
                        <div className="text-xs text-ink-soft">SKU: {item.skuSnapshot}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{item.quantity}</td>
                    <td className="py-2 pr-3 text-ink-soft">
                      {formatMoney(item.unitPriceAmount, c)}
                    </td>
                    <td className="py-2 text-right text-ink-soft">
                      {formatMoney(item.lineTotalAmount, c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <AmountRow label="Subtotal" value={formatMoney(order.subtotalAmount, c)} />
            {Number(order.discountAmount) > 0 && (
              <AmountRow label="Discount" value={`− ${formatMoney(order.discountAmount, c)}`} />
            )}
            <AmountRow label="Shipping" value={formatMoney(order.shippingAmount, c)} />
            <AmountRow label="Tax" value={formatMoney(order.taxAmount, c)} />
            <AmountRow label="Total" value={formatMoney(order.totalAmount, c)} strong />
            {Number(order.amountPaid) > 0 && (
              <AmountRow label="Paid" value={formatMoney(order.amountPaid, c)} />
            )}
            {Number(order.amountRefunded) > 0 && (
              <AmountRow label="Refunded" value={formatMoney(order.amountRefunded, c)} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6 text-sm">
          <div>
            <h3 className="mb-1 font-medium text-ink">Customer</h3>
            <p className="text-ink-soft">{order.contactSnapshot?.fullName || "—"}</p>
            <p className="text-ink-soft">{order.contactSnapshot?.phone || "—"}</p>
            {order.contactSnapshot?.alternatePhone && (
              <p className="text-ink-soft">Alt: {order.contactSnapshot.alternatePhone}</p>
            )}
            {order.contactSnapshot?.email && (
              <p className="text-ink-soft">{order.contactSnapshot.email}</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">Shipping address</h3>
            <p className="text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
            {order.shippingAddressSnapshot?.notes && (
              <p className="text-ink-soft">Note: {order.shippingAddressSnapshot.notes}</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink">Payment</h3>
            <p className="text-ink-soft">{humanize(order.paymentMethod)}</p>
          </div>
          {order.notes && (
            <div>
              <h3 className="mb-1 font-medium text-ink">Internal notes</h3>
              <p className="whitespace-pre-wrap text-ink-soft">{order.notes}</p>
            </div>
          )}
          {order.riskFlags.length > 0 && (
            <div>
              <h3 className="mb-1 font-medium text-danger">Risk flags</h3>
              <p className="text-ink-soft">{order.riskFlags.map(humanize).join(", ")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
