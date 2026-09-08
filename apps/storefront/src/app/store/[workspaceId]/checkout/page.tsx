"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ApiError,
  formatMoney,
  type CartLine,
  type CheckoutPayload,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useCart } from "@/lib/CartProvider";

const PAYMENT_OPTIONS = [
  { value: "cod", label: "الدفع عند الاستلام", enabled: true },
  { value: "card", label: "بطاقة ائتمانية", enabled: false },
  { value: "wallet", label: "محفظة إلكترونية", enabled: false },
  { value: "bank_transfer", label: "تحويل بنكي", enabled: false },
] as const;

const REQUIRED_FIELDS = ["fullName", "phone", "country", "city", "addressLine"] as const;

type FormState = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  country: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  country: "EG",
  province: "",
  city: "",
  addressLine: "",
  postalCode: "",
  notes: "",
};

function Field({
  label,
  value,
  onChange,
  required = false,
  invalid = false,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink-soft">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-[0.5rem] border bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-primary ${
          invalid ? "border-danger" : "border-line"
        }`}
      />
    </label>
  );
}

function lineTitle(line: CartLine): string {
  if (line.variant) {
    return Object.values(line.variant.optionValues).join(" / ") || line.variant.sku || "منتج";
  }
  return "منتج";
}

export default function CheckoutPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const [client] = useState(() => createStorefrontApiClient());

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [invalid, setInvalid] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = cart?.currency ?? "EGP";
  const items = cart?.items ?? [];

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const missing: Partial<Record<keyof FormState, boolean>> = {};
    for (const key of REQUIRED_FIELDS) {
      if (!form[key].trim()) missing[key] = true;
    }
    setInvalid(missing);
    if (Object.keys(missing).length > 0) {
      setError("من فضلك املأ كل الحقول المطلوبة.");
      return;
    }
    if (items.length === 0) {
      setError("سلة التسوق فاضية.");
      return;
    }

    const payload: CheckoutPayload = {
      contact: {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        ...(form.alternatePhone.trim() ? { alternatePhone: form.alternatePhone.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      },
      shippingAddress: {
        country: form.country.trim(),
        ...(form.province.trim() ? { province: form.province.trim() } : {}),
        city: form.city.trim(),
        addressLine: form.addressLine.trim(),
        ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
      paymentMethod: "cod",
    };

    setSubmitting(true);
    setError(null);
    try {
      const order = await client.checkout(workspaceId, payload, cart?.guestToken);
      clearCart();
      const query = new URLSearchParams({
        number: order.orderNumber,
        phone: payload.contact.phone,
      });
      router.push(`/store/${workspaceId}/orders/${order.id}?${query.toString()}`);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "تعذّر إتمام الطلب، حاول تاني."
      );
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link
        href={`/store/${workspaceId}/cart`}
        className="text-sm text-primary hover:underline"
      >
        → رجوع للسلة
      </Link>
      <h1 className="mt-4 font-display text-2xl font-medium text-ink">إتمام الطلب</h1>

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_20rem]">
        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h2 className="font-display text-base font-medium text-ink">بيانات التواصل</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label="الاسم الكامل"
                required
                value={form.fullName}
                invalid={invalid.fullName}
                onChange={(v) => set("fullName", v)}
              />
              <Field
                label="رقم الموبايل"
                required
                type="tel"
                inputMode="tel"
                value={form.phone}
                invalid={invalid.phone}
                onChange={(v) => set("phone", v)}
              />
              <Field
                label="رقم بديل"
                type="tel"
                inputMode="tel"
                value={form.alternatePhone}
                onChange={(v) => set("alternatePhone", v)}
              />
              <Field
                label="البريد الإلكتروني"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(v) => set("email", v)}
              />
            </div>
          </section>

          <section>
            <h2 className="font-display text-base font-medium text-ink">عنوان الشحن</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label="الدولة"
                required
                value={form.country}
                invalid={invalid.country}
                onChange={(v) => set("country", v)}
              />
              <Field
                label="المحافظة"
                value={form.province}
                onChange={(v) => set("province", v)}
              />
              <Field
                label="المدينة"
                required
                value={form.city}
                invalid={invalid.city}
                onChange={(v) => set("city", v)}
              />
              <Field
                label="الرمز البريدي"
                inputMode="numeric"
                value={form.postalCode}
                onChange={(v) => set("postalCode", v)}
              />
              <div className="sm:col-span-2">
                <Field
                  label="العنوان بالتفصيل"
                  required
                  value={form.addressLine}
                  invalid={invalid.addressLine}
                  onChange={(v) => set("addressLine", v)}
                />
              </div>
              <label className="block sm:col-span-2">
                <span className="text-sm text-ink-soft">ملاحظات</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-[0.5rem] border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="font-display text-base font-medium text-ink">طريقة الدفع</h2>
            <div className="mt-3 space-y-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-[0.5rem] border border-line px-3 py-2 text-sm ${
                    opt.enabled ? "cursor-pointer text-ink" : "cursor-not-allowed text-ink-soft opacity-70"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={opt.value}
                    defaultChecked={opt.value === "cod"}
                    disabled={!opt.enabled}
                    className="accent-primary"
                  />
                  <span>{opt.label}</span>
                  {!opt.enabled && (
                    <span className="mr-auto rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
                      قريبًا
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-[0.5rem] bg-danger-soft px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full rounded-[0.5rem] bg-primary px-6 py-3 text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "جارٍ تأكيد الطلب…" : "تأكيد الطلب"}
          </button>
        </form>

        <aside className="h-max rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
          <h2 className="font-display text-base font-medium text-ink">ملخص الطلب</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">سلة التسوق فاضية.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {items.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink-soft">
                      {lineTitle(line)} <span className="text-ink-soft">×{line.quantity}</span>
                    </span>
                    <span className="shrink-0 text-ink">
                      {formatMoney(line.lineTotal, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
                <span className="text-ink-soft">الإجمالي المبدئي</span>
                <span className="font-medium text-ink">
                  {formatMoney(cart?.subtotal ?? 0, currency)}
                </span>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
