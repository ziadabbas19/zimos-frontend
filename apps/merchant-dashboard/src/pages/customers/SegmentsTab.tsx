import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ListFilter, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  segmentsCreate,
  segmentsDelete,
  segmentsList,
  segmentsPreview,
  segmentsUpdate,
  type ContactSegment,
  type Product,
  type SegmentPreview,
  type SegmentRules,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { CONTACT_STRINGS, contactErrorCode, parseTagInput } from "./contactStrings";

const STRINGS = {
  en: {
    intro: "A segment is a saved filter. It is worked out again every time you use it, so it always reflects today's orders.",
    add: "New segment",
    emptyTitle: "No segments yet",
    emptyDescription: "Group contacts by what they bought, how much they spent or the tags they carry — then message the right people.",
    contacts: "{count} contacts",
    consenting: "{count} accept marketing",
    view: "View contacts",
    everyone: "Everyone",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "Only the saved filter is removed. The contacts themselves stay.",
    deleted: "Segment deleted.",
    deleting: "Deleting…",
    saved: "Segment saved.",
    createTitle: "New segment",
    editTitle: "Edit segment",
    name: "Name",
    description: "Note",
    rules: "Who is in it",
    rulesHint: "Leave a field empty to ignore it. A contact must match every field you fill in.",
    type: "Type",
    anyType: "Customers and leads",
    includeTags: "Has all of these tags",
    excludeTags: "Has none of these tags",
    tagsHint: "Separate with commas.",
    minOrders: "Orders, at least",
    maxOrders: "Orders, at most",
    minSpent: "Spent at least ({currency})",
    maxSpent: "Spent at most ({currency})",
    olderThan: "Last order more than … days ago",
    within: "Last order within … days",
    governorates: "Governorates",
    governoratesHint: "As written on the orders, separated by commas.",
    products: "Bought any of these products",
    productsHint: "Hold Ctrl (⌘ on a Mac) to pick several.",
    minRate: "Delivery rate at least (%)",
    maxRate: "Delivery rate at most (%)",
    consent: "Marketing consent",
    consentAny: "Does not matter",
    consentYes: "Accepts marketing",
    consentNo: "Does not accept",
    matches: "{total} contacts match now · {consenting} accept marketing",
    counting: "Counting…",
    sum_type: "{type} only",
    sum_include: "tagged {tags}",
    sum_exclude: "not tagged {tags}",
    sum_minOrders: "{n}+ orders",
    sum_maxOrders: "up to {n} orders",
    sum_minSpent: "spent {amount}+",
    sum_maxSpent: "spent up to {amount}",
    sum_older: "no order for {n} days",
    sum_within: "ordered in the last {n} days",
    sum_gov: "in {list}",
    sum_products: "bought {n} chosen products",
    sum_minRate: "delivery rate {n}%+",
    sum_maxRate: "delivery rate up to {n}%",
    sum_consentYes: "accepts marketing",
    sum_consentNo: "does not accept marketing",
  },
  ar: {
    intro: "الشريحة فلتر محفوظ. تُحسب من جديد في كل مرة تستخدمها، فتعكس دائمًا طلبات اليوم.",
    add: "شريحة جديدة",
    emptyTitle: "لا توجد شرائح بعد",
    emptyDescription: "قسّم جهات الاتصال حسب ما اشتروه أو ما دفعوه أو الوسوم التي يحملونها، ثم راسل الأشخاص المناسبين.",
    contacts: "{count} جهة اتصال",
    consenting: "{count} موافق على التسويق",
    view: "عرض جهات الاتصال",
    everyone: "الجميع",
    deleteTitle: "حذف «{name}»؟",
    deleteDescription: "يُحذف الفلتر المحفوظ فقط. جهات الاتصال نفسها تبقى.",
    deleted: "تم حذف الشريحة.",
    deleting: "جارٍ الحذف…",
    saved: "تم حفظ الشريحة.",
    createTitle: "شريحة جديدة",
    editTitle: "تعديل الشريحة",
    name: "الاسم",
    description: "ملاحظة",
    rules: "من يدخل فيها",
    rulesHint: "اترك الحقل فارغًا لتجاهله. يجب أن تطابق جهة الاتصال كل حقل تملؤه.",
    type: "النوع",
    anyType: "العملاء والمحتملون",
    includeTags: "يحمل كل هذه الوسوم",
    excludeTags: "لا يحمل أيًا من هذه الوسوم",
    tagsHint: "افصل بفاصلة.",
    minOrders: "عدد الطلبات على الأقل",
    maxOrders: "عدد الطلبات على الأكثر",
    minSpent: "دفع على الأقل ({currency})",
    maxSpent: "دفع على الأكثر ({currency})",
    olderThan: "آخر طلب منذ أكثر من … يوم",
    within: "آخر طلب خلال … يوم",
    governorates: "المحافظات",
    governoratesHint: "كما هي مكتوبة في الطلبات، مفصولة بفاصلة.",
    products: "اشترى أيًا من هذه المنتجات",
    productsHint: "اضغط Ctrl (أو ⌘ على ماك) لاختيار أكثر من منتج.",
    minRate: "نسبة الاستلام على الأقل (%)",
    maxRate: "نسبة الاستلام على الأكثر (%)",
    consent: "الموافقة على التسويق",
    consentAny: "لا يهم",
    consentYes: "موافق",
    consentNo: "غير موافق",
    matches: "{total} جهة اتصال تطابق الآن · {consenting} موافق على التسويق",
    counting: "جارٍ العدّ…",
    sum_type: "{type} فقط",
    sum_include: "يحمل وسم {tags}",
    sum_exclude: "لا يحمل وسم {tags}",
    sum_minOrders: "{n} طلبات فأكثر",
    sum_maxOrders: "حتى {n} طلبات",
    sum_minSpent: "دفع {amount} فأكثر",
    sum_maxSpent: "دفع حتى {amount}",
    sum_older: "لم يطلب منذ {n} يوم",
    sum_within: "طلب خلال آخر {n} يوم",
    sum_gov: "في {list}",
    sum_products: "اشترى من {n} منتجات مختارة",
    sum_minRate: "نسبة استلام {n}% فأكثر",
    sum_maxRate: "نسبة استلام حتى {n}%",
    sum_consentYes: "موافق على التسويق",
    sum_consentNo: "غير موافق على التسويق",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/** The rules as short phrases, for the segment card. */
function summarize(rules: SegmentRules, t: Record<keyof T, string>, typeLabel: (type: "lead" | "customer") => string, currency: string): string[] {
  const out: string[] = [];
  if (rules.type) out.push(fmt(t.sum_type, { type: typeLabel(rules.type) }));
  if (rules.includeTags?.length) out.push(fmt(t.sum_include, { tags: rules.includeTags.join("، ") }));
  if (rules.excludeTags?.length) out.push(fmt(t.sum_exclude, { tags: rules.excludeTags.join("، ") }));
  if (rules.minOrders !== undefined) out.push(fmt(t.sum_minOrders, { n: rules.minOrders }));
  if (rules.maxOrders !== undefined) out.push(fmt(t.sum_maxOrders, { n: rules.maxOrders }));
  if (rules.minSpent !== undefined) out.push(fmt(t.sum_minSpent, { amount: formatMoney(rules.minSpent, currency) }));
  if (rules.maxSpent !== undefined) out.push(fmt(t.sum_maxSpent, { amount: formatMoney(rules.maxSpent, currency) }));
  if (rules.lastOrderOlderThanDays !== undefined) out.push(fmt(t.sum_older, { n: rules.lastOrderOlderThanDays }));
  if (rules.lastOrderWithinDays !== undefined) out.push(fmt(t.sum_within, { n: rules.lastOrderWithinDays }));
  if (rules.governorates?.length) out.push(fmt(t.sum_gov, { list: rules.governorates.join("، ") }));
  if (rules.productIds?.length) out.push(fmt(t.sum_products, { n: rules.productIds.length }));
  if (rules.minDeliveryRate !== undefined) out.push(fmt(t.sum_minRate, { n: rules.minDeliveryRate }));
  if (rules.maxDeliveryRate !== undefined) out.push(fmt(t.sum_maxRate, { n: rules.maxDeliveryRate }));
  if (rules.marketingConsent === true) out.push(t.sum_consentYes);
  if (rules.marketingConsent === false) out.push(t.sum_consentNo);
  return out;
}

/** Contacts → Segments: saved filters, each with its live count. */
export function SegmentsTab({ onView }: { onView: (segmentId: string) => void }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => segmentsList(apiClient, workspaceId), [workspaceId]);
  const segments = list.data ?? [];
  const [editing, setEditing] = useState<ContactSegment | "new" | null>(null);
  const [removing, setRemoving] = useState<ContactSegment | null>(null);

  async function confirmRemove() {
    if (!removing) return;
    try {
      await segmentsDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.deleted);
    setRemoving(null);
    void list.refresh({ silent: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">{t.intro}</p>
        <Button className="min-h-10" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          {t.add}
        </Button>
      </div>

      <DataState skeleton={<ListSkeleton rows={4} />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {segments.length === 0 ? (
          <EmptyState
            icon={<ListFilter className="size-6" aria-hidden />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setEditing("new")}>{t.add}</Button>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((segment) => {
              const phrases = summarize(segment.rules, t, (type) => c[`type_${type}`], currency);
              return (
                <Card key={segment.id} className="gap-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 dir="auto" className="truncate text-base font-semibold text-ink">
                        {segment.name}
                      </h3>
                      {segment.description && (
                        <p dir="auto" className="mt-0.5 text-sm text-ink-soft">
                          {segment.description}
                        </p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="tabular-nums text-2xl font-semibold text-ink">{segment.contactsCount ?? 0}</p>
                      <p className="text-xs text-ink-soft">{fmt(t.consenting, { count: segment.consentingCount ?? 0 })}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(phrases.length ? phrases : [t.everyone]).map((phrase) => (
                      <span key={phrase} dir="auto" className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink">
                        {phrase}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => onView(segment.id)}>
                      {t.view}
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditing(segment)}>
                      <Pencil className="size-4" aria-hidden />
                      {common.edit}
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-9" onClick={() => setRemoving(segment)}>
                      <Trash2 className="size-4" aria-hidden />
                      {common.delete}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </DataState>

      <SegmentEditor
        segment={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.deleteTitle, { name: removing.name }) : ""}
        description={t.deleteDescription}
        confirmLabel={common.delete}
        busyLabel={t.deleting}
        cancelLabel={common.cancel}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

interface RuleForm {
  type: "" | "lead" | "customer";
  includeTags: string;
  excludeTags: string;
  minOrders: string;
  maxOrders: string;
  minSpent: string;
  maxSpent: string;
  olderThan: string;
  within: string;
  governorates: string;
  productIds: string[];
  minRate: string;
  maxRate: string;
  consent: "" | "yes" | "no";
}

function toForm(rules: SegmentRules): RuleForm {
  const n = (value: number | undefined) => (value === undefined ? "" : String(value));
  return {
    type: rules.type ?? "",
    includeTags: (rules.includeTags ?? []).join(", "),
    excludeTags: (rules.excludeTags ?? []).join(", "),
    minOrders: n(rules.minOrders),
    maxOrders: n(rules.maxOrders),
    minSpent: rules.minSpent === undefined ? "" : minorToMajorInput(rules.minSpent),
    maxSpent: rules.maxSpent === undefined ? "" : minorToMajorInput(rules.maxSpent),
    olderThan: n(rules.lastOrderOlderThanDays),
    within: n(rules.lastOrderWithinDays),
    governorates: (rules.governorates ?? []).join(", "),
    productIds: rules.productIds ?? [],
    minRate: n(rules.minDeliveryRate),
    maxRate: n(rules.maxDeliveryRate),
    consent: rules.marketingConsent === undefined ? "" : rules.marketingConsent ? "yes" : "no",
  };
}

function toRules(form: RuleForm): SegmentRules {
  const int = (text: string, max: number) => {
    const value = Math.floor(Number(text));
    return text.trim() === "" || !Number.isFinite(value) || value < 0 ? undefined : Math.min(value, max);
  };
  const days = (text: string) => {
    const value = int(text, 3650);
    return value === undefined || value < 1 ? undefined : value;
  };
  const list = (text: string) => {
    const items = text
      .split(/[,،\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  };
  const tags = (text: string) => {
    const items = parseTagInput(text);
    return items.length ? items : undefined;
  };
  const rules: SegmentRules = {
    type: form.type || undefined,
    includeTags: tags(form.includeTags),
    excludeTags: tags(form.excludeTags),
    minOrders: int(form.minOrders, 100000),
    maxOrders: int(form.maxOrders, 100000),
    minSpent: form.minSpent.trim() === "" ? undefined : majorToMinor(form.minSpent),
    maxSpent: form.maxSpent.trim() === "" ? undefined : majorToMinor(form.maxSpent),
    lastOrderOlderThanDays: days(form.olderThan),
    lastOrderWithinDays: days(form.within),
    governorates: list(form.governorates),
    productIds: form.productIds.length ? form.productIds : undefined,
    minDeliveryRate: int(form.minRate, 100),
    maxDeliveryRate: int(form.maxRate, 100),
    marketingConsent: form.consent === "" ? undefined : form.consent === "yes",
  };
  // Drop the keys that were left empty, so the stored rules stay readable.
  return Object.fromEntries(Object.entries(rules).filter(([, value]) => value !== undefined)) as SegmentRules;
}

function SegmentEditor({
  segment,
  currency,
  onClose,
  onSaved,
}: {
  segment: ContactSegment | "new" | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const open = segment !== null;
  const existing = segment && segment !== "new" ? segment : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<RuleForm>(() => toForm({}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setDescription(existing?.description ?? "");
    setForm(toForm(existing?.rules ?? {}));
    setError(null);
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  useEffect(() => {
    if (!open || products.length) return;
    let cancelled = false;
    apiClient
      .listProducts(workspaceId, { limit: 100 })
      .then((result) => {
        if (!cancelled) setProducts(result.products);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, products.length]);

  const rules = useMemo(() => toRules(form), [form]);
  const rulesKey = JSON.stringify(rules);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      segmentsPreview(apiClient, workspaceId, rules)
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, rulesKey]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, rules };
      if (existing) await segmentsUpdate(apiClient, workspaceId, existing.id, payload);
      else await segmentsCreate(apiClient, workspaceId, payload);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(contactErrorCode(err) === "SEGMENT_NAME_TAKEN" ? c.segmentNameTaken : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const number = (key: "minOrders" | "maxOrders" | "olderThan" | "within" | "minRate" | "maxRate", label: string, max?: number) => (
    <TextField label={label} type="number" inputMode="numeric" min={0} max={max} value={form[key]} onChange={(e) => set(key, e.target.value)} />
  );

  return (
    <Modal open={open} onClose={onClose} title={existing ? t.editTitle : t.createTitle} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.name} required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <TextField label={t.description} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">{t.rules}</h3>
          <p className="mt-0.5 text-xs text-ink-soft">{t.rulesHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.type}>
            {(props) => (
              <Select {...props} value={form.type} onChange={(e) => set("type", e.target.value as RuleForm["type"])}>
                <option value="">{t.anyType}</option>
                <option value="customer">{c.type_customer}</option>
                <option value="lead">{c.type_lead}</option>
              </Select>
            )}
          </Field>
          <Field label={t.consent}>
            {(props) => (
              <Select {...props} value={form.consent} onChange={(e) => set("consent", e.target.value as RuleForm["consent"])}>
                <option value="">{t.consentAny}</option>
                <option value="yes">{t.consentYes}</option>
                <option value="no">{t.consentNo}</option>
              </Select>
            )}
          </Field>
          <TextField label={t.includeTags} hint={t.tagsHint} value={form.includeTags} onChange={(e) => set("includeTags", e.target.value)} />
          <TextField label={t.excludeTags} hint={t.tagsHint} value={form.excludeTags} onChange={(e) => set("excludeTags", e.target.value)} />
          {number("minOrders", t.minOrders)}
          {number("maxOrders", t.maxOrders)}
          <TextField label={fmt(t.minSpent, { currency })} inputMode="decimal" dir="ltr" value={form.minSpent} onChange={(e) => set("minSpent", e.target.value)} />
          <TextField label={fmt(t.maxSpent, { currency })} inputMode="decimal" dir="ltr" value={form.maxSpent} onChange={(e) => set("maxSpent", e.target.value)} />
          {number("olderThan", t.olderThan, 3650)}
          {number("within", t.within, 3650)}
          {number("minRate", t.minRate, 100)}
          {number("maxRate", t.maxRate, 100)}
          <TextField
            className="sm:col-span-2"
            label={t.governorates}
            hint={t.governoratesHint}
            value={form.governorates}
            onChange={(e) => set("governorates", e.target.value)}
          />
          {products.length > 0 && (
            <Field className="sm:col-span-2" label={t.products} hint={t.productsHint}>
              {(props) => (
                <select
                  {...props}
                  multiple
                  size={Math.min(6, products.length)}
                  value={form.productIds}
                  onChange={(e) => set("productIds", Array.from(e.target.selectedOptions, (option) => option.value))}
                  className="w-full rounded-[0.5rem] border border-line bg-paper-raised px-2 py-1 text-sm text-ink"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        <p role="status" className="rounded-[0.5rem] bg-primary-soft px-3 py-2 text-sm font-medium text-primary-dark dark:text-primary">
          {preview ? fmt(t.matches, { total: preview.total, consenting: preview.consenting }) : t.counting}
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? common.saving : common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
