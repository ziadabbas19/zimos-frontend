import { ApiError } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderErrorMessage } from "../orderErrors";

/*
 * What the list's documents share — the waybills, the manifests, the invoices,
 * the courier's tracking file: how a PDF is opened and how the API's own
 * refusals for them are worded. The same codes and sentences
 * components/OrderDocuments.tsx has for its buttons; the list now reaches
 * these documents from a menu and from the bulk bar, so it words them here.
 */
const STRINGS = {
  en: {
    NO_SHIPMENTS: "There are no shipments to hand over.",
    TOO_MANY_ORDERS: "At most {maxOrders} orders can be printed at once.",
    BAD_FILE: "This is not an Excel (.xlsx) file.",
    EMPTY_FILE: "The file has no rows under its header.",
    MISSING_COLUMN: "The file needs an order_number column.",
    TOO_MANY_ROWS: "The file has too many rows ({maxRows} at most).",
    ORDER_NOT_FOUND: "No order with this number.",
    UNKNOWN_STATUS: "Unknown status.",
    MISSING_ORDER_NUMBER: "No order number on this row.",
  },
  ar: {
    NO_SHIPMENTS: "لا توجد شحنات للتسليم.",
    TOO_MANY_ORDERS: "تُطبع {maxOrders} طلبًا كحد أقصى في المرة الواحدة.",
    BAD_FILE: "هذا الملف ليس ملف Excel (.xlsx).",
    EMPTY_FILE: "الملف لا يحتوي على صفوف تحت العناوين.",
    MISSING_COLUMN: "الملف يحتاج عمود order_number.",
    TOO_MANY_ROWS: "عدد الصفوف كبير جدًا ({maxRows} كحد أقصى).",
    ORDER_NOT_FOUND: "لا يوجد طلب بهذا الرقم.",
    UNKNOWN_STATUS: "حالة غير معروفة.",
    MISSING_ORDER_NUMBER: "لا يوجد رقم طلب في هذا الصف.",
  },
} satisfies Messages;

type Code = keyof (typeof STRINGS)["en"];

/** The API's limits these sentences name: orders in one print, rows in one tracking file. */
const LIMITS = { maxOrders: 200, maxRows: 2000 };

/** A document's or a file row's error in words; anything it does not know goes to the orders' own wording. */
export function useDocumentError() {
  const t = useT(STRINGS);
  const fallback = useOrderErrorMessage();
  return (err: unknown): string => {
    const code =
      err instanceof ApiError
        ? (err.code as string | undefined)
        : err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;
    if (code && code in t) return fmt(t[code as Code], LIMITS);
    return fallback(err);
  };
}

/** Opens a PDF the API sent in a new tab. */
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
