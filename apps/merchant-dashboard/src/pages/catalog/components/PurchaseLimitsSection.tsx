import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconLock } from "@/components/icons";
import { Alert, Button, Input, cn, ZLoader } from "@store-builder/ui";
import {
  PURCHASE_LIMIT_MAX,
  apiFieldProblems,
  purchaseLimitsGet,
  purchaseLimitsSave,
  type PurchaseLimits,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { numberField, parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { SectionSaveBar } from "../product/saveQueue";
import { ProductPageCard } from "./ProductPageCard";

const STRINGS = {
  en: {
    title: "Purchase limits",
    description:
      "The fewest and the most of this product one order can hold, and the most one customer can buy. Every variant and offer of it counts together. Orders you create yourself aren't limited.",
    min: "Minimum per order",
    minHint: "The checkout asks for at least this many.",
    max: "Maximum per order",
    maxHint: "The cart and checkout stop at this many.",
    perCustomer: "Maximum per customer",
    perCustomerHint: "Across all their orders that weren't cancelled, by their phone number.",
    empty: "No limit",
    bad: "Enter a whole number from 1 to {max}, or leave it empty.",
    maxBelowMin: "The maximum must be at least the minimum.",
    perCustomerBelowMax: "The per-customer limit must be at least the maximum per order.",
    perCustomerBelowMin: "The per-customer limit must be at least the minimum per order, or nobody could buy it.",
    none: "No limits: customers can order any quantity.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Saved. The product page and checkout use the new limits right away.",
    loading: "Loading the limits…",
    retry: "Try again",
    noView: "Seeing the limits needs the “view products” permission. Ask the store owner.",
    noManage: "Changing the limits needs the “manage products” permission. Ask the store owner.",
  },
  ar: {
    title: "حدود الشراء",
    description:
      "أقل وأكبر كمية من هذا المنتج في الطلب الواحد، وأكبر كمية يستطيع العميل الواحد شراءها. تُحسب كل أنواعه وعروضه معًا. الطلبات التي تنشئها بنفسك لا تتقيد بهذه الحدود.",
    min: "أقل كمية في الطلب",
    minHint: "لن تقبل صفحة الدفع أقل من هذا العدد.",
    max: "أكبر كمية في الطلب",
    maxHint: "تتوقف السلة وصفحة الدفع عند هذا العدد.",
    perCustomer: "أكبر كمية للعميل الواحد",
    perCustomerHint: "في كل طلباته غير الملغاة، ونعرفه من رقم هاتفه.",
    empty: "بدون حد",
    bad: "اكتب رقمًا صحيحًا من ١ إلى {max}، أو اتركه فارغًا.",
    maxBelowMin: "يجب ألا تقل أكبر كمية عن أقل كمية.",
    perCustomerBelowMax: "يجب ألا يقل حد العميل الواحد عن أكبر كمية في الطلب.",
    perCustomerBelowMin: "يجب ألا يقل حد العميل الواحد عن أقل كمية في الطلب، وإلا لن يستطيع أحد شراءه.",
    none: "بدون حدود: يستطيع العميل طلب أي كمية.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    saved: "تم الحفظ. ستعمل صفحة المنتج وصفحة الدفع بالحدود الجديدة فورًا.",
    loading: "جارٍ تحميل حدود الشراء…",
    retry: "حاول مرة أخرى",
    noView: "عرض حدود الشراء يحتاج إلى صلاحية «عرض المنتجات». اطلبها من مالك المتجر.",
    noManage: "تغيير حدود الشراء يحتاج إلى صلاحية «إدارة المنتجات». اطلبها من مالك المتجر.",
  },
} satisfies Messages;

type Key = keyof PurchaseLimits;
type Draft = Record<Key, string>;
const KEYS: Key[] = ["min", "max", "maxPerCustomer"];

const toDraft = (l: PurchaseLimits): Draft => ({ min: numberField(l.min), max: numberField(l.max), maxPerCustomer: numberField(l.maxPerCustomer) });
const sameDraft = (a: Draft, b: Draft) => KEYS.every((k) => a[k].trim() === b[k].trim());

/**
 * Product page → «حدود الشراء»: minimum and maximum per order
 * and maximum per customer. Empty fields are no limit; saving them all empty
 * clears the limits.
 */
export function PurchaseLimitsSection({ productId }: { productId: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const data = useAsync(() => purchaseLimitsGet(apiClient, workspaceId, productId), [workspaceId, productId]);

  return (
    <ProductPageCard title={t.title} description={t.description}>
      {data.loading && !data.data ? (
        <div className="flex min-h-11 items-center">
          <ZLoader label={t.loading} />
        </div>
      ) : data.error || !data.data ? (
        isPermissionError(data.error) ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <IconLock className="size-4 shrink-0" aria-hidden />
            {t.noView}
          </p>
        ) : (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{errorMessage(data.error)}</p>
            <Button variant="outline" className="min-h-11" onClick={() => void data.refresh()}>
              {t.retry}
            </Button>
          </div>
        )
      ) : (
        <LimitsForm productId={productId} limits={data.data.limits} onSaved={(limits) => data.setData({ productId, limits })} />
      )}
    </ProductPageCard>
  );
}

function LimitsForm({
  productId,
  limits,
  onSaved,
}: {
  productId: string;
  limits: PurchaseLimits;
  onSaved: (next: PurchaseLimits) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const baseId = useId();
  const form = useRef<HTMLFormElement>(null);
  const saved = toDraft(limits);
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(toDraft(limits));
  }, [limits]);

  const dirty = !sameDraft(draft, saved);
  const labels: Record<Key, { label: string; hint: string }> = {
    min: { label: t.min, hint: t.minHint },
    max: { label: t.max, hint: t.maxHint },
    maxPerCustomer: { label: t.perCustomer, hint: t.perCustomerHint },
  };

  function check(): { body: PurchaseLimits } | { errors: Partial<Record<Key, string>> } {
    const found: Partial<Record<Key, string>> = {};
    const body = {} as PurchaseLimits;
    for (const k of KEYS) {
      const n = parseWholeNumber(draft[k], 1, PURCHASE_LIMIT_MAX);
      if (Number.isNaN(n)) found[k] = fmt(t.bad, { max: PURCHASE_LIMIT_MAX });
      body[k] = Number.isNaN(n) ? null : n;
    }
    if (!found.max && body.min && body.max && body.min > body.max) found.max = t.maxBelowMin;
    if (!found.maxPerCustomer && body.max && body.maxPerCustomer && body.maxPerCustomer < body.max) found.maxPerCustomer = t.perCustomerBelowMax;
    // The API takes it, but min > per-customer leaves the product unbuyable.
    else if (!found.maxPerCustomer && body.min && body.maxPerCustomer && body.maxPerCustomer < body.min) found.maxPerCustomer = t.perCustomerBelowMin;
    return Object.keys(found).length ? { errors: found } : { body };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaveError(null);
    const result = check();
    if ("errors" in result) {
      setErrors(result.errors);
      const first = KEYS.find((k) => result.errors[k]);
      if (first) document.getElementById(`${baseId}-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const next = await purchaseLimitsSave(apiClient, workspaceId, productId, result.body);
      onSaved(next.limits);
      toast.success(t.saved);
    } catch (err) {
      // The server's own order checks, said under the field they name.
      const fields = apiFieldProblems(err);
      if (fields.some((f) => f.field === "max")) setErrors({ max: t.maxBelowMin });
      else if (fields.some((f) => f.field === "maxPerCustomer")) setErrors({ maxPerCustomer: t.perCustomerBelowMax });
      else setSaveError(isPermissionError(err) ? t.noManage : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {KEYS.map((k) => {
          const id = `${baseId}-${k}`;
          const error = errors[k];
          return (
            <div key={k} className="space-y-1.5">
              <label htmlFor={id} className="block text-sm font-medium text-ink">
                {labels[k].label}
              </label>
              <Input
                id={id}
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                maxLength={6}
                placeholder={t.empty}
                value={draft[k]}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-hint`}
                disabled={saving}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [k]: e.target.value }));
                  setErrors((prev) => ({ ...prev, [k]: undefined }));
                  setSaveError(null);
                }}
                className="h-11 w-full text-center tabular-nums sm:w-32"
              />
              <p id={`${id}-hint`} className={cn("text-xs", error ? "font-medium text-danger" : "text-ink-soft")}>
                {error ?? labels[k].hint}
              </p>
            </div>
          );
        })}
      </div>

      {!dirty && KEYS.every((k) => !saved[k]) && <p className="text-xs text-ink-soft">{t.none}</p>}

      {saveError && <Alert variant="danger">{saveError}</Alert>}

      {/* The page's one save bar: same save, same payload (the form is submitted as before). */}
      <SectionSaveBar
        section={t.title}
        dirty={dirty}
        saving={saving}
        error={saveError ?? Object.values(errors).find(Boolean) ?? null}
        onSave={() => form.current?.requestSubmit()}
        onDiscard={() => {
          setDraft(saved);
          setErrors({});
          setSaveError(null);
        }}
      />
    </form>
  );
}
