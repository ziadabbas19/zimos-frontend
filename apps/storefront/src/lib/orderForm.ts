import type { CheckoutFieldMode, CheckoutPayload, CheckoutSettings } from "@store-builder/api-client";
import { findGovernorate, isEgyptianMobile, normalizePhone } from "./egypt";
import type { Dictionary } from "./i18n";

/** The COD order form shared by the product quick-order form and checkout. */
export interface OrderFormValues {
  fullName: string;
  phone: string;
  altPhone: string;
  email: string;
  governorate: string;
  city: string;
  address: string;
  postalCode: string;
  notes: string;
}

export type OrderFormField = keyof OrderFormValues;
export type OrderFormErrors = Partial<Record<OrderFormField, string>>;

export const EMPTY_ORDER_FORM: OrderFormValues = {
  fullName: "",
  phone: "",
  altPhone: "",
  email: "",
  governorate: "",
  city: "",
  address: "",
  postalCode: "",
  notes: "",
};

/** Field order for "focus the first invalid field". */
export const FIELD_ORDER: OrderFormField[] = [
  "fullName",
  "phone",
  "altPhone",
  "email",
  "governorate",
  "city",
  "address",
  "postalCode",
  "notes",
];

/** Backend limits (checkoutValidation.js) — kept as input maxLengths. */
export const POSTAL_CODE_MAX = 20;
export const NOTES_MAX = 500;

/**
 * How one form renders the merchant-configurable fields. The checkout page
 * uses the store's settings as they are; the product quick form keeps itself
 * short — see `quickFormFields`.
 */
export type OrderFormFieldModes = CheckoutSettings;

/**
 * The quick form only asks for email/postal code when the store demands them
 * (the server would refuse the order otherwise). Notes follow the setting.
 */
export function quickFormFields(settings: CheckoutSettings): OrderFormFieldModes {
  const onlyIfRequired = (mode: CheckoutFieldMode): CheckoutFieldMode => (mode === "required" ? "required" : "hidden");
  return {
    email: onlyIfRequired(settings.email),
    postal_code: onlyIfRequired(settings.postal_code),
    notes: settings.notes,
  };
}

export function validateOrderForm(
  values: OrderFormValues,
  t: Dictionary,
  fields: OrderFormFieldModes
): OrderFormErrors {
  const e: OrderFormErrors = {};
  if (values.fullName.trim().length < 2) e.fullName = t.form.errors.fullName;
  if (!isEgyptianMobile(values.phone)) e.phone = t.form.errors.phone;
  if (values.altPhone.trim() && !isEgyptianMobile(values.altPhone)) e.altPhone = t.form.errors.altPhone;
  if (fields.email !== "hidden") {
    const email = values.email.trim();
    if (!email) {
      if (fields.email === "required") e.email = t.form.errors.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = t.form.errors.email;
    }
  }
  if (!findGovernorate(values.governorate)) e.governorate = t.form.errors.governorate;
  if (!values.city.trim()) e.city = t.form.errors.city;
  if (values.address.trim().length < 5) e.address = t.form.errors.address;
  if (fields.postal_code === "required" && !values.postalCode.trim()) {
    e.postalCode = t.form.errors.postalCode;
  }
  return e;
}

/**
 * The governorate as the order stores it in shippingAddress.province: its
 * Arabic name with the English one alongside. The shipping quote sends the
 * same string, so a zone's regions match the quote and the order alike.
 */
export function provinceFor(code: string): string | undefined {
  const gov = findGovernorate(code);
  return gov ? `${gov.ar} (${gov.en})` : undefined;
}

/**
 * Builds the COD checkout payload. The governorate is sent by its Arabic name —
 * what Egyptian couriers and confirmation agents read — with the English name
 * alongside so either reads naturally in the merchant dashboard. A field the
 * form doesn't show is never sent. The shopper's note travels as
 * `shippingAddress.notes` (for the courier); the top-level `notes` is ours.
 */
export function toCheckoutPayload(
  values: OrderFormValues,
  fields: OrderFormFieldModes,
  options: { discountCode?: string; systemNotes?: string[]; item?: CheckoutPayload["item"] } = {}
): CheckoutPayload {
  const province = provinceFor(values.governorate);
  const altPhone = values.altPhone.trim() ? normalizePhone(values.altPhone) : "";
  const email = fields.email !== "hidden" ? values.email.trim() : "";
  const postalCode = fields.postal_code !== "hidden" ? values.postalCode.trim() : "";
  const notes = fields.notes !== "hidden" ? values.notes.trim() : "";
  const systemNotes = (options.systemNotes ?? []).filter(Boolean);

  return {
    contact: {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      ...(altPhone ? { alternatePhone: altPhone } : {}),
      ...(email ? { email } : {}),
    },
    shippingAddress: {
      country: "EG",
      ...(province ? { province } : {}),
      city: values.city.trim(),
      addressLine: values.address.trim(),
      ...(postalCode ? { postalCode } : {}),
      ...(notes ? { notes } : {}),
    },
    paymentMethod: "cod",
    ...(options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
    ...(systemNotes.length ? { notes: systemNotes.join(" | ") } : {}),
    ...(options.item ? { item: options.item } : {}),
  };
}
