import { useId, useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { Input, ZLoader } from "@store-builder/ui";
import { vipTiersGet, type Discount, type DiscountAudience, type DiscountType } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Textarea } from "@/components/Textarea";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DISCOUNT_STRINGS } from "./discountModel";
import { WEEK_DAYS, controlsDraftOf, takesShipping, type ControlsDraft, type ControlsProblem } from "./couponControls";
import { matchesFolded } from "./foldText";

/*
 * The coupon controls' fields (couponControls.ts holds the model): who may use
 * it, the weekly hours, what it leaves out, its cap, its minimum quantity and
 * the strict per-customer count. The coupon form lays them out in its
 * sections; the bulk codes dialog shows the same fields under «قواعد إضافية».
 */

export const CONTROL_STRINGS = {
  en: {
    sectionTypeValue: "Type and value",
    sectionWhen: "When",
    sectionOnWhat: "On what",
    sectionWho: "For whom",
    sectionLimits: "Limits",
    maxDiscount: "Maximum discount",
    maxDiscountHint: "Optional — the most this percentage takes off one order.",
    maxInvalid: "Enter an amount above zero, or leave it empty.",
    active: "Active",
    activeHintNew: "Off: it is saved paused, and shoppers can't use it until you turn it on.",
    activeHintEdit: "Turns it on or off right away, without saving the form.",
    startTime: "Start time",
    endTime: "End time",
    timeHint: "Optional.",
    timeNeedsDate: "Choose the date for this time.",
    endBeforeStart: "The end must come after the start.",
    scheduleOn: "Only on certain days and hours",
    scheduleHint: "Cairo time. Outside these hours the code is refused.",
    days: "Days",
    from: "From",
    to: "To",
    toHint: "00:00 is the end of the day; an end before the start runs past midnight.",
    daysRequired: "Choose at least one day.",
    timeInvalid: "Enter both times.",
    sameTimes: "The start and end times can't be the same.",
    specificCollections: "Specific collections",
    collectionsRequired: "Select at least one collection, or switch to all products.",
    filterCollections: "Filter collections…",
    noCollections: "No collections yet — create one in Catalog first.",
    noCollectionMatch: "No collections match.",
    excludeOn: "Leave some products out",
    excludedRequired: "Select the products to leave out, or turn this off.",
    appliesToShipping: "Take it off the shipping fee too",
    appliesToShippingHint: "The discount also covers the delivery fee.",
    appliesToDiscounted: "Apply to items already on sale",
    appliesToDiscountedHint: "Items with a sale price or a quantity discount.",
    combinesWithOffers: "Apply to offers, bumps, upsells and bundles",
    combinesWithOffersHint: "Off: those lines in the cart keep their own price.",
    oneCouponRule: "One discount per order: a code the shopper types replaces the automatic discount.",
    audience: "Who can use it",
    audience_any: "Everyone",
    audience_new: "First order only",
    audience_existing: "Returning customers only",
    audienceHint: "A first order means no earlier order in your store that wasn't cancelled.",
    phones: "Only these phone numbers",
    phonesHint: "Optional — one per line or separated by commas. Empty: any number.",
    phoneInvalid: "“{phone}” is not a phone number.",
    phonesTooMany: "Up to 500 numbers.",
    phonesServer: "One of the numbers is not a phone number.",
    vipTiers: "Only these VIP tiers",
    vipTiersHint: "Optional — with none chosen, every customer.",
    minQuantity: "Minimum quantity",
    minQuantityHint: "Optional — pieces of the covered products in the cart.",
    minQuantityInvalid: "Enter a whole number from 1 to 10,000.",
    strict: "Count the same e-mail and device as the same customer",
    strictHint: "The per-customer limit then can't be dodged with another phone number.",
    moreRules: "More rules",
    moreRulesHint: "Who, when and on what — the same as for one code.",
  },
  ar: {
    sectionTypeValue: "النوع والقيمة",
    sectionWhen: "التوقيت",
    sectionOnWhat: "على ماذا",
    sectionWho: "لمن",
    sectionLimits: "الحدود",
    maxDiscount: "الحد الأقصى للخصم",
    maxDiscountHint: "اختياري — أكبر مبلغ تخصمه هذه النسبة من الطلب الواحد.",
    maxInvalid: "أدخل مبلغًا أكبر من صفر، أو اتركه فارغًا.",
    active: "مفعّل",
    activeHintNew: "عند الإيقاف يُحفظ الخصم متوقفًا، ولا يستطيع العملاء استخدامه حتى تفعّله.",
    activeHintEdit: "يفعّل الخصم أو يوقفه فورًا، دون حفظ النموذج.",
    startTime: "وقت البداية",
    endTime: "وقت النهاية",
    timeHint: "اختياري.",
    timeNeedsDate: "اختر التاريخ لهذا الوقت.",
    endBeforeStart: "يجب أن تكون النهاية بعد البداية.",
    scheduleOn: "في أيام وساعات محددة فقط",
    scheduleHint: "بتوقيت القاهرة. خارج هذه الساعات يُرفض الكود.",
    days: "الأيام",
    from: "من",
    to: "إلى",
    toHint: "00:00 تعني نهاية اليوم، والنهاية قبل البداية تمتد بعد منتصف الليل.",
    daysRequired: "اختر يومًا واحدًا على الأقل.",
    timeInvalid: "أدخل الوقتين.",
    sameTimes: "لا يمكن أن يتساوى وقت البداية ووقت النهاية.",
    specificCollections: "مجموعات محددة",
    collectionsRequired: "اختر مجموعة واحدة على الأقل، أو اختر «كل المنتجات».",
    filterCollections: "ابحث في المجموعات…",
    noCollections: "لا توجد مجموعات بعد — أنشئ مجموعة من صفحة المنتجات أولًا.",
    noCollectionMatch: "لا توجد مجموعات مطابقة.",
    excludeOn: "استثناء بعض المنتجات",
    excludedRequired: "اختر المنتجات المستثناة، أو أوقف هذا الخيار.",
    appliesToShipping: "يشمل رسوم الشحن أيضًا",
    appliesToShippingHint: "يُخصم من رسوم التوصيل كذلك.",
    appliesToDiscounted: "يشمل المنتجات المخفّضة بالفعل",
    appliesToDiscountedHint: "المنتجات التي لها سعر تخفيض أو خصم على الكمية.",
    combinesWithOffers: "يشمل العروض والإضافات والباقات",
    combinesWithOffersHint: "عند الإيقاف تبقى هذه البنود في السلة بسعرها.",
    oneCouponRule: "خصم واحد لكل طلب: الكود الذي يكتبه العميل يحلّ محل الخصم التلقائي.",
    audience: "من يمكنه استخدامه",
    audience_any: "الجميع",
    audience_new: "أول طلب فقط",
    audience_existing: "العملاء العائدون فقط",
    audienceHint: "أول طلب يعني ألا يكون للعميل طلب سابق في متجرك غير ملغى.",
    phones: "هذه الأرقام فقط",
    phonesHint: "اختياري — رقم في كل سطر أو مفصولة بفواصل. إن تُرك فارغًا: أي رقم.",
    phoneInvalid: "«{phone}» ليس رقم هاتف.",
    phonesTooMany: "500 رقم كحد أقصى.",
    phonesServer: "أحد الأرقام ليس رقم هاتف.",
    vipTiers: "مستويات VIP هذه فقط",
    vipTiersHint: "اختياري — إن لم تختر شيئًا: كل العملاء.",
    minQuantity: "الحد الأدنى للكمية",
    minQuantityHint: "اختياري — عدد قطع المنتجات المشمولة في السلة.",
    minQuantityInvalid: "أدخل رقمًا صحيحًا من 1 إلى 10000.",
    strict: "احتساب البريد الإلكتروني والجهاز نفسيهما كعميل واحد",
    strictHint: "فلا يمكن التحايل على الحد لكل عميل برقم هاتف آخر.",
    moreRules: "قواعد إضافية",
    moreRulesHint: "لمن ومتى وعلى ماذا — كما في الكود الواحد.",
  },
} satisfies Messages;

export type ControlStrings = (typeof CONTROL_STRINGS)["en"];

export interface CouponControls {
  draft: ControlsDraft;
  set: <K extends keyof ControlsDraft>(key: K, value: ControlsDraft[K]) => void;
}

/** The controls' state: the stored ones of `discount`, or a new coupon's. */
export function useCouponControls(discount?: Discount): CouponControls {
  const [draft, setDraft] = useState(() => controlsDraftOf(discount));
  const set = <K extends keyof ControlsDraft>(key: K, value: ControlsDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  return { draft, set };
}

/** The problems of readControls() as messages, by field. */
export function controlsMessages(problems: readonly ControlsProblem[], t: ControlStrings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const problem of problems) {
    if (out[problem.field]) continue;
    out[problem.field] = problem.message === "phoneInvalid" ? fmt(t.phoneInvalid, { phone: problem.phone }) : t[problem.message];
  }
  return out;
}

/** A choice made in a list's search box is not an edit of the coupon. */
const notAnEdit = (event: SyntheticEvent) => event.stopPropagation();

const CHECK = "size-5 shrink-0 cursor-pointer accent-primary";
const CHOICE = "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink";

// A switch over a real checkbox: a 48x28 track and a thumb that slides along the reading direction.
const SWITCH =
  "relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong/60 " +
  "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] checked:bg-primary " +
  "disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none " +
  "before:absolute before:start-0.5 before:top-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgb(0_0_0/0.3)] before:content-[''] " +
  "before:transition-[translate] before:duration-[var(--dur-move)] before:ease-[var(--ease-spring)] motion-reduce:before:transition-none " +
  "checked:before:translate-x-5 checked:before:bg-primary-foreground rtl:checked:before:-translate-x-5 forced-colors:checked:bg-[color:Highlight]";

/** A switch with its label and hint; the whole row is the target, at least 44px tall. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 has-[:disabled]:cursor-default">
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-6 font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className={SWITCH}
      />
    </label>
  );
}

/** One headed group of the form, drawn like the sheet's other groups: a rule above, the title, the fields. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4 border-t border-line pt-4">
      <legend className="float-start mb-3 w-full text-[13px] leading-5 font-semibold text-ink">{title}</legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}

const FieldError = ({ text }: { text?: string }) => (text ? <p className="text-xs font-medium text-danger">{text}</p> : null);

// ------------------------------------------------------------- checklists --

/** A searchable list of things to tick: products, collections, tiers. */
function Checklist({
  items,
  loading,
  error,
  selected,
  onChange,
  label,
  filterLabel,
  emptyText,
  noMatchText,
}: {
  items: ReadonlyArray<{ id: string; name: string }>;
  loading: boolean;
  error: unknown;
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
  filterLabel: string;
  emptyText: string;
  noMatchText: string;
}) {
  const base = useT(DISCOUNT_STRINGS);
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => (search.trim() ? items.filter((item) => matchesFolded(item.name, search)) : items), [items, search]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (loading) return <ZLoader size="sm" label={base.loading} />;
  if (error) return <p className="text-sm text-danger">{getErrorMessage(error)}</p>;

  return (
    <div role="group" aria-label={label} className="mt-1 space-y-2 rounded-[1rem] p-3 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        {/* Searching the list is not an edit of the discount. */}
        <Input
          value={search}
          onChange={(e) => {
            e.stopPropagation();
            setSearch(e.target.value);
          }}
          onInput={notAnEdit}
          aria-label={filterLabel}
          placeholder={filterLabel}
          className="h-11 min-w-0 max-w-xs"
        />
        <span className="text-xs whitespace-nowrap text-ink-soft tabular-nums">{fmt(base.selectedCount, { count: selected.length })}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">{items.length === 0 ? emptyText : noMatchText}</p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {filtered.map((item) => (
            <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.625rem] px-1.5 text-sm text-ink hover:bg-paper-sunken">
              <input type="checkbox" className={CHECK} checked={selectedSet.has(item.id)} onChange={() => toggle(item.id)} />
              <span className="min-w-0 truncate">
                <bdi>{item.name}</bdi>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The store's products to tick. Fetches one page (up to the backend's max) and
 * filters here — the catalog list's own local-filter pattern rather than
 * paging a picker.
 */
export function ProductChecklist({ label, selected, onChange }: { label: string; selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useT(DISCOUNT_STRINGS);
  const workspaceId = useWorkspaceId();
  const products = useAsync(() => apiClient.listProducts(workspaceId, { limit: 200 }).then((r) => r.products), [workspaceId]);
  return (
    <Checklist
      items={products.data ?? []}
      loading={products.loading}
      error={products.error}
      selected={selected}
      onChange={onChange}
      label={label}
      filterLabel={t.filterProducts}
      emptyText={t.noProducts}
      noMatchText={t.noMatch}
    />
  );
}

/** The store's collections to tick. */
export function CollectionChecklist({ label, selected, onChange }: { label: string; selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useT(CONTROL_STRINGS);
  const workspaceId = useWorkspaceId();
  const collections = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  return (
    <Checklist
      items={collections.data ?? []}
      loading={collections.loading}
      error={collections.error}
      selected={selected}
      onChange={onChange}
      label={label}
      filterLabel={t.filterCollections}
      emptyText={t.noCollections}
      noMatchText={t.noCollectionMatch}
    />
  );
}

// ---------------------------------------------------------- type and value --

/** A percentage's cap, as money. */
export function MaxDiscountField({ controls, currency, error }: { controls: CouponControls; currency: string; error?: string }) {
  const t = useT(CONTROL_STRINGS);
  return (
    <MoneyInput
      label={t.maxDiscount}
      currency={currency}
      value={controls.draft.maxDiscount}
      onChange={(value) => controls.set("maxDiscount", value)}
      error={error}
      hint={t.maxDiscountHint}
    />
  );
}

// ------------------------------------------------------------------- when --

/** The weekday's name in the dashboard's language (0 = Sunday). */
export function weekdayName(day: number, intlLocale: string): string {
  // 4 January 2026 was a Sunday.
  return new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day)));
}

/** «في أيام وساعات محددة فقط»: the switch, the days and the two times. */
export function ScheduleFields({ controls, error }: { controls: CouponControls; error?: string }) {
  const t = useT(CONTROL_STRINGS);
  const { intlLocale } = useLocale();
  const { draft, set } = controls;
  const days = new Set(draft.days);

  function toggleDay(day: number) {
    set("days", days.has(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day]);
  }

  return (
    <div className="space-y-3">
      <SwitchRow checked={draft.scheduleOn} onChange={(on) => set("scheduleOn", on)} label={t.scheduleOn} hint={t.scheduleHint} />
      {draft.scheduleOn && (
        <div className="space-y-3 rounded-[1rem] p-3 ring-1 ring-line">
          <div role="group" aria-label={t.days} className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((day) => (
              <label
                key={day}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-paper-sunken px-3 text-sm text-ink has-[:checked]:bg-primary-soft has-[:checked]:text-primary-dark dark:has-[:checked]:text-primary"
              >
                <input type="checkbox" className="size-4 shrink-0 cursor-pointer accent-primary" checked={days.has(day)} onChange={() => toggleDay(day)} />
                {weekdayName(day, intlLocale)}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.from}>
              {({ id }) => <Input id={id} type="time" dir="ltr" value={draft.from} onChange={(e) => set("from", e.target.value)} className="h-11" />}
            </Field>
            <Field label={t.to}>
              {({ id }) => <Input id={id} type="time" dir="ltr" value={draft.to} onChange={(e) => set("to", e.target.value)} className="h-11" />}
            </Field>
          </div>
          {error ? <FieldError text={error} /> : <p className="text-xs text-ink-soft">{t.toHint}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- on what --

/** «استثناء بعض المنتجات»: the switch and, on, the products to leave out. */
export function ExcludedProductsField({ controls, error }: { controls: CouponControls; error?: string }) {
  const t = useT(CONTROL_STRINGS);
  const { draft, set } = controls;
  return (
    <div className="space-y-1">
      <label className={CHOICE}>
        <input type="checkbox" className={CHECK} checked={draft.excludeOn} onChange={(e) => set("excludeOn", e.target.checked)} />
        {t.excludeOn}
      </label>
      {draft.excludeOn && <ProductChecklist label={t.excludeOn} selected={draft.excludedIds} onChange={(ids) => set("excludedIds", ids)} />}
      <FieldError text={error} />
    </div>
  );
}

/** What the coupon reaches besides the plain lines: delivery, sale items, offers; and the one-coupon rule. */
export function CoverageSwitches({ controls, type }: { controls: CouponControls; type: DiscountType }) {
  const t = useT(CONTROL_STRINGS);
  const { draft, set } = controls;
  return (
    <div className="space-y-1">
      {takesShipping(type) && (
        <SwitchRow checked={draft.appliesToShipping} onChange={(on) => set("appliesToShipping", on)} label={t.appliesToShipping} hint={t.appliesToShippingHint} />
      )}
      <SwitchRow
        checked={draft.appliesToDiscounted}
        onChange={(on) => set("appliesToDiscounted", on)}
        label={t.appliesToDiscounted}
        hint={t.appliesToDiscountedHint}
      />
      <SwitchRow
        checked={draft.combinesWithOffers}
        onChange={(on) => set("combinesWithOffers", on)}
        label={t.combinesWithOffers}
        hint={t.combinesWithOffersHint}
      />
      <p className="pt-1 text-xs leading-5 text-ink-soft">{t.oneCouponRule}</p>
    </div>
  );
}

// --------------------------------------------------------------- for whom --

const AUDIENCES: readonly DiscountAudience[] = ["any", "new", "existing"];

/** «لمن»: everyone / first order / returning, the phone list, and the VIP tiers when the store has them. */
export function AudienceFields({ controls, errors }: { controls: CouponControls; errors: Record<string, string> }) {
  const t = useT(CONTROL_STRINGS);
  const name = useId();
  const { draft, set } = controls;
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t.audience} className="space-y-0.5">
        <p className="text-sm font-medium text-ink">{t.audience}</p>
        {AUDIENCES.map((audience) => (
          <label key={audience} className={CHOICE}>
            <input type="radio" name={name} className={CHECK} checked={draft.audience === audience} onChange={() => set("audience", audience)} />
            {t[`audience_${audience}`]}
          </label>
        ))}
        <p className="text-xs text-ink-soft">{t.audienceHint}</p>
      </div>

      <Field label={t.phones} error={errors.customerPhones} hint={t.phonesHint}>
        {({ id, ...aria }) => (
          <Textarea
            id={id}
            {...aria}
            dir="ltr"
            rows={3}
            inputMode="tel"
            autoComplete="off"
            value={draft.phones}
            onChange={(e) => set("phones", e.target.value)}
            placeholder="01012345678"
            className={errors.customerPhones ? "border-danger focus-visible:ring-danger/30" : undefined}
          />
        )}
      </Field>

      <VipTierPicker controls={controls} />
    </div>
  );
}

/**
 * The store's VIP tiers to tick, when the store has them turned on. Reading
 * them needs customers.view: without it (or with none) the picker is not
 * drawn, and a coupon's stored tiers are sent back unchanged.
 */
function VipTierPicker({ controls }: { controls: CouponControls }) {
  const t = useT(CONTROL_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => vipTiersGet(apiClient, workspaceId), [workspaceId]);
  const tiers = settings.data?.enabled ? settings.data.tiers : [];
  if (tiers.length === 0) return null;
  const selected = new Set(controls.draft.vipTierIds);

  function toggle(id: string) {
    const ids = controls.draft.vipTierIds;
    controls.set("vipTierIds", selected.has(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  return (
    <div role="group" aria-label={t.vipTiers} className="space-y-0.5">
      <p className="text-sm font-medium text-ink">{t.vipTiers}</p>
      {tiers.map((tier) => (
        <label key={tier.id} className={CHOICE}>
          <input type="checkbox" className={CHECK} checked={selected.has(tier.id)} onChange={() => toggle(tier.id)} />
          <bdi>{tier.name[locale] || tier.name.ar || tier.name.en || tier.id}</bdi>
        </label>
      ))}
      <p className="text-xs text-ink-soft">{t.vipTiersHint}</p>
    </div>
  );
}

// ----------------------------------------------------------------- limits --

export function MinQuantityField({ controls, error }: { controls: CouponControls; error?: string }) {
  const t = useT(CONTROL_STRINGS);
  return (
    <Field label={t.minQuantity} error={error} hint={t.minQuantityHint}>
      {({ id, ...aria }) => (
        <Input
          id={id}
          {...aria}
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          value={controls.draft.minQuantity}
          onChange={(e) => controls.set("minQuantity", e.target.value)}
          className="h-11"
        />
      )}
    </Field>
  );
}

export function StrictLimitSwitch({ controls }: { controls: CouponControls }) {
  const t = useT(CONTROL_STRINGS);
  return (
    <SwitchRow
      checked={controls.draft.strictCustomerLimit}
      onChange={(on) => controls.set("strictCustomerLimit", on)}
      label={t.strict}
      hint={t.strictHint}
    />
  );
}
