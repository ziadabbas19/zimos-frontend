import { menuOptionsLabel, type Order } from "@store-builder/api-client";
import { formatOptions } from "@/lib/format";

/** The words on the ticket, in the ticket's language (KitchenTicket.tsx STRINGS). */
export interface TicketWords {
  order: string;
  delivery: string;
  pickup: string;
  notes: string;
  photo: string;
  subtotal: string;
  shipping: string;
  discount: string;
  total: string;
  paid: string;
  toCollect: string;
  cancelled: string;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Every value on the ticket goes through this: a shopper can type anything into a name or a note. */
export const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

export interface TicketContext {
  storeName: string;
  dir: "rtl" | "ltr";
  lang: string;
  words: TicketWords;
  paymentMethod: string;
  financial: string;
  money: (minor: string | number, currency: string) => string;
  date: (iso: string) => string;
}

/**
 * The order as an 80 mm kitchen / till ticket: the store, the order number
 * and time, delivery or pickup, each line with its quantity, variant, menu
 * options and the customer's answers, the order note, the totals and how it
 * is paid. Nothing else — no phone, no address, no email: a ticket lies on a
 * counter. Every value is escaped; the page it makes holds no script.
 */
export function ticketHtml(order: Order, x: TicketContext): string {
  const w = x.words;
  const cod = order.paymentMethod === "cod";
  const lines = order.items
    .map((item) => {
      const variant = formatOptions(item.variantOptionsSnapshot);
      const options = menuOptionsLabel(item.optionsSnapshot);
      const answers = (item.customizations ?? [])
        .map((c) => {
          const label = (x.lang === "ar" ? c.label.ar || c.label.en : c.label.en || c.label.ar) || c.fieldId;
          const answer = c.type === "image" ? w.photo : c.value;
          return answer ? `<div class="sub">${esc(label)}: ${esc(answer)}</div>` : "";
        })
        .join("");
      return `<div class="line">
  <div class="row"><span class="qty">${esc(item.quantity)}×</span><span class="name">${esc(item.productNameSnapshot)}</span><span class="amt">${esc(x.money(item.lineTotalAmount, order.currency))}</span></div>
  ${variant ? `<div class="sub">${esc(variant)}</div>` : ""}
  ${options ? `<div class="sub opt">${esc(options)}</div>` : ""}
  ${answers}
</div>`;
    })
    .join("\n");
  const total = (label: string, minor: string, show = true) =>
    show ? `<div class="row"><span>${esc(label)}</span><span class="amt">${esc(x.money(minor, order.currency))}</span></div>` : "";
  const outstanding = Math.max(0, Number(order.totalAmount) - Number(order.amountPaid || 0));

  return `<!doctype html>
<html lang="${esc(x.lang)}" dir="${x.dir}">
<head>
<meta charset="utf-8">
<title>${esc(w.order)} #${esc(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; padding: 3mm 0; font: 12px/1.35 system-ui, "Segoe UI", Tahoma, Arial, sans-serif; color: #000; background: #fff; }
  h1 { font-size: 14px; margin: 0 0 1mm; text-align: center; }
  .num { font-size: 22px; font-weight: 700; text-align: center; margin: 1mm 0; }
  .meta { text-align: center; }
  .flag { text-align: center; font-weight: 700; border: 2px solid #000; margin: 2mm 0; padding: 1mm; }
  hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
  .line { margin-bottom: 1.5mm; }
  .row { display: flex; gap: 2mm; align-items: baseline; }
  .qty { font-weight: 700; font-size: 14px; min-width: 7mm; }
  .name { flex: 1; font-weight: 600; }
  .amt { margin-inline-start: auto; white-space: nowrap; }
  .sub { padding-inline-start: 9mm; font-size: 11px; }
  .opt { font-weight: 600; }
  .note { font-weight: 600; white-space: pre-wrap; }
  .grand { font-size: 14px; font-weight: 700; }
</style>
</head>
<body>
<h1>${esc(x.storeName)}</h1>
<div class="num">${esc(w.order)} #${esc(order.orderNumber)}</div>
<div class="meta">${esc(x.date(order.createdAt))}</div>
<div class="meta">${esc(order.deliveryMethod === "pickup" ? w.pickup : w.delivery)}${order.contactSnapshot?.fullName ? ` · ${esc(order.contactSnapshot.fullName)}` : ""}</div>
${order.cancelledAt ? `<div class="flag">${esc(w.cancelled)}</div>` : ""}
<hr>
${lines}
${order.notes ? `<hr><div class="note">${esc(w.notes)}: ${esc(order.notes)}</div>` : ""}
<hr>
${total(w.subtotal, order.subtotalAmount)}
${total(w.shipping, order.shippingAmount, Number(order.shippingAmount) > 0)}
${total(w.discount, `-${order.discountAmount}`, Number(order.discountAmount) > 0)}
<div class="row grand"><span>${esc(w.total)}</span><span class="amt">${esc(x.money(order.totalAmount, order.currency))}</span></div>
<hr>
<div class="row"><span>${esc(x.paymentMethod)}</span><span class="amt">${esc(x.financial)}</span></div>
${cod && outstanding > 0 ? `<div class="row grand"><span>${esc(w.toCollect)}</span><span class="amt">${esc(x.money(outstanding, order.currency))}</span></div>` : ""}
</body>
</html>`;
}
