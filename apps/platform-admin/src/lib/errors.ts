import { ApiError } from "@store-builder/api-client";
import { getActiveLocale } from "../i18n/activeLocale.ts";

export { ApiError };

const TEXT = {
  en: {
    failed: "Something went wrong. Please try again.",
    unreachable: "Can't reach the server. Check your connection and try again.",
    forbidden: "You don't have permission to do that.",
  },
  ar: {
    failed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
    unreachable: "تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.",
    forbidden: "ليست لديك صلاحية للقيام بذلك.",
  },
};

/**
 * The API's own words in Arabic, by its stable codes (the referral and console
 * access errors). Any other code keeps the server's English message, and so does
 * a 422's field-level text.
 */
const API_ERRORS_AR: Record<string, string> = {
  REFERRAL_V2_DISABLED: "هذه الميزة غير مفعّلة حاليًا.",
  REFERRAL_CODE_TAKEN: "هذا الكود مستخدم بالفعل.",
  REFERRAL_CODE_INVALID: "كود الإحالة هذا غير صالح. تحقق منه وحاول مرة أخرى.",
  NOT_AN_AGENT: "هذا متاح فقط لحساب بدور وكيل.",
  REFERRAL_CODE_NOT_APPROVED: "لم تتم الموافقة على هذا الكود بعد.",
  REFERRAL_CODE_NOT_PENDING: "هذا الكود ليس بانتظار المراجعة.",
  REVIEW_OF_OWN_WORK: "أنت من قام بهذا، لذا يجب أن يراجعه شخص آخر.",
  AGENT_LINK_REQUEST_PENDING: "يوجد بالفعل تعديل على وكيل هذا المتجر بانتظار المراجعة.",
  AGENT_LINK_REQUEST_NOT_PENDING: "هذا الطلب ليس بانتظار المراجعة.",
  AGENT_LINK_ENDED: "انتهى هذا الربط بالفعل.",
  USER_NOT_FOUND: "لا يوجد حساب بهذا البريد الإلكتروني. يجب أن يسجّل الشخص أولًا قبل منحه صلاحية الوصول إلى لوحة التحكم.",
  USER_NOT_ACTIVE: "لا يمكن منح هذا الحساب صلاحية الوصول إلى لوحة التحكم: فهو موقوف أو لم يؤكد بريده الإلكتروني بعد.",
  ALREADY_PLATFORM_USER: "لهذا الحساب دور بالفعل. غيّر دوره من قائمة المسؤولين.",
  CREATOR_REQUIRED: "هذا الإجراء متاح للمنشئين فقط.",
  CANNOT_ACT_ON_SELF: "لا يمكنك تنفيذ هذا الإجراء على حسابك.",
  CANNOT_EDIT_SELF: "لا يمكنك تغيير دورك أو صلاحياتك بنفسك. اطلب ذلك من شخص آخر.",
  CANNOT_REVOKE_SELF: "لا يمكنك سحب صلاحية وصولك بنفسك. اطلب ذلك من منشئ آخر.",
  LAST_CREATOR: "هذا هو آخر منشئ، لذا لا يمكن تنفيذ هذا الإجراء عليه.",
  PERMISSION_NOT_HELD: "لا يمكنك التصرف في صلاحيات لا تملكها أنت.",
  ROLE_NAME_TAKEN: "يوجد دور بهذا الاسم بالفعل.",
};

function arabicApiMessage(err: ApiError): string | undefined {
  if (getActiveLocale() !== "ar") return undefined;
  // A plain permission refusal names the key it missed, which helps nobody reading Arabic.
  if (err.status === 403 && err.code === "FORBIDDEN") return TEXT.ar.forbidden;
  return err.code && Object.hasOwn(API_ERRORS_AR, err.code) ? API_ERRORS_AR[err.code] : undefined;
}

/** A human message for any thrown value. */
export function getErrorMessage(err: unknown, fallback = TEXT[getActiveLocale()].failed): string {
  const text = TEXT[getActiveLocale()];
  if (err instanceof ApiError) {
    const arabic = arabicApiMessage(err);
    if (arabic) return arabic;
    if (err.status === 403) return err.message || text.forbidden;
    if (err.status === 0 || err.message === "Failed to fetch") {
      return text.unreachable;
    }
    return err.message || fallback;
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return text.unreachable;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function isPermissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
