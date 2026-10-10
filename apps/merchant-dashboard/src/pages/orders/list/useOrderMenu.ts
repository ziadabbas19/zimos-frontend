import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconArchive, IconCopy, IconOrders, IconPhone, IconSwap, IconUndo, IconWhatsApp } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { copyText, type OrderRowView } from "./orderRow";

const STRINGS = {
  en: {
    open: "Open the order",
    call: "Call",
    whatsapp: "WhatsApp",
    copyPhone: "Copy the number",
    copyOrder: "Copy the order number",
    changeStatus: "Change status",
    archive: "Archive",
    unarchive: "Restore from archive",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    copyFailed: "We couldn't copy that. Try again.",
  },
  ar: {
    open: "فتح الطلب",
    call: "اتصال",
    whatsapp: "واتساب",
    copyPhone: "نسخ الرقم",
    copyOrder: "نسخ رقم الطلب",
    changeStatus: "تغيير الحالة",
    archive: "أرشفة",
    unarchive: "استرجاع من الأرشيف",
    copiedPhone: "تم نسخ رقم العميل",
    copiedOrder: "تم نسخ رقم الطلب",
    copyFailed: "تعذّر النسخ. حاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * The menu of an order's row (right-click, a long press, Shift+F10): open,
 * call, WhatsApp, copy the number, copy the order number, change status,
 * archive. A masked number (010****665) is not one to dial or copy, so the
 * three lines that need the whole number are left out for it.
 */
export function useOrderMenu({
  onOpen,
  onChangeStatus,
  onArchive,
}: {
  /** Open the order's own page. */
  onOpen: (view: OrderRowView) => void;
  /** The list's set-status dialog, for this one order. */
  onChangeStatus: (view: OrderRowView) => void;
  /** Archive it, or bring it back when it already is. */
  onArchive: (view: OrderRowView) => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();

  const copy = async (value: string, done: string) => {
    if (await copyText(value)) toast.success(done);
    else toast.error(t.copyFailed);
  };

  return (view: OrderRowView): ContextMenuItem[] => {
    const { order, phone, whatsapp } = view;
    const items: ContextMenuItem[] = [{ id: "open", label: t.open, icon: IconOrders, onSelect: () => onOpen(view) }];
    if (phone) {
      items.push({
        id: "call",
        label: t.call,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = orderTelHref(phone);
        },
      });
    }
    if (whatsapp) {
      items.push({
        id: "whatsapp",
        label: t.whatsapp,
        icon: IconWhatsApp,
        separatorBefore: !phone,
        onSelect: () => {
          window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
        },
      });
    }
    if (phone) {
      items.push({
        id: "copy-phone",
        label: t.copyPhone,
        icon: IconCopy,
        separatorBefore: true,
        onSelect: () => void copy(phone, t.copiedPhone),
      });
    }
    items.push({
      id: "copy-order",
      label: t.copyOrder,
      icon: IconCopy,
      separatorBefore: !phone,
      onSelect: () => void copy(order.orderNumber, t.copiedOrder),
    });
    items.push({
      id: "status",
      label: t.changeStatus,
      icon: IconSwap,
      separatorBefore: true,
      onSelect: () => onChangeStatus(view),
    });
    items.push(
      view.meta.archivedAt
        ? { id: "unarchive", label: t.unarchive, icon: IconUndo, onSelect: () => onArchive(view) }
        : { id: "archive", label: t.archive, icon: IconArchive, onSelect: () => onArchive(view) }
    );
    return items;
  };
}
