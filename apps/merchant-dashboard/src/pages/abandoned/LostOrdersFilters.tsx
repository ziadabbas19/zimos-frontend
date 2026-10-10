import {
  LOST_ORDER_REASONS,
  LOST_ORDER_RECOVERY_STATUSES,
  type LostOrderFilters,
  type LostOrderReason,
  type LostOrderRecoveryStatus,
  type LostOrderReviewStatus,
  type LostOrderTab,
} from "@store-builder/api-client";
import { TextField } from "@/components/Field";
import { IconClose } from "@/components/icons";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { LostOrderProductFilter, type LostOrderProductOption } from "./LostOrdersBulk";
import { useLostOrderLabels } from "./lostOrderLabels";
import { presetOf, rangeOf, type RangePreset } from "./lostOrderModel";

const STRINGS = {
  en: {
    recovery: "Recovery",
    reason: "Reason",
    period: "Last activity",
    periodHint: "When the shopper last did something at checkout.",
    today: "Today",
    last: "Last {span}",
    from: "From",
    to: "To",
    source: "Source",
    product: "Product",
    review: "Review",
    reviewHint: "Whether you are done looking at it.",
    active: "Filters in effect",
    removeFilter: "Remove the filter: {filter}",
    clearAll: "Clear all",
    chip: "{name}: {value}",
    periodFrom: "From {from}",
    periodTo: "Until {to}",
    periodBoth: "{from} – {to}",
  },
  ar: {
    recovery: "الاسترجاع",
    reason: "السبب",
    period: "آخر نشاط",
    periodHint: "آخر مرة فعل فيها العميل شيئًا في الطلب.",
    today: "اليوم",
    last: "آخر {span}",
    from: "من",
    to: "إلى",
    source: "المصدر",
    product: "المنتج",
    review: "المراجعة",
    reviewHint: "هل انتهيت من مراجعته أم لا.",
    active: "الفلاتر المفعّلة",
    removeFilter: "إزالة الفلتر: {filter}",
    clearAll: "مسح الكل",
    chip: "{name}: {value}",
    periodFrom: "من {from}",
    periodTo: "حتى {to}",
    periodBoth: "{from} – {to}",
  },
} satisfies Messages;

/** What the filter sheet holds. "" is "not set". The tab is not here: it lives in the URL (?tab=). */
export interface LostOrderFilterState {
  reason: "" | LostOrderReason;
  source: "" | "store" | "funnel";
  /** YYYY-MM-DD, on the last activity. */
  from: string;
  to: string;
  productId: string;
  reviewStatus: "" | LostOrderReviewStatus;
  recoveryStatus: "" | LostOrderRecoveryStatus;
}

export const NO_FILTERS: LostOrderFilterState = {
  reason: "",
  source: "",
  from: "",
  to: "",
  productId: "",
  reviewStatus: "",
  recoveryStatus: "",
};

/** How many filters are in effect (the two dates count as one). */
export function countFilters(value: LostOrderFilterState): number {
  return [value.recoveryStatus, value.reason, value.from || value.to, value.source, value.productId, value.reviewStatus].filter(Boolean)
    .length;
}

/** The query GET /checkout-sessions and the export take: the tab plus the filters, dates as whole local days. */
export function toLostOrderQuery(tab: LostOrderTab, value: LostOrderFilterState): LostOrderFilters {
  return {
    tab,
    lostReason: value.reason || undefined,
    reviewStatus: value.reviewStatus || undefined,
    recoveryStatus: value.recoveryStatus || undefined,
    source: value.source || undefined,
    from: value.from ? new Date(`${value.from}T00:00:00`).toISOString() : undefined,
    to: value.to ? new Date(`${value.to}T23:59:59`).toISOString() : undefined,
    productId: value.productId || undefined,
  };
}

const REVIEW_STATUSES: readonly LostOrderReviewStatus[] = ["under_review", "completed"];
const SOURCES: readonly ("store" | "funnel")[] = ["store", "funnel"];
const PRESETS: readonly RangePreset[] = ["today", "7", "30"];

/** A date field's own day, for a chip: «١ أكتوبر ٢٠٢٦». */
function dayLabel(day: string): string {
  return formatDate(`${day}T00:00:00`);
}

/**
 * The one place the list is filtered (the tabs apart): recovery status, the
 * reason, the dates of the last activity (three shortcuts and the two fields
 * they fill), the source, and — folded, because few reach for them — the
 * product and the review status. Every change applies at once; the list
 * behind is already the answer.
 */
export function LostOrdersFilterSheet({
  open,
  onOpenChange,
  value,
  onChange,
  products,
  applyLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LostOrderFilterState;
  onChange: (next: LostOrderFilterState) => void;
  products: readonly LostOrderProductOption[];
  /** «اعرض ٢٠ أوردر»: what is waiting behind the sheet. */
  applyLabel: string;
}) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const set = (patch: Partial<LostOrderFilterState>) => onChange({ ...value, ...patch });
  const presetLabel = (preset: RangePreset) => (preset === "today" ? t.today : fmt(t.last, { span: countOf("day", Number(preset)) }));

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      activeCount={countFilters(value)}
      onReset={() => onChange(NO_FILTERS)}
      applyLabel={applyLabel}
    >
      <FilterGroup label={t.recovery}>
        <FilterChoice
          label={t.recovery}
          allowClear
          options={LOST_ORDER_RECOVERY_STATUSES.map((key) => ({ value: key, label: labels.recovery(key) }))}
          value={value.recoveryStatus || null}
          onChange={(next) => set({ recoveryStatus: next ?? "" })}
        />
      </FilterGroup>

      <FilterGroup label={t.reason}>
        <FilterChoice
          label={t.reason}
          allowClear
          options={LOST_ORDER_REASONS.map((key) => ({ value: key, label: labels.reason(key) }))}
          value={value.reason || null}
          onChange={(next) => set({ reason: next ?? "" })}
        />
      </FilterGroup>

      <FilterGroup label={t.period} hint={t.periodHint}>
        <FilterChoice
          label={t.period}
          allowClear
          options={PRESETS.map((preset) => ({ value: preset, label: presetLabel(preset) }))}
          value={presetOf(value.from, value.to)}
          onChange={(next) => set(next ? rangeOf(next) : { from: "", to: "" })}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TextField
            label={t.from}
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set({ from: e.target.value })}
          />
          <TextField
            label={t.to}
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set({ to: e.target.value })}
          />
        </div>
      </FilterGroup>

      <FilterGroup label={t.source}>
        <FilterChoice
          label={t.source}
          allowClear
          options={SOURCES.map((key) => ({ value: key, label: labels.source(key) }))}
          value={value.source || null}
          onChange={(next) => set({ source: next ?? "" })}
        />
      </FilterGroup>

      <FilterGroup label={t.product} collapsible defaultOpen={Boolean(value.productId)}>
        <LostOrderProductFilter value={value.productId} onChange={(productId) => set({ productId })} products={products} />
      </FilterGroup>

      <FilterGroup label={t.review} hint={t.reviewHint} collapsible defaultOpen={Boolean(value.reviewStatus)}>
        <FilterChoice
          label={t.review}
          allowClear
          options={REVIEW_STATUSES.map((key) => ({ value: key, label: labels.review(key) }))}
          value={value.reviewStatus || null}
          onChange={(next) => set({ reviewStatus: next ?? "" })}
        />
      </FilterGroup>
    </FilterSheet>
  );
}

// The same small pane as a chip of the row over the list (glass/list.css styles `.zimos-chip` once): 36px
// with a mouse, 44px under a finger. The whole chip is the button that lets go of its filter.
const ACTIVE_CHIP =
  "zimos-chip inline-flex h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised ps-3.5 pe-2.5 text-[13px] font-medium text-ink ring-1 ring-line select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";

/**
 * The filters in effect, as removable chips under the tabs — drawn only while
 * any is set — with «امسح الكل» after them. A press on a chip lets go of that
 * one filter.
 */
export function LostOrdersActiveFilters({
  value,
  onChange,
  products,
}: {
  value: LostOrderFilterState;
  onChange: (next: LostOrderFilterState) => void;
  products: readonly LostOrderProductOption[];
}) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const named = (name: string, text: string) => fmt(t.chip, { name, value: text });

  const chips: { id: string; label: string; clear: Partial<LostOrderFilterState> }[] = [];
  if (value.recoveryStatus) {
    chips.push({ id: "recovery", label: named(t.recovery, labels.recovery(value.recoveryStatus)), clear: { recoveryStatus: "" } });
  }
  if (value.reason) chips.push({ id: "reason", label: named(t.reason, labels.reason(value.reason)), clear: { reason: "" } });
  if (value.from || value.to) {
    const preset = presetOf(value.from, value.to);
    let text: string;
    if (preset === "today") text = t.today;
    else if (preset) text = fmt(t.last, { span: countOf("day", Number(preset)) });
    else if (value.from && value.to) text = fmt(t.periodBoth, { from: dayLabel(value.from), to: dayLabel(value.to) });
    else if (value.from) text = fmt(t.periodFrom, { from: dayLabel(value.from) });
    else text = fmt(t.periodTo, { to: dayLabel(value.to) });
    chips.push({ id: "period", label: named(t.period, text), clear: { from: "", to: "" } });
  }
  if (value.source) chips.push({ id: "source", label: named(t.source, labels.source(value.source)), clear: { source: "" } });
  if (value.productId) {
    const product = products.find((p) => p.id === value.productId);
    chips.push({ id: "product", label: product ? named(t.product, product.name) : t.product, clear: { productId: "" } });
  }
  if (value.reviewStatus) {
    chips.push({ id: "review", label: named(t.review, labels.review(value.reviewStatus)), clear: { reviewStatus: "" } });
  }
  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={t.active} data-slot="lost-active-filters" className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange({ ...value, ...chip.clear })}
          aria-label={fmt(t.removeFilter, { filter: chip.label })}
          title={fmt(t.removeFilter, { filter: chip.label })}
          className={ACTIVE_CHIP}
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <IconClose className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(NO_FILTERS)}
        className="inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-[13px] font-medium text-ink-soft underline underline-offset-4 transition-colors duration-[var(--dur-fade)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:h-11"
      >
        {t.clearAll}
      </button>
    </div>
  );
}
