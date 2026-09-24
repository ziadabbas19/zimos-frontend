"use client";

import type { ReactNode } from "react";
import { GOVERNORATES } from "@/lib/egypt";
import {
  NOTES_MAX,
  POSTAL_CODE_MAX,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormFieldModes,
  type OrderFormValues,
} from "@/lib/orderForm";
import { useStore } from "@/lib/StoreContext";
import { input, label as labelClass } from "../ui";

export function fieldId(prefix: string, field: OrderFormField) {
  return `${prefix}-${field}`;
}

function Field({
  id,
  label,
  required,
  optionalLabel,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : optionalLabel ? (
          <span className="ms-1 text-xs font-normal text-ink-soft">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The COD address/contact fields. Controlled; validation lives in
 * lib/orderForm.ts so the product quick form and checkout behave identically.
 * `fields` decides whether email, postal code and notes are hidden, optional
 * or required — the store's checkout settings, as that form applies them.
 */
export function OrderFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  fields,
  showAltPhone = false,
}: {
  idPrefix: string;
  values: OrderFormValues;
  errors: OrderFormErrors;
  onChange: (field: OrderFormField, value: string) => void;
  fields: OrderFormFieldModes;
  showAltPhone?: boolean;
}) {
  const { t, locale } = useStore();

  const a11y = (field: OrderFormField, hasHint = false) => {
    const id = fieldId(idPrefix, field);
    const describedBy = errors[field] ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
    return {
      id,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy,
    } as const;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={fieldId(idPrefix, "fullName")} label={t.form.fullName} required error={errors.fullName} className="sm:col-span-2">
        <input
          {...a11y("fullName")}
          type="text"
          autoComplete="name"
          required
          placeholder={t.form.fullNamePlaceholder}
          value={values.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          className={input}
        />
      </Field>

      <Field
        id={fieldId(idPrefix, "phone")}
        label={t.form.phone}
        required
        error={errors.phone}
        hint={t.form.phoneHint}
        className={showAltPhone ? "" : "sm:col-span-2"}
      >
        <input
          {...a11y("phone", true)}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          required
          maxLength={16}
          placeholder={t.form.phonePlaceholder}
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          className={`${input} text-start rtl:text-end`}
        />
      </Field>

      {showAltPhone && (
        <Field id={fieldId(idPrefix, "altPhone")} label={t.form.altPhone} optionalLabel={t.common.optional} error={errors.altPhone}>
          <input
            {...a11y("altPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            dir="ltr"
            maxLength={16}
            placeholder={t.form.phonePlaceholder}
            value={values.altPhone}
            onChange={(e) => onChange("altPhone", e.target.value)}
            className={`${input} text-start rtl:text-end`}
          />
        </Field>
      )}

      {fields.email !== "hidden" && (
        <Field
          id={fieldId(idPrefix, "email")}
          label={t.form.email}
          required={fields.email === "required"}
          optionalLabel={t.common.optional}
          error={errors.email}
          className="sm:col-span-2"
        >
          <input
            {...a11y("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            required={fields.email === "required"}
            dir="ltr"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={`${input} text-start rtl:text-end`}
          />
        </Field>
      )}

      <Field id={fieldId(idPrefix, "governorate")} label={t.form.governorate} required error={errors.governorate}>
        <div className="relative">
          <select
            {...a11y("governorate")}
            required
            autoComplete="address-level1"
            value={values.governorate}
            onChange={(e) => onChange("governorate", e.target.value)}
            className={`${input} cursor-pointer appearance-none pe-10`}
          >
            <option value="">{t.form.chooseGovernorate}</option>
            {GOVERNORATES.map((g) => (
              <option key={g.code} value={g.code}>
                {g[locale]}
              </option>
            ))}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-soft"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </Field>

      <Field id={fieldId(idPrefix, "city")} label={t.form.city} required error={errors.city}>
        <input
          {...a11y("city")}
          type="text"
          autoComplete="address-level2"
          required
          value={values.city}
          onChange={(e) => onChange("city", e.target.value)}
          className={input}
        />
      </Field>

      <Field id={fieldId(idPrefix, "address")} label={t.form.address} required error={errors.address} className="sm:col-span-2">
        <input
          {...a11y("address")}
          type="text"
          autoComplete="street-address"
          required
          placeholder={t.form.addressPlaceholder}
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
          className={input}
        />
      </Field>

      {fields.postal_code !== "hidden" && (
        <Field
          id={fieldId(idPrefix, "postalCode")}
          label={t.form.postalCode}
          required={fields.postal_code === "required"}
          optionalLabel={t.common.optional}
          error={errors.postalCode}
          className="sm:col-span-2"
        >
          <input
            {...a11y("postalCode")}
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            required={fields.postal_code === "required"}
            dir="ltr"
            maxLength={POSTAL_CODE_MAX}
            value={values.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
            className={`${input} text-start rtl:text-end sm:max-w-56`}
          />
        </Field>
      )}

      {fields.notes !== "hidden" && (
        <Field
          id={fieldId(idPrefix, "notes")}
          label={t.form.notes}
          optionalLabel={t.common.optional}
          error={errors.notes}
          className="sm:col-span-2"
        >
          <textarea
            {...a11y("notes")}
            rows={2}
            maxLength={NOTES_MAX}
            placeholder={t.form.notesPlaceholder}
            value={values.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            className={`${input} min-h-20 resize-y`}
          />
        </Field>
      )}
    </div>
  );
}
