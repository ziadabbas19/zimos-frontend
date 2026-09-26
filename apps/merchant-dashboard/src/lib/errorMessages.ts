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
import { providerName } from "@/lib/providers";

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
    ORDER_NOT_COD: "Only cash-on-delivery orders are confirmed by phone.",
    ORDER_ALREADY_CONFIRMED: "This order is already confirmed.",
    TASK_ALREADY_LOCKED: "Another agent is working on this order right now.",
    TASK_ALREADY_DONE: "This order already has a final outcome. Reload to see it.",
    TASK_NOT_LOCKED_BY_YOU: "Your claim on this order ran out and someone else took it. Reload the queue.",
    TASK_NOT_CLAIMED: "Nobody is working on this order anymore.",
    TASK_NOT_DONE: "This order is still in the queue. Record an outcome instead.",
    OUTCOME_UNCHANGED: "The order already has that outcome.",
    CORRECTION_NOT_ALLOWED: "This outcome can't be changed: the order was cancelled from the order page.",
    ORDER_REJECTED: "This order couldn't be placed.",
    INVALID_PHONE: "Enter a valid phone number.",
    CART_NOT_FOUND: "That cart no longer exists.",
    CART_TOKEN_OR_ITEM_REQUIRED: "There's nothing to check out.",
    STEP_MISMATCH: "This page is out of date. Reload to continue.",
    FUNNEL_PAUSED: "This funnel is paused.",
    PAGE_PATH_RESERVED: "That path is reserved for a built-in store page. Choose a different one.",
    PRODUCT_HAS_ORDERS: "This product has orders, so it can only be archived.",
    PRODUCT_IN_FUNNEL: "This product is used in a funnel. Remove it from the funnel first.",
    PRODUCT_NOT_ARCHIVED: "Only an archived product can be restored.",
    CARRIERS_NOT_CONFIGURED: "Courier integrations aren't available on this server yet. Please contact support.",
    CARRIER_AUTH_FAILED: "The courier rejected the API key. Check it in the courier's dashboard and connect again.",
    CARRIER_PERMISSION_DENIED:
      "The courier accepted the login, but it hasn't enabled API access for this account. Your details are correct: ask the courier to enable API access for your account, then try again.",
    CARRIER_SANDBOX_NOT_ALLOWED:
      "This courier connection uses the courier's sandbox, which only creates test shipments, so nothing was booked. A production account is required: connect one under Shipping.",
    CARRIER_ADDRESS_UNMATCHED: "The order's address couldn't be matched to the courier's list. Choose the delivery area.",
    CARRIER_CURRENCY_UNSUPPORTED: "This courier only collects cash in EGP, and this order is in another currency.",
    CARRIER_COD_LIMIT: "The cash-on-delivery amount is above this courier's limit.",
    CARRIER_NOT_CONNECTED: "This courier isn't connected to your store anymore.",
    CARRIER_CANCEL_FAILED: "The courier didn't cancel the shipment, so nothing was changed.",
    CARRIER_CREDENTIALS_UNREADABLE: "The saved courier key can't be read anymore. Connect the courier again.",
    SHIPMENT_NOT_CARRIER_MANAGED: "This shipment wasn't booked through a connected courier.",
    LABEL_NOT_AVAILABLE: "This courier doesn't provide printable labels.",
    CARRIER_TIER_UNMAPPED: "This weight tier has no package type for the courier. Book it as another tier, or map it in the courier settings.",
    CARRIER_MANUAL_CANCEL_REQUIRED:
      "This courier can't cancel deliveries from here. Cancel the delivery in the courier's dashboard first, then confirm it here.",
    CARRIER_CONNECT_CONFLICT:
      "This courier was connected from another tab or by a teammate at the same moment, so this save didn't go through. Reload to see the connection, then save again if you need to.",
    CARRIER_BOOKING_NOT_SAVED:
      "The courier created the delivery, but it couldn't be saved here. Cancel it in the courier's dashboard, then book the order again.",
    SHIPPING_TIERS_REQUIRED: "Add at least one weight tier before pricing shipping by weight.",
    DEFAULT_ITEM_WEIGHT_REQUIRED: "Set a default item weight first. It's required while shipping is priced by weight tier.",
    GATEWAYS_NOT_CONFIGURED: "Online payments aren't available on this server yet. Please contact support.",
    GATEWAY_AUTH_FAILED: "The payment gateway rejected these keys. Copy them again from its dashboard and reconnect.",
    GATEWAY_KEYS_MODE_MISMATCH: "One key is a test key and the other a live key. Use both from the same mode.",
    GATEWAY_KEYS_UNRECOGNISED: "These don't look like keys from this gateway. Check you copied the right ones.",
    GATEWAY_NOT_CONNECTED: "This payment gateway isn't connected to your store anymore.",
    GATEWAY_HAS_PENDING_PAYMENTS: "Some orders are still waiting on a payment through this gateway. Wait until they're paid or expire, then disconnect.",
    GATEWAY_CREDENTIALS_UNREADABLE: "The saved gateway keys can't be read anymore. Connect the gateway again.",
    PAYMENT_METHOD_UNAVAILABLE: "That payment method isn't available right now.",
    REFUND_EXCEEDS_ELIGIBLE_AMOUNT: "That's more than can still be refunded on this order.",
    REFUND_EXCEEDS_PAYMENT: "No single payment has that much left. Refund each payment separately.",
    REFUND_PAYMENT_INVALID: "That payment can't be refunded through the gateway.",
    ORDER_TEST_PAYMENT: "This order was paid in test mode, so it can't be shipped.",
    cancelFailedPermission:
      "The courier refused to cancel the delivery: the connected API key doesn't have Full Access. The order was not cancelled. Reconnect the courier with a Full Access key under Shipping, or cancel the delivery in the courier's dashboard first.",
    cancelFailedAuth:
      "The courier rejected the saved API key, so the delivery wasn't cancelled and the order is unchanged. Reconnect the courier under Shipping.",
    courierReply: "Courier's reply: {message}",
    carrierPermissionNamed:
      "{name} accepted the login, but it hasn't enabled API access for this account. Your details are correct: ask {name} to enable API access for your account, then try again.",
    carrierPermissionBosta:
      "Bosta refused this action for the connected API key. Check the key's access level in Bosta's dashboard, or reconnect with a Full Access key.",
    carrierSandboxNamed:
      "This {name} connection uses the {name} sandbox, which only creates test shipments, so nothing was booked. A production {name} account is required: connect one under Shipping.",
    cancelFailedApiAccess:
      "{name} refused to cancel the delivery: it hasn't enabled API access for this account. The order was not cancelled. Ask {name} to enable API access, or cancel the delivery in {name}'s dashboard first.",
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
    ORDER_NOT_COD: "أوردرات الدفع عند الاستلام فقط هي التي تُؤكَّد بالهاتف.",
    ORDER_ALREADY_CONFIRMED: "هذا الأوردر مؤكد بالفعل.",
    TASK_ALREADY_LOCKED: "موظف آخر يعمل على هذا الأوردر الآن.",
    TASK_ALREADY_DONE: "هذا الأوردر له نتيجة نهائية بالفعل. أعد التحميل لرؤيتها.",
    TASK_NOT_LOCKED_BY_YOU: "انتهت مدة استلامك لهذا الأوردر واستلمه شخص آخر. أعد تحميل القائمة.",
    TASK_NOT_CLAIMED: "لم يعد أحد يعمل على هذا الأوردر.",
    TASK_NOT_DONE: "هذا الأوردر ما زال في القائمة. سجّل نتيجة بدلًا من ذلك.",
    OUTCOME_UNCHANGED: "الأوردر له هذه النتيجة بالفعل.",
    CORRECTION_NOT_ALLOWED: "لا يمكن تغيير هذه النتيجة: تم إلغاء الأوردر من صفحة الأوردر.",
    ORDER_REJECTED: "تعذّر تسجيل هذا الأوردر.",
    INVALID_PHONE: "أدخل رقم هاتف صحيحًا.",
    CART_NOT_FOUND: "هذه السلة لم تعد موجودة.",
    CART_TOKEN_OR_ITEM_REQUIRED: "لا يوجد ما يمكن إتمام شرائه.",
    STEP_MISMATCH: "هذه الصفحة لم تعد محدّثة. أعد التحميل للمتابعة.",
    FUNNEL_PAUSED: "مسار البيع هذا متوقف مؤقتًا.",
    PAGE_PATH_RESERVED: "هذا المسار محجوز لصفحة أساسية في المتجر. اختر مسارًا آخر.",
    PRODUCT_HAS_ORDERS: "هذا المنتج عليه أوردرات، لذلك يمكن أرشفته فقط.",
    PRODUCT_IN_FUNNEL: "هذا المنتج مستخدم في مسار بيع. احذفه من المسار أولًا.",
    PRODUCT_NOT_ARCHIVED: "يمكن استعادة المنتج المؤرشف فقط.",
    CARRIERS_NOT_CONFIGURED: "ربط شركات الشحن غير متاح على هذا الخادم بعد. تواصل مع الدعم.",
    CARRIER_AUTH_FAILED: "رفضت شركة الشحن مفتاح API. تحقق منه في لوحة تحكم الشركة وأعد الربط.",
    CARRIER_PERMISSION_DENIED:
      "قبلت شركة الشحن تسجيل الدخول، لكنها لم تفعّل الربط عبر API لهذا الحساب. بياناتك صحيحة: اطلب من شركة الشحن تفعيل الربط عبر API لحسابك، ثم حاول مرة أخرى.",
    CARRIER_SANDBOX_NOT_ALLOWED:
      "ربط شركة الشحن هذا يستخدم بيئة التجربة (Sandbox) الخاصة بها، وهي تنشئ شحنات تجريبية فقط، لذلك لم يُحجز شيء. يلزم حساب إنتاج (Production): اربطه من صفحة الشحن.",
    CARRIER_ADDRESS_UNMATCHED: "تعذّرت مطابقة عنوان الأوردر مع قائمة شركة الشحن. اختر منطقة التوصيل.",
    CARRIER_CURRENCY_UNSUPPORTED: "شركة الشحن هذه تحصّل بالجنيه المصري فقط، وهذا الأوردر بعملة أخرى.",
    CARRIER_COD_LIMIT: "مبلغ الدفع عند الاستلام أعلى من الحد المسموح لشركة الشحن هذه.",
    CARRIER_NOT_CONNECTED: "شركة الشحن هذه لم تعد مربوطة بمتجرك.",
    CARRIER_CANCEL_FAILED: "لم تلغِ شركة الشحن الشحنة، لذلك لم يتم تغيير أي شيء.",
    CARRIER_CREDENTIALS_UNREADABLE: "تعذّرت قراءة مفتاح شركة الشحن المحفوظ. أعد ربط الشركة.",
    SHIPMENT_NOT_CARRIER_MANAGED: "هذه الشحنة لم تُحجز عبر شركة شحن مربوطة.",
    LABEL_NOT_AVAILABLE: "شركة الشحن هذه لا توفر ملصقات قابلة للطباعة.",
    CARRIER_TIER_UNMAPPED: "شريحة الوزن هذه ليس لها نوع طرد عند شركة الشحن. احجزها كشريحة أخرى، أو اربطها من إعدادات الشركة.",
    CARRIER_MANUAL_CANCEL_REQUIRED:
      "لا يمكن إلغاء شحنات هذه الشركة من هنا. ألغِ الشحنة من لوحة تحكم شركة الشحن أولًا، ثم أكّد ذلك هنا.",
    CARRIER_CONNECT_CONFLICT:
      "تم ربط شركة الشحن هذه من تبويب آخر أو بواسطة زميل في نفس اللحظة، لذلك لم يُحفظ هذا الطلب. أعد التحميل لرؤية الربط، ثم احفظ مرة أخرى إذا احتجت.",
    CARRIER_BOOKING_NOT_SAVED:
      "أنشأت شركة الشحن الشحنة، لكن تعذّر حفظها هنا. ألغِها من لوحة تحكم شركة الشحن، ثم احجز الأوردر مرة أخرى.",
    SHIPPING_TIERS_REQUIRED: "أضف شريحة وزن واحدة على الأقل قبل تسعير الشحن بالوزن.",
    DEFAULT_ITEM_WEIGHT_REQUIRED: "حدد الوزن الافتراضي للمنتج أولًا. هو مطلوب طالما الشحن يُسعَّر حسب شريحة الوزن.",
    GATEWAYS_NOT_CONFIGURED: "الدفع الإلكتروني غير متاح على هذا الخادم بعد. تواصل مع الدعم.",
    GATEWAY_AUTH_FAILED: "رفضت بوابة الدفع هذه المفاتيح. انسخها مرة أخرى من لوحة تحكمها وأعد الربط.",
    GATEWAY_KEYS_MODE_MISMATCH: "أحد المفتاحين للتجربة والآخر للتشغيل. استخدم المفتاحين من نفس النوع.",
    GATEWAY_KEYS_UNRECOGNISED: "هذه لا تبدو مفاتيح هذه البوابة. تأكد أنك نسخت المفاتيح الصحيحة.",
    GATEWAY_NOT_CONNECTED: "بوابة الدفع هذه لم تعد مربوطة بمتجرك.",
    GATEWAY_HAS_PENDING_PAYMENTS: "توجد أوردرات ما زالت تنتظر الدفع عبر هذه البوابة. انتظر حتى تُدفع أو تنتهي مهلتها، ثم ألغِ الربط.",
    GATEWAY_CREDENTIALS_UNREADABLE: "تعذّرت قراءة مفاتيح البوابة المحفوظة. أعد ربط البوابة.",
    PAYMENT_METHOD_UNAVAILABLE: "طريقة الدفع هذه غير متاحة الآن.",
    REFUND_EXCEEDS_ELIGIBLE_AMOUNT: "هذا أكثر من المبلغ المتبقي القابل للاسترداد في هذا الأوردر.",
    REFUND_EXCEEDS_PAYMENT: "لا توجد دفعة واحدة متبقٍ فيها هذا المبلغ. استرد كل دفعة على حدة.",
    REFUND_PAYMENT_INVALID: "لا يمكن استرداد هذه الدفعة عبر البوابة.",
    ORDER_TEST_PAYMENT: "هذا الأوردر دُفع في وضع التجربة، لذلك لا يمكن شحنه.",
    cancelFailedPermission:
      "رفضت شركة الشحن إلغاء الشحنة لأن مفتاح API المربوط ليس بصلاحية Full Access. لم يتم إلغاء الأوردر. أعد ربط الشركة بمفتاح Full Access من صفحة الشحن، أو ألغِ الشحنة من لوحة تحكم الشركة أولًا.",
    cancelFailedAuth:
      "رفضت شركة الشحن مفتاح API المحفوظ، لذلك لم تُلغَ الشحنة ولم يتغير الأوردر. أعد ربط الشركة من صفحة الشحن.",
    courierReply: "رد شركة الشحن: {message}",
    carrierPermissionNamed:
      "قبلت {name} تسجيل الدخول، لكنها لم تفعّل الربط عبر API لهذا الحساب. بياناتك صحيحة: اطلب من {name} تفعيل الربط عبر API لحسابك، ثم حاول مرة أخرى.",
    carrierPermissionBosta:
      "رفضت بوسطة هذا الإجراء بمفتاح API المربوط. راجع صلاحية المفتاح في لوحة تحكم بوسطة، أو أعد الربط بمفتاح صلاحياته Full Access.",
    carrierSandboxNamed:
      "ربط {name} هذا يستخدم بيئة التجربة (Sandbox) الخاصة بـ {name}، وهي تنشئ شحنات تجريبية فقط، لذلك لم يُحجز شيء. يلزم حساب إنتاج (Production) لدى {name}: اربطه من صفحة الشحن.",
    cancelFailedApiAccess:
      "رفضت {name} إلغاء الشحنة لأنها لم تفعّل الربط عبر API لهذا الحساب. لم يتم إلغاء الأوردر. اطلب من {name} تفعيل الربط عبر API، أو ألغِ الشحنة من لوحة تحكم {name} أولًا.",
  },
} satisfies Messages;

const OWN_KEY_LIST = [
  "network",
  "generic",
  "cancelFailedPermission",
  "cancelFailedAuth",
  "courierReply",
  "carrierPermissionNamed",
  "carrierPermissionBosta",
  "carrierSandboxNamed",
  "cancelFailedApiAccess",
] as const;
type CodeKey = Exclude<keyof typeof STRINGS.en, (typeof OWN_KEY_LIST)[number]>;
const OWN_KEYS: ReadonlySet<string> = new Set(OWN_KEY_LIST);

/** Bosta's CARRIER_PERMISSION_DENIED is its key's access level; every other courier's is API access on the account. */
const KEY_SCOPE_CARRIERS: ReadonlySet<string> = new Set(["bosta"]);

/** Codes whose server message is shown as-is, never replaced. */
const VERBATIM_CODES: ReadonlySet<string> = new Set<ApiErrorCode>(["CARRIER_ERROR", "GATEWAY_ERROR", "GATEWAY_REJECTED"]);

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
          const details = apiErrorDetails<CarrierCancelFailedDetails>(err);
          const cause = details?.carrierErrorCode;
          if (cause === "CARRIER_PERMISSION_DENIED") {
            const carrierCode = details?.carrierCode;
            return carrierCode && !KEY_SCOPE_CARRIERS.has(carrierCode)
              ? fmt(t.cancelFailedApiAccess, { name: providerName(carrierCode) })
              : t.cancelFailedPermission;
          }
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

/**
 * `useErrorMessage` for a call made with a known courier: the permission and
 * sandbox errors carry no courier name, so they are worded here with it.
 */
export function useCarrierErrorMessage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  return useCallback(
    (err: unknown, carrier: { code: string; name: string } | null | undefined, overrides?: ErrorOverrides): string => {
      if (!carrier) return errorMessage(err, overrides);
      const name = carrier.name || providerName(carrier.code);
      return errorMessage(err, {
        CARRIER_PERMISSION_DENIED: KEY_SCOPE_CARRIERS.has(carrier.code)
          ? t.carrierPermissionBosta
          : fmt(t.carrierPermissionNamed, { name }),
        CARRIER_SANDBOX_NOT_ALLOWED: fmt(t.carrierSandboxNamed, { name }),
        ...overrides,
      });
    },
    [t, errorMessage]
  );
}
