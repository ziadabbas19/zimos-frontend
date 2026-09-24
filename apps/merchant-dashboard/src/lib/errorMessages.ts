import { useCallback } from "react";
import {
  ApiError,
  apiErrorCode,
  apiErrorDetails,
  type ApiErrorCode,
  type CarrierCancelFailedDetails,
} from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * Translated copy for the backend's stable error codes.
 *
 * Every code the dashboard can meet gets its own sentence here, so a known
 * failure never reaches the merchant as the server's English text or as a
 * generic "something went wrong". Screens that need a sharper message for a
 * code in their own context pass it as an override to `useErrorMessage`.
 *
 * Deliberately absent: CARRIER_ERROR. Its server message is the courier's own
 * words (and may say the delivery could already exist at the courier), so it
 * is shown verbatim — see `VERBATIM_CODES`.
 */
const STRINGS = {
  en: {
    network: "Can't reach the server. Check your connection and try again.",
    generic: "Something went wrong. Please try again.",
    VALIDATION_ERROR: "Some fields need attention. Check the highlighted values and try again.",
    UNAUTHENTICATED: "Your session has ended. Sign in again to continue.",
    FORBIDDEN: "You don't have permission to do that. Ask the store owner to update your role.",
    NOT_FOUND: "We couldn't find that. It may have been deleted.",
    CONFLICT: "This changed in the meantime. Reload and try again.",
    RATE_LIMITED: "Too many requests. Wait a moment and try again.",
    IDEMPOTENCY_KEY_CONFLICT: "This request was already sent. Reload to see the result.",
    INSUFFICIENT_STOCK: "There isn't enough stock for this.",
    DUPLICATE_RESOURCE: "That already exists.",
    INVALID_REFERENCE: "Something this depends on no longer exists. Reload and try again.",
    INTERNAL_SERVER_ERROR: "The server hit an unexpected error. Please try again.",
    ORDER_CANCELLED: "This order is cancelled, so it can't be changed.",
    ORDER_ALREADY_CANCELLED: "This order is already cancelled.",
    ORDER_ALREADY_SHIPPED: "This order has already shipped and can no longer be changed. Open a return instead.",
    ORDER_NOT_CONFIRMED: "Confirm this cash-on-delivery order before booking a courier.",
    ORDER_NOT_PAID: "This prepaid order must be paid before booking a courier.",
    SHIPMENT_ALREADY_EXISTS: "This order already has an active shipment. Cancel it before adding another.",
    CARRIER_NAME_RESERVED: "That's a connected courier's name. Choose the courier's own option to ship with it.",
    SHIPPING_ADDRESS_REQUIRED: "This order has no shipping address. Add one first.",
    ORDER_REJECTED: "This order couldn't be placed.",
    INVALID_PHONE: "Enter a valid phone number.",
    CART_NOT_FOUND: "That cart no longer exists.",
    CART_TOKEN_OR_ITEM_REQUIRED: "There's nothing to check out.",
    STEP_MISMATCH: "This page is out of date. Reload to continue.",
    FUNNEL_PAUSED: "This funnel is paused.",
    PAGE_PATH_RESERVED: "That path is reserved for a built-in store page. Choose a different one.",
    CARRIERS_NOT_CONFIGURED: "Courier integrations aren't available on this server yet. Please contact support.",
    CARRIER_AUTH_FAILED: "The courier rejected the API key. Check it in the courier's dashboard and connect again.",
    CARRIER_PERMISSION_DENIED: "The courier refused this action for the connected API key. Reconnect with a Full Access key.",
    CARRIER_ADDRESS_UNMATCHED: "The order's address couldn't be matched to the courier's list. Choose the city and district.",
    CARRIER_CURRENCY_UNSUPPORTED: "This courier only collects cash in EGP, and this order is in another currency.",
    CARRIER_COD_LIMIT: "The cash-on-delivery amount is above this courier's limit.",
    CARRIER_NOT_CONNECTED: "This courier isn't connected to your store anymore.",
    CARRIER_CANCEL_FAILED: "The courier didn't cancel the shipment, so nothing was changed.",
    CARRIER_CREDENTIALS_UNREADABLE: "The saved courier key can't be read anymore. Connect the courier again.",
    SHIPMENT_NOT_CARRIER_MANAGED: "This shipment wasn't booked through a connected courier.",
    LABEL_NOT_AVAILABLE: "This courier doesn't provide printable labels.",
    cancelFailedPermission:
      "The courier refused to cancel the delivery: the connected API key doesn't have Full Access. The order was not cancelled. Reconnect the courier with a Full Access key under Shipping, or cancel the delivery in the courier's dashboard first.",
    cancelFailedAuth:
      "The courier rejected the saved API key, so the delivery wasn't cancelled and the order is unchanged. Reconnect the courier under Shipping.",
    courierReply: "Courier's reply: {message}",
  },
  ar: {
    network: "تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    VALIDATION_ERROR: "بعض الحقول تحتاج إلى مراجعة. راجع القيم المحددة وحاول مرة أخرى.",
    UNAUTHENTICATED: "انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.",
    FORBIDDEN: "ليست لديك صلاحية للقيام بذلك. اطلب من مالك المتجر تحديث دورك.",
    NOT_FOUND: "لم نعثر على هذا العنصر. ربما تم حذفه.",
    CONFLICT: "تغيّر هذا العنصر في الأثناء. أعد التحميل وحاول مرة أخرى.",
    RATE_LIMITED: "طلبات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
    IDEMPOTENCY_KEY_CONFLICT: "تم إرسال هذا الطلب من قبل. أعد التحميل لرؤية النتيجة.",
    INSUFFICIENT_STOCK: "لا يوجد مخزون كافٍ لذلك.",
    DUPLICATE_RESOURCE: "هذا العنصر موجود بالفعل.",
    INVALID_REFERENCE: "عنصر مرتبط بهذا لم يعد موجودًا. أعد التحميل وحاول مرة أخرى.",
    INTERNAL_SERVER_ERROR: "حدث خطأ غير متوقع في الخادم. حاول مرة أخرى.",
    ORDER_CANCELLED: "هذا الأوردر ملغي، لذلك لا يمكن تعديله.",
    ORDER_ALREADY_CANCELLED: "هذا الأوردر ملغي بالفعل.",
    ORDER_ALREADY_SHIPPED: "تم شحن هذا الأوردر ولم يعد من الممكن تعديله. افتح مرتجعًا بدلًا من ذلك.",
    ORDER_NOT_CONFIRMED: "أكّد أوردر الدفع عند الاستلام قبل حجز شركة الشحن.",
    ORDER_NOT_PAID: "يجب دفع هذا الأوردر المدفوع مسبقًا قبل حجز شركة الشحن.",
    SHIPMENT_ALREADY_EXISTS: "يوجد لهذا الأوردر شحنة نشطة بالفعل. ألغِها قبل إضافة شحنة أخرى.",
    CARRIER_NAME_RESERVED: "هذا اسم شركة شحن يمكن ربطها. اختر خيار الشركة نفسها للشحن معها.",
    SHIPPING_ADDRESS_REQUIRED: "لا يوجد عنوان شحن لهذا الأوردر. أضف عنوانًا أولًا.",
    ORDER_REJECTED: "تعذّر تسجيل هذا الأوردر.",
    INVALID_PHONE: "أدخل رقم هاتف صحيحًا.",
    CART_NOT_FOUND: "هذه السلة لم تعد موجودة.",
    CART_TOKEN_OR_ITEM_REQUIRED: "لا يوجد ما يمكن إتمام شرائه.",
    STEP_MISMATCH: "هذه الصفحة لم تعد محدّثة. أعد التحميل للمتابعة.",
    FUNNEL_PAUSED: "مسار البيع هذا متوقف مؤقتًا.",
    PAGE_PATH_RESERVED: "هذا المسار محجوز لصفحة أساسية في المتجر. اختر مسارًا آخر.",
    CARRIERS_NOT_CONFIGURED: "ربط شركات الشحن غير متاح على هذا الخادم بعد. تواصل مع الدعم.",
    CARRIER_AUTH_FAILED: "رفضت شركة الشحن مفتاح API. تحقق منه في لوحة تحكم الشركة وأعد الربط.",
    CARRIER_PERMISSION_DENIED: "رفضت شركة الشحن هذا الإجراء بالمفتاح المربوط. أعد الربط بمفتاح صلاحياته Full Access.",
    CARRIER_ADDRESS_UNMATCHED: "تعذّرت مطابقة عنوان الأوردر مع قائمة شركة الشحن. اختر المدينة والمنطقة.",
    CARRIER_CURRENCY_UNSUPPORTED: "شركة الشحن هذه تحصّل بالجنيه المصري فقط، وهذا الأوردر بعملة أخرى.",
    CARRIER_COD_LIMIT: "مبلغ الدفع عند الاستلام أعلى من الحد المسموح لشركة الشحن هذه.",
    CARRIER_NOT_CONNECTED: "شركة الشحن هذه لم تعد مربوطة بمتجرك.",
    CARRIER_CANCEL_FAILED: "لم تلغِ شركة الشحن الشحنة، لذلك لم يتم تغيير أي شيء.",
    CARRIER_CREDENTIALS_UNREADABLE: "تعذّرت قراءة مفتاح شركة الشحن المحفوظ. أعد ربط الشركة.",
    SHIPMENT_NOT_CARRIER_MANAGED: "هذه الشحنة لم تُحجز عبر شركة شحن مربوطة.",
    LABEL_NOT_AVAILABLE: "شركة الشحن هذه لا توفر ملصقات قابلة للطباعة.",
    cancelFailedPermission:
      "رفضت شركة الشحن إلغاء الشحنة لأن مفتاح API المربوط ليس بصلاحية Full Access. لم يتم إلغاء الأوردر. أعد ربط الشركة بمفتاح Full Access من صفحة الشحن، أو ألغِ الشحنة من لوحة تحكم الشركة أولًا.",
    cancelFailedAuth:
      "رفضت شركة الشحن مفتاح API المحفوظ، لذلك لم تُلغَ الشحنة ولم يتغير الأوردر. أعد ربط الشركة من صفحة الشحن.",
    courierReply: "رد شركة الشحن: {message}",
  },
} satisfies Messages;

type CodeKey = Exclude<
  keyof typeof STRINGS.en,
  "network" | "generic" | "cancelFailedPermission" | "cancelFailedAuth" | "courierReply"
>;
const OWN_KEYS: ReadonlySet<string> = new Set(["network", "generic", "cancelFailedPermission", "cancelFailedAuth", "courierReply"]);

/** Codes whose server message is shown as-is, never replaced. */
const VERBATIM_CODES: ReadonlySet<string> = new Set<ApiErrorCode>(["CARRIER_ERROR"]);

export type ErrorOverrides = Partial<Record<ApiErrorCode, string>>;

function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0 || err.message === "Failed to fetch";
  return err instanceof TypeError && /fetch/i.test(err.message);
}

/**
 * Returns `(err, overrides?) => message` in the active language.
 *
 * Order of precedence: a per-call override for the code, the shared
 * translation, the server's own message for verbatim/unknown codes, then a
 * generic sentence. A plain `Error` thrown by our own code (already
 * translated by whoever threw it) passes through unchanged.
 */
export function useErrorMessage() {
  const t = useT(STRINGS);
  return useCallback(
    (err: unknown, overrides?: ErrorOverrides): string => {
      if (isNetworkError(err)) return t.network;
      const code = apiErrorCode(err);
      if (code) {
        const override = overrides?.[code];
        if (override) return override;
        if (VERBATIM_CODES.has(code) && err instanceof ApiError && err.message) return err.message;
        if (code === "CARRIER_CANCEL_FAILED") {
          // Only order cancellation raises it. The courier-side cause decides
          // what the merchant can do next; the courier's own words come along
          // for anything we can't name.
          const cause = apiErrorDetails<CarrierCancelFailedDetails>(err)?.carrierErrorCode;
          if (cause === "CARRIER_PERMISSION_DENIED") return t.cancelFailedPermission;
          if (cause === "CARRIER_AUTH_FAILED") return t.cancelFailedAuth;
          const reply = err instanceof ApiError ? err.message : "";
          return reply ? `${t.CARRIER_CANCEL_FAILED} ${fmt(t.courierReply, { message: reply })}` : t.CARRIER_CANCEL_FAILED;
        }
        if (code in t && !OWN_KEYS.has(code)) return t[code as CodeKey];
      }
      if (err instanceof ApiError) {
        if (err.status === 403) return t.FORBIDDEN;
        // An unknown code: the server's sentence beats saying nothing useful.
        return err.message || t.generic;
      }
      if (err instanceof Error && err.message) return err.message;
      return t.generic;
    },
    [t]
  );
}
