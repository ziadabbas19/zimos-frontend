import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconLock, IconSchedule } from "@/components/icons";
import { Alert, Button, Input, cn, ZLoader } from "@store-builder/ui";
import {
  PREORDER_LIMIT_MAX,
  PREORDER_MESSAGE_MAX,
  preordersGet,
  preordersSave,
  type PreorderVariant,
  type ProductPreorders,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatOptions } from "@/lib/format";
import { formatDay, numberField, parseWholeNumber, todayDay } from "@/lib/wholeNumber";
import { countOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { SectionSaveBar } from "../product/saveQueue";
import { ProductPageCard } from "./ProductPageCard";

const STRINGS = {
  en: {
    title: "Pre-orders",
    description: "When a variant sells out, customers can still order it and wait for your ship date.",
    toggle: "Take pre-orders when sold out",
    hintOff: "Off: a sold-out variant shows “Sold out” and can't be ordered.",
    hintOn: "A sold-out variant shows “Pre-order” on the product page, with your ship date and message.",
    shipsAt: "Expected ship date",
    shipsAtHint: "Customers see “Ships by {date}”. Leave it empty if you don't know yet.",
    shipsAtEmpty: "Customers see “Ships by …” once you pick a date.",
    shipsAtPast: "This date has already passed — customers would see a ship date in the past.",
    shipsAtBad: "Pick a date from the calendar.",
    limit: "Limit per variant",
    limitHint: "How many units beyond your stock each variant can sell. Empty = no limit.",
    limitBad: "Enter a whole number from 1 to 1,000,000, or leave it empty for no limit.",
    message: "Message on the product page",
    messagePlaceholder: "e.g. Ships mid-November",
    messageCount: "{n} / {max}",
    variants: "Variants",
    available: "Available: {n}",
    preordered: "Pre-ordered: {n}",
    noVariants: "This product has no variants yet.",
    summaryOn: "On",
    summaryShips: "ships by {date}",
    summaryNoDate: "no ship date yet",
    summaryLimit: "up to {count} per variant",
    summaryNoLimit: "no limit",
    summaryOwed: "{count} pre-ordered so far",
    edit: "Change",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Saved. The product page shows the change right away.",
    loading: "Loading pre-orders…",
    retry: "Try again",
    noView: "Seeing pre-orders needs the “view products” permission. Ask the store owner.",
    noManage: "Changing pre-orders needs the “manage products” permission. Ask the store owner.",
  },
  ar: {
    title: "الطلب المسبق",
    description: "عندما ينفد نوع، يستطيع العميل طلبه وانتظاره حتى موعد الشحن الذي تحدده.",
    toggle: "استقبال طلبات مسبقة عند نفاد المنتج",
    hintOff: "متوقف: النوع الذي ينفد يظهر عليه «نفدت الكمية» ولا يمكن طلبه.",
    hintOn: "النوع الذي ينفد سيظهر عليه «اطلبه مسبقًا» في صفحة المنتج، مع موعد الشحن ورسالتك.",
    shipsAt: "موعد الشحن المتوقع",
    shipsAtHint: "سيرى العميل «هيتشحن قبل {date}». اتركه فارغًا إذا لم تعرفه بعد.",
    shipsAtEmpty: "سيرى العميل «هيتشحن قبل …» فور اختيارك تاريخًا.",
    shipsAtPast: "مضى هذا التاريخ — سيرى العميل موعد شحن فائتًا.",
    shipsAtBad: "اختر تاريخًا من التقويم.",
    limit: "الحد لكل نوع",
    limitHint: "عدد القطع التي يمكن بيعها من كل نوع زيادةً على المخزون. فارغ = بدون حد.",
    limitBad: "اكتب رقمًا صحيحًا من ١ إلى ١٠٠٠٠٠٠، أو اتركه فارغًا ليكون بدون حد.",
    message: "رسالة في صفحة المنتج",
    messagePlaceholder: "مثلًا: الشحن منتصف نوفمبر",
    messageCount: "{n} / {max}",
    variants: "الأنواع",
    available: "المتاح: {n}",
    preordered: "طُلب مسبقًا: {n}",
    noVariants: "لا توجد أنواع لهذا المنتج بعد.",
    summaryOn: "مفعّل",
    summaryShips: "يُشحن قبل {date}",
    summaryNoDate: "بدون موعد شحن بعد",
    summaryLimit: "حتى {count} لكل نوع",
    summaryNoLimit: "بدون حد",
    summaryOwed: "{count} طُلبت مسبقًا حتى الآن",
    edit: "تعديل",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    saved: "تم الحفظ. ستعرض صفحة المنتج التغيير فورًا.",
    loading: "جارٍ تحميل الطلب المسبق…",
    retry: "حاول مرة أخرى",
    noView: "عرض الطلب المسبق يحتاج إلى صلاحية «عرض المنتجات». اطلبها من مالك المتجر.",
    noManage: "تغيير الطلب المسبق يحتاج إلى صلاحية «إدارة المنتجات». اطلبها من مالك المتجر.",
  },
} satisfies Messages;

type Draft = { enabled: boolean; shipsAt: string; limit: string; message: string };

const toDraft = (p: ProductPreorders["preorder"]): Draft => ({
  enabled: p.enabled,
  shipsAt: p.shipsAt ?? "",
  limit: numberField(p.limit),
  message: p.message ?? "",
});

const sameDraft = (a: Draft, b: Draft) =>
  a.enabled === b.enabled && a.shipsAt === b.shipsAt && a.limit.trim() === b.limit.trim() && a.message.trim() === b.message.trim();

const variantName = (v: PreorderVariant) => formatOptions(v.optionValues) || v.sku || v.id.slice(0, 8);

/**
 * Product page → «الطلب المسبق»: keep selling a variant after it
 * sells out, up to a limit per variant, with the expected ship date and a
 * message for the product page; each variant's units pre-ordered so far.
 * A saved, switched-on setting folds to one line.
 */
export function PreorderSection({ productId }: { productId: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const data = useAsync(() => preordersGet(apiClient, workspaceId, productId), [workspaceId, productId]);

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
        <PreorderForm productId={productId} data={data.data} onSaved={data.setData} />
      )}
    </ProductPageCard>
  );
}

function PreorderForm({
  productId,
  data,
  onSaved,
}: {
  productId: string;
  data: ProductPreorders;
  onSaved: (next: ProductPreorders) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const switchHint = useId();
  const dateId = useId();
  const limitId = useId();
  const messageId = useId();
  const form = useRef<HTMLFormElement>(null);

  const saved = toDraft(data.preorder);
  const [draft, setDraft] = useState<Draft>(saved);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A fresh answer (saved here, or another tab) becomes the starting point.
  useEffect(() => {
    setDraft(toDraft(data.preorder));
  }, [data.preorder]);

  const dirty = !sameDraft(draft, saved);
  const showFields = draft.enabled && (expanded || dirty || !saved.enabled);
  const owed = data.variants.reduce((sum, v) => sum + v.preordered, 0);
  const pastDate = draft.shipsAt !== "" && draft.shipsAt < todayDay();

  const summary = [
    t.summaryOn,
    data.preorder.shipsAt ? fmt(t.summaryShips, { date: formatDay(data.preorder.shipsAt) }) : t.summaryNoDate,
    data.preorder.limit !== null ? fmt(t.summaryLimit, { count: countOf("piece", data.preorder.limit) }) : t.summaryNoLimit,
  ].join(" · ");

  function patch(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }));
    setSaveError(null);
  }

  function reset() {
    setDraft(saved);
    setExpanded(false);
    setDateError(null);
    setLimitError(null);
    setSaveError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    const limit = parseWholeNumber(draft.limit, 1, PREORDER_LIMIT_MAX);
    const dateOk = draft.shipsAt === "" || /^\d{4}-\d{2}-\d{2}$/.test(draft.shipsAt);
    // Checked only while the switch is on; off keeps what was saved.
    if (draft.enabled && (!dateOk || Number.isNaN(limit))) {
      setDateError(dateOk ? null : t.shipsAtBad);
      setLimitError(Number.isNaN(limit) ? t.limitBad : null);
      document.getElementById(dateOk ? limitId : dateId)?.focus();
      return;
    }
    setDateError(null);
    setLimitError(null);
    setSaving(true);
    try {
      const next = await preordersSave(apiClient, workspaceId, productId, {
        enabled: draft.enabled,
        shipsAt: draft.enabled ? draft.shipsAt || null : data.preorder.shipsAt,
        limit: draft.enabled ? (limit as number | null) : data.preorder.limit,
        message: (draft.enabled ? draft.message.trim() : data.preorder.message) || null,
      });
      onSaved(next);
      setExpanded(false);
      toast.success(t.saved);
    } catch (err) {
      setSaveError(isPermissionError(err) ? t.noManage : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            role="switch"
            className="size-5 shrink-0 cursor-pointer accent-primary"
            checked={draft.enabled}
            aria-describedby={switchHint}
            disabled={saving}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          {t.toggle}
        </label>
        <p id={switchHint} className="text-xs text-ink-soft">
          {draft.enabled ? t.hintOn : t.hintOff}
        </p>
      </div>

      {draft.enabled && !showFields && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-paper-sunken px-3 py-2">
          <p className="flex min-w-0 items-center gap-2 text-sm text-ink">
            <IconSchedule className="size-4 shrink-0 text-ink-soft" aria-hidden />
            <span className="min-w-0">{summary}</span>
          </p>
          <Button type="button" variant="ghost" className="min-h-11 shrink-0" onClick={() => setExpanded(true)}>
            {t.edit}
          </Button>
        </div>
      )}

      {showFields && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={dateId} className="block text-sm font-medium text-ink">
              {t.shipsAt}
            </label>
            <Input
              id={dateId}
              type="date"
              dir="ltr"
              value={draft.shipsAt}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={`${dateId}-hint`}
              disabled={saving}
              onChange={(e) => {
                setDateError(null);
                patch({ shipsAt: e.target.value });
              }}
              className="h-11 text-start"
            />
            <p
              id={`${dateId}-hint`}
              className={cn("text-xs", dateError ? "font-medium text-danger" : pastDate ? "font-medium text-accent-dark" : "text-ink-soft")}
            >
              {dateError ??
                (pastDate ? t.shipsAtPast : draft.shipsAt ? fmt(t.shipsAtHint, { date: formatDay(draft.shipsAt) }) : t.shipsAtEmpty)}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={limitId} className="block text-sm font-medium text-ink">
              {t.limit}
            </label>
            <Input
              id={limitId}
              type="text"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={9}
              value={draft.limit}
              aria-invalid={limitError ? true : undefined}
              aria-describedby={`${limitId}-hint`}
              disabled={saving}
              onChange={(e) => {
                setLimitError(null);
                patch({ limit: e.target.value });
              }}
              className="h-11 w-32 text-center tabular-nums"
            />
            <p id={`${limitId}-hint`} className={cn("text-xs", limitError ? "font-medium text-danger" : "text-ink-soft")}>
              {limitError ?? t.limitHint}
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={messageId} className="block text-sm font-medium text-ink">
              {t.message}
            </label>
            <Textarea
              id={messageId}
              rows={2}
              maxLength={PREORDER_MESSAGE_MAX}
              value={draft.message}
              placeholder={t.messagePlaceholder}
              aria-describedby={`${messageId}-count`}
              disabled={saving}
              onChange={(e) => patch({ message: e.target.value })}
              className="min-h-11"
            />
            <p id={`${messageId}-count`} className="text-end text-xs text-ink-soft tabular-nums">
              {fmt(t.messageCount, { n: draft.message.length, max: PREORDER_MESSAGE_MAX })}
            </p>
          </div>
        </div>
      )}

      {/* What each variant owes: shown while the switch is on, or while units are still owed. */}
      {(draft.enabled || owed > 0) && (
        <div>
          <h3 className="text-sm font-medium text-ink">{t.variants}</h3>
          {data.variants.length === 0 ? (
            <p className="mt-1 text-xs text-ink-soft">{t.noVariants}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius)] ring-1 ring-line">
              {data.variants.map((v) => (
                <li key={v.id} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="min-w-0 font-medium text-ink">{variantName(v)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-ink-soft">{fmt(t.available, { n: Math.max(0, v.available) })}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        v.preordered > 0 ? "bg-accent-soft text-accent-dark" : "bg-paper-sunken text-ink-soft"
                      )}
                    >
                      {fmt(t.preordered, { n: v.preordered })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {owed > 0 && <p className="mt-1.5 text-xs text-ink-soft">{fmt(t.summaryOwed, { count: countOf("piece", owed) })}</p>}
        </div>
      )}

      {saveError && <Alert variant="danger">{saveError}</Alert>}

      {/* Opened to look, nothing changed: one quiet button folds it back to its line. */}
      {expanded && draft.enabled && !dirty && !saving && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={reset}>
            {t.cancel}
          </Button>
        </div>
      )}

      {/* The page’s one save bar: same save, same payload (the form is submitted as before). */}
      <SectionSaveBar
        section={t.title}
        dirty={dirty}
        saving={saving}
        error={saveError ?? dateError ?? limitError}
        onSave={() => form.current?.requestSubmit()}
        onDiscard={reset}
      />
    </form>
  );
}
