import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconClose, IconPlus } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  ApiError,
  WEBHOOK_HEADER_NAME_PATTERN,
  WEBHOOK_HEADER_VALUE_MAX,
  WEBHOOK_HEADER_VALUE_PATTERN,
  WEBHOOK_MAX_CUSTOM_HEADERS,
  WEBHOOK_RESERVED_HEADER,
  webhooksUpdateEndpoint,
  type WebhookCustomHeaderInput,
  type WebhookCustomHeaderView,
  type WebhookEndpointDto,
  type WebhookEndpointWithHeaders,
  type WebhookEventInfo,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

/**
 * The parts of the webhook endpoint form:
 *
 * - the topics checklist, grouped (Orders … Funnels, Payments, Contacts) and
 *   worded per topic, so a merchant ticks "Payment received" rather than
 *   reading `payment.paid`;
 * - the custom headers repeater (an API key, an Authorization token the
 *   receiver asks for). Values are sealed by the server and never come back:
 *   a saved header shows its mask, and either keeps its value (`keep: true`)
 *   or takes a new one after "Change";
 * - the edit dialog for an existing endpoint (URL, topics, headers);
 * - the line under an endpoint naming its headers, values masked.
 */

const STRINGS = {
  en: {
    // Topics
    events: "Events",
    allEvents: "All events",
    allEventsHint: "Including events added later.",
    pickEvents: "Choose events",
    pickedCount: "{count} chosen",
    groupAll: "All of {group}",
    group_order: "Orders",
    group_shipment: "Shipments",
    group_checkout: "Checkout",
    group_customer: "Customers and leads",
    group_product: "Products and reviews",
    group_funnel: "Funnels",
    group_payment: "Payments",
    group_contact: "Contacts",
    group_other: "Other",
    "order.created": "New order",
    "order.status_changed": "Order stage changed",
    "order.updated": "Order details edited",
    "order.confirmed": "Order confirmed",
    "order.fulfilled": "Order delivered",
    "order.cancelled": "Order cancelled",
    "order.uncancelled": "Cancelled order reopened",
    "order.paid": "Order paid in full",
    "order.refunded": "Order refunded",
    "order.item_added": "Product added to an order",
    "shipment.status_changed": "Shipment status changed",
    "checkout.created": "Checkout started",
    "checkout.updated": "Checkout details changed",
    "checkout.abandoned": "Checkout left without an order",
    "customer.created": "New customer",
    "customer.updated": "Customer edited",
    "lead.created": "New lead",
    "contact_form.submitted": "Contact form sent",
    "product.created": "Product added",
    "product.updated": "Product edited",
    "product.deleted": "Product archived",
    "product.low_stock": "Stock running low",
    "review.created": "New review",
    "funnel.published": "Funnel published",
    "funnel.created": "Funnel created",
    "funnel.updated": "Funnel updated",
    "funnel.deleted": "Funnel deleted",
    "payment.paid": "Payment received",
    "contact.updated": "Contact updated",
    // Custom headers
    headersTitle: "Custom headers",
    headersHint: "Sent with every delivery to this endpoint",
    headersHidden: "Values are hidden once saved. To replace one, press Change and type it again.",
    headerName: "Header name",
    headerValue: "Value",
    headerNamePlaceholder: "Authorization",
    headerValuePlaceholder: "Bearer …",
    headerValueHint: "Latin letters, digits and symbols only — like an API key",
    savedValue: "Saved value",
    addHeader: "Add header",
    removeHeader: "Remove {name}",
    removeNewHeader: "Remove this header",
    change: "Change",
    keepCurrent: "Keep the saved value",
    headersCount: "{count} of {max}",
    headersFull: "That's the most an endpoint can carry ({max}).",
    errNameMissing: "Type the header name.",
    errNameInvalid: "Letters, numbers and dashes only — no spaces, up to 64 characters.",
    errNameReserved: "Zimos sets this header itself, so it can't be changed.",
    errNameDuplicate: "This header is already in the list.",
    errValueMissing: "Type the value.",
    errValueLong: "The value is longer than {max} characters.",
    errValueLines: "The value must be on one line.",
    errValueLatin: "Use Latin letters, digits and symbols only — Arabic and emoji can't be sent in a header.",
    errValueGone: "No saved value for this header any more. Type it again.",
    errHeader: "Check this header.",
    // Edit dialog
    editTitle: "Edit endpoint",
    url: "Endpoint URL",
    urlHint: "Must start with https://",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Endpoint saved.",
    needEvents: "Choose at least one event.",
  },
  ar: {
    events: "الأحداث",
    allEvents: "كل الأحداث",
    allEventsHint: "بما فيها ما سيُضاف لاحقًا.",
    pickEvents: "اختيار الأحداث",
    pickedCount: "{count} محدد",
    groupAll: "كل {group}",
    group_order: "الطلبات",
    group_shipment: "الشحنات",
    group_checkout: "إتمام الشراء",
    group_customer: "العملاء والعملاء المحتملون",
    group_product: "المنتجات والتقييمات",
    group_funnel: "مسارات البيع",
    group_payment: "المدفوعات",
    group_contact: "جهات الاتصال",
    group_other: "أخرى",
    "order.created": "طلب جديد",
    "order.status_changed": "تغيّرت مرحلة الطلب",
    "order.updated": "عُدّلت بيانات الطلب",
    "order.confirmed": "تم تأكيد الطلب",
    "order.fulfilled": "تم تسليم الطلب",
    "order.cancelled": "أُلغي الطلب",
    "order.uncancelled": "أُعيد طلب ملغى",
    "order.paid": "دُفع الطلب كاملًا",
    "order.refunded": "رُدّ مبلغ الطلب إلى العميل",
    "order.item_added": "أُضيف منتج إلى طلب",
    "shipment.status_changed": "تغيّرت حالة الشحنة",
    "checkout.created": "بدأ عميل إتمام الشراء",
    "checkout.updated": "تغيّرت بيانات إتمام الشراء",
    "checkout.abandoned": "سلة متروكة بلا طلب",
    "customer.created": "عميل جديد",
    "customer.updated": "عُدّلت بيانات عميل",
    "lead.created": "عميل محتمل جديد",
    "contact_form.submitted": "أُرسل نموذج تواصل",
    "product.created": "أُضيف منتج",
    "product.updated": "عُدّل منتج",
    "product.deleted": "أُرشف منتج",
    "product.low_stock": "المخزون يوشك على النفاد",
    "review.created": "تقييم جديد",
    "funnel.published": "نُشر مسار بيع",
    "funnel.created": "أُنشئ مسار بيع",
    "funnel.updated": "عُدّل مسار بيع",
    "funnel.deleted": "حُذف مسار بيع",
    "payment.paid": "وصلت دفعة",
    "contact.updated": "عُدّلت جهة اتصال",
    headersTitle: "ترويسات إضافية (Headers)",
    headersHint: "تُرسل مع كل إرسال إلى هذا العنوان",
    headersHidden: "تُخفى القيم بعد الحفظ. لتغيير واحدة، اضغط «تغيير» واكتبها من جديد.",
    headerName: "اسم الترويسة",
    headerValue: "القيمة",
    headerNamePlaceholder: "Authorization",
    headerValuePlaceholder: "Bearer …",
    headerValueHint: "أحرف لاتينية وأرقام ورموز فقط — مثل مفتاح API",
    savedValue: "القيمة المحفوظة",
    addHeader: "إضافة ترويسة",
    removeHeader: "إزالة {name}",
    removeNewHeader: "إزالة هذه الترويسة",
    change: "تغيير",
    keepCurrent: "الإبقاء على القيمة المحفوظة",
    headersCount: "{count} من {max}",
    headersFull: "هذا أقصى عدد للعنوان الواحد ({max}).",
    errNameMissing: "اكتب اسم الترويسة.",
    errNameInvalid: "أحرف لاتينية وأرقام وشرطة فقط — بدون مسافات، حتى ٦٤ حرفًا.",
    errNameReserved: "زيموس يضع هذه الترويسة بنفسه، لذلك لا يمكن تغييرها.",
    errNameDuplicate: "هذه الترويسة موجودة في القائمة بالفعل.",
    errValueMissing: "اكتب القيمة.",
    errValueLong: "القيمة أطول من {max} حرف.",
    errValueLines: "يجب أن تكون القيمة في سطر واحد.",
    errValueLatin: "اكتب أحرفًا لاتينية وأرقامًا ورموزًا فقط — لا يمكن إرسال العربية والرموز التعبيرية في ترويسة.",
    errValueGone: "لا توجد قيمة محفوظة لهذه الترويسة الآن. اكتبها من جديد.",
    errHeader: "راجع هذه الترويسة.",
    editTitle: "تعديل الرابط",
    url: "الرابط",
    urlHint: "يجب أن يبدأ بـ https://",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    saved: "تم حفظ الرابط.",
    needEvents: "اختر حدثًا واحدًا على الأقل.",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

// ───────────────────────────── topics ─────────────────────────────

/** Topic prefix → group, in the order the groups are shown. */
const GROUPS = [
  { key: "order", prefixes: ["order."] },
  { key: "shipment", prefixes: ["shipment."] },
  { key: "checkout", prefixes: ["checkout."] },
  { key: "customer", prefixes: ["customer.", "lead.", "contact_form."] },
  { key: "product", prefixes: ["product.", "review."] },
  { key: "funnel", prefixes: ["funnel."] },
  { key: "payment", prefixes: ["payment."] },
  { key: "contact", prefixes: ["contact."] },
] as const;

type GroupKey = (typeof GROUPS)[number]["key"] | "other";

function groupOf(name: string): GroupKey {
  return GROUPS.find((group) => group.prefixes.some((prefix) => name.startsWith(prefix)))?.key ?? "other";
}

/** A topic's words in the active language; a topic added later shows its name (and, in English, the server's sentence). */
function topicLabel(t: T, event: WebhookEventInfo, locale: string): string {
  const own = (t as Record<string, string>)[event.name];
  if (own) return own;
  return locale === "en" && event.description ? event.description : event.name;
}

/** "All events" or a grouped checklist of the topics the server offers. */
export function WebhookTopicsField({
  events,
  all,
  picked,
  onAllChange,
  onPickedChange,
  error,
}: {
  events: WebhookEventInfo[];
  all: boolean;
  picked: string[];
  onAllChange: (all: boolean) => void;
  onPickedChange: (picked: string[]) => void;
  error?: string;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const groups = [...GROUPS.map((g) => g.key), "other" as const]
    .map((key) => ({ key, events: events.filter((event) => groupOf(event.name) === key) }))
    .filter((group) => group.events.length > 0);

  function toggle(names: string[], on: boolean) {
    const rest = picked.filter((name) => !names.includes(name));
    onPickedChange(on ? [...rest, ...names] : rest);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-ink">{t.events}</legend>
      <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1">
        <input type="radio" name="webhook-events" className="mt-1 size-4 accent-primary" checked={all} onChange={() => onAllChange(true)} />
        <span>
          <span className="block text-sm text-ink">{t.allEvents}</span>
          <span className="block text-xs text-ink-soft">{t.allEventsHint}</span>
        </span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-2">
        <input type="radio" name="webhook-events" className="size-4 accent-primary" checked={!all} onChange={() => onAllChange(false)} />
        <span className="text-sm text-ink">{t.pickEvents}</span>
        {!all && picked.length > 0 && <span className="text-xs text-ink-soft">· {fmt(t.pickedCount, { count: picked.length })}</span>}
      </label>
      {!all && (
        <div className="gap-3 sm:columns-2">
          {groups.map((group) => {
            const names = group.events.map((event) => event.name);
            const chosen = names.filter((name) => picked.includes(name)).length;
            const groupName = t[`group_${group.key}`];
            return (
              <fieldset key={group.key} className="mb-3 break-inside-avoid rounded-[var(--radius)] border border-line p-3">
                <legend className="sr-only">{groupName}</legend>
                <GroupToggle
                  label={groupName}
                  ariaLabel={fmt(t.groupAll, { group: groupName })}
                  state={chosen === 0 ? "none" : chosen === names.length ? "all" : "some"}
                  onChange={(on) => toggle(names, on)}
                />
                <div className="mt-1 space-y-0.5 ps-6">
                  {group.events.map((event) => (
                    <label key={event.name} className="flex min-h-10 cursor-pointer items-start gap-2 py-1">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                        checked={picked.includes(event.name)}
                        onChange={(e) => toggle([event.name], e.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-ink">{topicLabel(t, event, locale)}</span>
                        <code dir="ltr" className="block break-all font-mono text-[11px] text-ink-soft">
                          {event.name}
                        </code>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

/** A group's heading as a checkbox: ticks or clears every topic in it; half-ticked when some are chosen. */
function GroupToggle({
  label,
  ariaLabel,
  state,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  state: "none" | "some" | "all";
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2">
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        className="size-4 accent-primary"
        checked={state === "all"}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

// ───────────────────────────── custom headers ─────────────────────────────

/**
 * One row of the repeater. A saved row (`stored`) keeps its name and shows the
 * mask; it sends `keep: true` unless "Change" was pressed and a new value typed.
 */
export interface HeaderRow {
  key: string;
  name: string;
  value: string;
  stored: WebhookCustomHeaderView | null;
  changing: boolean;
}

export type HeaderErrors = Record<string, { name?: string; value?: string }>;

let rowSeq = 0;
const newRow = (): HeaderRow => ({ key: `h${++rowSeq}`, name: "", value: "", stored: null, changing: false });

/** The rows for an endpoint's saved headers. */
export function headerRowsFrom(headers: WebhookCustomHeaderView[] | undefined): HeaderRow[] {
  return (headers ?? []).map((header) => ({ key: `h${++rowSeq}`, name: header.name, value: "", stored: header, changing: false }));
}

const isBlankNew = (row: HeaderRow) => !row.stored && row.name.trim() === "" && row.value === "";

/**
 * Checks the rows the way the server will and builds the list to send. Blank
 * new rows are dropped. `keys[i]` is the row behind `customHeaders[i]`, so a
 * server error on an index lands on the right row.
 */
function buildHeaders(t: T, rows: HeaderRow[]): { payload: WebhookCustomHeaderInput[]; keys: string[]; errors: HeaderErrors } {
  const errors: HeaderErrors = {};
  const payload: WebhookCustomHeaderInput[] = [];
  const keys: string[] = [];
  const seen = new Set<string>();
  const max = String(WEBHOOK_HEADER_VALUE_MAX);
  for (const row of rows) {
    if (isBlankNew(row)) continue;
    const name = row.stored ? row.stored.name : row.name.trim();
    const problem: { name?: string; value?: string } = {};
    if (!row.stored) {
      if (!name) problem.name = t.errNameMissing;
      else if (WEBHOOK_RESERVED_HEADER.test(name)) problem.name = t.errNameReserved;
      else if (!WEBHOOK_HEADER_NAME_PATTERN.test(name)) problem.name = t.errNameInvalid;
    }
    if (name && !problem.name) {
      if (seen.has(name.toLowerCase())) problem.name = t.errNameDuplicate;
      seen.add(name.toLowerCase());
    }
    const sendsValue = !row.stored || row.changing;
    if (sendsValue) {
      if (row.value === "") problem.value = t.errValueMissing;
      else if (row.value.length > WEBHOOK_HEADER_VALUE_MAX) problem.value = fmt(t.errValueLong, { max });
      else if (/[\r\n]/.test(row.value)) problem.value = t.errValueLines;
      // Only what an HTTP header can carry.
      else if (!WEBHOOK_HEADER_VALUE_PATTERN.test(row.value)) problem.value = t.errValueLatin;
    }
    if (problem.name || problem.value) errors[row.key] = problem;
    payload.push(sendsValue ? { name, value: row.value } : { name, keep: true });
    keys.push(row.key);
  }
  return { payload, keys, errors };
}

/** The server's 422 details on `customHeaders.<i>…`, as row errors in the reader's words. */
function serverHeaderErrors(t: T, err: unknown, keys: string[]): HeaderErrors {
  if (!(err instanceof ApiError)) return {};
  const body = err.details as { error?: { details?: Array<{ field?: string; message?: string }> } } | undefined;
  const out: HeaderErrors = {};
  for (const detail of body?.error?.details ?? []) {
    const match = /^customHeaders\.(\d+)(?:\.(name|value))?$/.exec(detail.field ?? "");
    if (!match) continue;
    const key = keys[Number(match[1])];
    if (!key) continue;
    const message = detail.message ?? "";
    const row = (out[key] ??= {});
    if (/set by Zimos/i.test(message)) row.name = t.errNameReserved;
    else if (/No stored value/i.test(message)) row.value = t.errValueGone;
    else if (/duplicate|unique/i.test(message)) row.name = t.errNameDuplicate;
    else if (match[2] === "value") row.value = /length|long|1000/i.test(message) ? fmt(t.errValueLong, { max: String(WEBHOOK_HEADER_VALUE_MAX) }) : /Latin/i.test(message) ? t.errValueLatin : /pattern/i.test(message) ? t.errValueLines : t.errHeader;
    else row.name = /pattern/i.test(message) ? t.errNameInvalid : t.errHeader;
  }
  return out;
}

/**
 * State for the headers repeater: the rows, their errors, `build()` before a
 * save (null when a row needs fixing) and `fromServer(err)` after a refusal.
 */
export function useWebhookHeaders(initial: WebhookCustomHeaderView[] | undefined = undefined) {
  const t = useT(STRINGS);
  const [rows, setRows] = useState<HeaderRow[]>(() => headerRowsFrom(initial));
  const [errors, setErrors] = useState<HeaderErrors>({});
  const lastKeys = useRef<string[]>([]);

  function build(): WebhookCustomHeaderInput[] | null {
    const { payload, keys, errors: found } = buildHeaders(t, rows);
    setErrors(found);
    lastKeys.current = keys;
    return Object.keys(found).length > 0 ? null : payload;
  }

  /** True when the refusal was about a header (its row now says why). */
  function fromServer(err: unknown): boolean {
    const found = serverHeaderErrors(t, err, lastKeys.current);
    setErrors(found);
    return Object.keys(found).length > 0;
  }

  function reset(next: WebhookCustomHeaderView[] | undefined = undefined) {
    setRows(headerRowsFrom(next));
    setErrors({});
  }

  return { rows, setRows, errors, setErrors, build, fromServer, reset };
}

/** The "Custom headers" repeater: name + value rows, add/remove, at most ten. */
export function WebhookHeadersField({
  rows,
  errors,
  onChange,
  onErrorsChange,
}: {
  rows: HeaderRow[];
  errors: HeaderErrors;
  onChange: (rows: HeaderRow[]) => void;
  onErrorsChange: (errors: HeaderErrors) => void;
}) {
  const t = useT(STRINGS);
  const max = WEBHOOK_MAX_CUSTOM_HEADERS;
  const full = rows.length >= max;
  const hasStored = rows.some((row) => row.stored);

  function update(key: string, patch: Partial<HeaderRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if (errors[key]) {
      const next = { ...errors };
      delete next[key];
      onErrorsChange(next);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{t.headersTitle}</legend>
      <p className="text-xs text-ink-soft">
        {t.headersHint}
        {hasStored ? `. ${t.headersHidden}` : "."}
      </p>
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row) => {
            const error = errors[row.key];
            const nameId = `webhook-header-${row.key}-name`;
            const valueId = `webhook-header-${row.key}-value`;
            const removeLabel = row.stored || row.name.trim() ? fmt(t.removeHeader, { name: row.stored?.name ?? row.name.trim() }) : t.removeNewHeader;
            return (
              <li key={row.key} className="rounded-[var(--radius)] border border-line bg-paper-raised p-3">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    {/* Name */}
                    <div className="min-w-0 space-y-1">
                      {row.stored ? (
                        <span className="block text-xs font-medium text-ink-soft">{t.headerName}</span>
                      ) : (
                        <label htmlFor={nameId} className="block text-xs font-medium text-ink-soft">
                          {t.headerName}
                        </label>
                      )}
                      {row.stored ? (
                        <p className="flex min-h-10 items-center">
                          <code dir="ltr" className="break-all font-mono text-sm text-ink">
                            {row.stored.name}
                          </code>
                        </p>
                      ) : (
                        <Input
                          id={nameId}
                          dir="ltr"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={64}
                          placeholder={t.headerNamePlaceholder}
                          value={row.name}
                          aria-invalid={error?.name ? true : undefined}
                          aria-describedby={error?.name ? `${nameId}-error` : undefined}
                          className={cn("font-mono", error?.name && "border-danger")}
                          onChange={(e) => update(row.key, { name: e.target.value })}
                        />
                      )}
                      {error?.name && (
                        <p id={`${nameId}-error`} className="text-xs font-medium text-danger">
                          {error.name}
                        </p>
                      )}
                    </div>
                    {/* Value */}
                    <div className="min-w-0 space-y-1">
                      {row.stored && !row.changing ? (
                        <span className="block text-xs font-medium text-ink-soft">{t.savedValue}</span>
                      ) : (
                        <label htmlFor={valueId} className="block text-xs font-medium text-ink-soft">
                          {t.headerValue}
                        </label>
                      )}
                      {row.stored && !row.changing ? (
                        <div className="flex min-h-10 flex-wrap items-center gap-2">
                          <code dir="ltr" className="font-mono text-sm text-ink-soft">
                            {row.stored.valueMask}
                          </code>
                          <Button type="button" size="sm" variant="outline" className="min-h-10 sm:min-h-8" onClick={() => update(row.key, { changing: true, value: "" })}>
                            {t.change}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Input
                            id={valueId}
                            type="password"
                            dir="ltr"
                            autoComplete="new-password"
                            spellCheck={false}
                            maxLength={WEBHOOK_HEADER_VALUE_MAX}
                            placeholder={t.headerValuePlaceholder}
                            value={row.value}
                            aria-invalid={error?.value ? true : undefined}
                            aria-describedby={error?.value ? `${valueId}-error` : `${valueId}-hint`}
                            className={cn("font-mono", error?.value && "border-danger")}
                            onChange={(e) => update(row.key, { value: e.target.value })}
                          />
                          {!error?.value && (
                            <p id={`${valueId}-hint`} className="text-xs text-ink-soft">
                              {t.headerValueHint}
                            </p>
                          )}
                          {row.stored && (
                            <button
                              type="button"
                              className="min-h-10 cursor-pointer text-xs font-medium text-primary hover:underline sm:min-h-0"
                              onClick={() => update(row.key, { changing: false, value: "" })}
                            >
                              {t.keepCurrent}
                            </button>
                          )}
                        </>
                      )}
                      {error?.value && (
                        <p id={`${valueId}-error`} className="text-xs font-medium text-danger">
                          {error.value}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={removeLabel}
                    title={removeLabel}
                    className="-me-1 -mt-1 size-11 shrink-0 sm:size-9"
                    onClick={() => {
                      onChange(rows.filter((r) => r.key !== row.key));
                      if (errors[row.key]) {
                        const next = { ...errors };
                        delete next[row.key];
                        onErrorsChange(next);
                      }
                    }}
                  >
                    <IconClose className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" disabled={full} onClick={() => onChange([...rows, newRow()])}>
          <IconPlus className="size-4" aria-hidden />
          {t.addHeader}
        </Button>
        {rows.length > 0 && (
          <span className="text-xs tabular-nums text-ink-soft">
            {full ? fmt(t.headersFull, { max }) : fmt(t.headersCount, { count: rows.length, max })}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/** Under an endpoint's row: the headers it sends, values masked as the server shows them. */
export function WebhookHeadersNote({ endpoint }: { endpoint: WebhookEndpointDto }) {
  const t = useT(STRINGS);
  const headers = (endpoint as WebhookEndpointWithHeaders).customHeaders ?? [];
  if (headers.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
      <span>{t.headersTitle}:</span>
      {headers.map((header) => (
        <code key={header.name} dir="ltr" className="rounded bg-paper-sunken px-1.5 py-0.5 font-mono text-ink">
          {header.name} {header.valueMask}
        </code>
      ))}
    </p>
  );
}

// ───────────────────────────── edit dialog ─────────────────────────────

/** Edits an endpoint's URL, topics and custom headers (PATCH; the headers list is sent whole). */
export function EditWebhookEndpointModal({
  endpoint,
  events,
  explicitOnly = [],
  onClose,
  onSaved,
}: {
  endpoint: WebhookEndpointDto;
  events: WebhookEventInfo[];
  /** Events "*" leaves out (order.accepted): kept beside "*" when the endpoint already lists them. */
  explicitOnly?: string[];
  onClose: () => void;
  onSaved: (endpoint: WebhookEndpointWithHeaders) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const toast = useToast();
  const [url, setUrl] = useState(endpoint.url);
  const [all, setAll] = useState(endpoint.events.includes("*"));
  const [picked, setPicked] = useState<string[]>(endpoint.events.filter((name) => name !== "*"));
  const headers = useWebhookHeaders((endpoint as WebhookEndpointWithHeaders).customHeaders);
  const [eventsError, setEventsError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const noEvents = !all && picked.length === 0;
    setEventsError(noEvents ? t.needEvents : undefined);
    const customHeaders = headers.build();
    if (noEvents || !customHeaders) return;
    setBusy(true);
    try {
      const saved = await webhooksUpdateEndpoint(apiClient, workspaceId, endpoint.id, {
        url: url.trim(),
        events: all ? ["*", ...picked.filter((name) => explicitOnly.includes(name))] : picked,
        customHeaders,
      });
      toast.success(t.saved);
      onSaved(saved);
    } catch (err) {
      headers.fromServer(err);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.editTitle} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <TextField
          label={t.url}
          hint={t.urlHint}
          type="url"
          dir="ltr"
          placeholder="https://"
          value={url}
          required
          onChange={(e) => setUrl(e.target.value)}
        />
        <WebhookTopicsField
          events={events}
          all={all}
          picked={picked}
          onAllChange={setAll}
          onPickedChange={(next) => {
            setPicked(next);
            if (next.length > 0) setEventsError(undefined);
          }}
          error={eventsError}
        />
        <WebhookHeadersField rows={headers.rows} errors={headers.errors} onChange={headers.setRows} onErrorsChange={headers.setErrors} />
        {error && (
          <Alert variant="danger" className="text-start">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={busy || url.trim() === ""}>
            {busy ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

