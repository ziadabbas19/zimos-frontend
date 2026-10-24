import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { Order } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useOrderLabels } from "../orderLabels";
import { ticketHtml } from "./kitchenTicketHtml";

const STRINGS = {
  en: {
    print: "Kitchen ticket",
    printing: "Printing…",
    failed: "The ticket could not be printed. Try again.",
    order: "Order",
    delivery: "Delivery",
    pickup: "Pickup from the store",
    notes: "Note",
    photo: "photo on the order page",
    subtotal: "Subtotal",
    shipping: "Delivery",
    discount: "Discount",
    total: "Total",
    paid: "Paid",
    toCollect: "To collect",
    cancelled: "CANCELLED",
  },
  ar: {
    print: "تذكرة المطبخ",
    printing: "جارٍ الطباعة…",
    failed: "تعذّرت طباعة التذكرة. حاول مرة أخرى.",
    order: "طلب",
    delivery: "توصيل",
    pickup: "استلام من المتجر",
    notes: "ملاحظة",
    photo: "صورة في صفحة الطلب",
    subtotal: "المنتجات",
    shipping: "التوصيل",
    discount: "الخصم",
    total: "الإجمالي",
    paid: "مدفوع",
    toCollect: "المطلوب تحصيله",
    cancelled: "ملغي",
  },
} satisfies Messages;

/**
 * Prints `html` from a hidden frame and removes it. The frame is sandboxed
 * without scripts: the dashboard may print it, nothing inside it can run.
 */
function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;inset-inline-start:-9999px;";
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        // print() returns when the dialog closes; a moment more for browsers that return early.
        window.setTimeout(() => frame.remove(), 1000);
      }
    };
    frame.setAttribute("srcdoc", html);
    document.body.appendChild(frame);
  });
}

/** "Kitchen ticket" on the order page: the 80 mm ticket of this order, printed now. */
export function KitchenTicketButton({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const { locale, dir } = useLocale();
  const labels = useOrderLabels();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function print() {
    setBusy(true);
    try {
      await printHtml(
        ticketHtml(order, {
          storeName: currentWorkspace?.name ?? "",
          dir: dir === "rtl" ? "rtl" : "ltr",
          lang: locale,
          words: t,
          paymentMethod: labels.paymentMethod(order.paymentMethod),
          financial: labels.financial(order.financialState),
          money: (minor, currency) => formatMoney(minor, currency),
          date: formatDateTime,
        })
      );
    } catch {
      toast.error(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="min-h-11" onClick={() => void print()} disabled={busy}>
      {busy ? t.printing : t.print}
    </Button>
  );
}
