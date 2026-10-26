import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Download, UserPlus, Users } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  contactsCreate,
  contactsExportCsv,
  contactsList,
  contactsListTags,
  segmentsList,
  type Contact,
  type ContactType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { KpiCard } from "@/components/KpiCard";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CONTACT_STRINGS, contactErrorCode, parseTagInput } from "./contactStrings";
import { DeliveryRateBar } from "./DeliveryRateBar";

const STRINGS = {
  en: {
    add: "Add contact",
    exporting: "Exporting…",
    exported: "{count} contacts exported.",
    kpiAll: "Contacts",
    kpiCustomers: "Customers",
    kpiLeads: "Leads",
    kpiConsent: "Accept marketing",
    searchPlaceholder: "Name, phone or email",
    typeFilter: "Type",
    anyType: "Everyone",
    tagFilter: "Tag",
    anyTag: "Any tag",
    segmentFilter: "Segment",
    anySegment: "No segment",
    colContact: "Contact",
    colType: "Type",
    colTags: "Tags",
    colOrders: "Orders",
    colSpent: "Spent",
    colLastOrder: "Last order",
    colDelivery: "Delivery rate",
    never: "—",
    blacklisted: "Blocked",
    emptyTitle: "No contacts yet",
    emptyDescription: "Everyone who orders or fills in a form on your store shows up here. You can also add a contact by hand.",
    emptyFiltered: "No contact matches these filters.",
    addTitle: "Add a contact",
    addDescription: "A lead you met outside the store. They become a customer with their first order.",
    name: "Name",
    phone: "Phone",
    email: "Email",
    tags: "Tags",
    tagsHint: "Separate tags with commas.",
    consent: "They agreed to receive marketing messages",
    added: "Contact added.",
    openExisting: "Open that contact",
  },
  ar: {
    add: "إضافة جهة اتصال",
    exporting: "جارٍ التصدير…",
    exported: "تم تصدير {count} جهة اتصال.",
    kpiAll: "جهات الاتصال",
    kpiCustomers: "عملاء",
    kpiLeads: "عملاء محتملون",
    kpiConsent: "موافقون على التسويق",
    searchPlaceholder: "الاسم أو الهاتف أو البريد",
    typeFilter: "النوع",
    anyType: "الكل",
    tagFilter: "الوسم",
    anyTag: "أي وسم",
    segmentFilter: "الشريحة",
    anySegment: "بدون شريحة",
    colContact: "جهة الاتصال",
    colType: "النوع",
    colTags: "الوسوم",
    colOrders: "الطلبات",
    colSpent: "المدفوع",
    colLastOrder: "آخر طلب",
    colDelivery: "نسبة الاستلام",
    never: "—",
    blacklisted: "محظور",
    emptyTitle: "لا توجد جهات اتصال بعد",
    emptyDescription: "كل من يطلب أو يملأ نموذجًا في متجرك يظهر هنا. ويمكنك إضافة جهة اتصال يدويًا.",
    emptyFiltered: "لا توجد جهة اتصال تطابق هذه الفلاتر.",
    addTitle: "إضافة جهة اتصال",
    addDescription: "عميل محتمل عرفته خارج المتجر. يتحول إلى عميل مع أول طلب.",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    tags: "الوسوم",
    tagsHint: "افصل بين الوسوم بفاصلة.",
    consent: "وافق على استقبال رسائل تسويقية",
    added: "تمت إضافة جهة الاتصال.",
    openExisting: "افتح جهة الاتصال",
  },
} satisfies Messages;

export function TagChips({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return <span className="text-ink-soft">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, max).map((tag) => (
        <span key={tag} dir="auto" className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink">
          {tag}
        </span>
      ))}
      {tags.length > max && <span className="text-xs text-ink-soft">+{tags.length - max}</span>}
    </div>
  );
}

function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Contacts → All: everyone the store knows, with search, filters and export. */
export function ContactsAllTab({ segmentId, onSegmentChange }: { segmentId: string; onSegmentChange: (id: string) => void }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [type, setType] = useState<"" | ContactType>("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const params = useMemo(
    () => ({ q: q || undefined, type: type || undefined, tag: tag || undefined, segmentId: segmentId || undefined }),
    [q, type, tag, segmentId]
  );
  const list = useAsync(() => contactsList(apiClient, workspaceId, { ...params, limit: 50 }), [workspaceId, params]);
  const filters = useAsync(
    () => Promise.all([contactsListTags(apiClient, workspaceId), segmentsList(apiClient, workspaceId)]),
    [workspaceId]
  );
  const [tagOptions, segmentOptions] = filters.data ?? [[], []];
  const contacts = list.data?.contacts ?? [];
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const filtered = Boolean(q || type || tag || segmentId);

  async function loadMore() {
    const cursor = list.data?.nextCursor;
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await contactsList(apiClient, workspaceId, { ...params, limit: 50, cursor });
      list.setData((prev) => ({ ...prev, ...next, total: prev?.total, leads: prev?.leads, customers: prev?.customers, consenting: prev?.consenting, contacts: [...(prev?.contacts ?? []), ...next.contacts] }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const text = await contactsExportCsv(apiClient, workspaceId, params);
      downloadCsv(text, `contacts-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(fmt(t.exported, { count: Math.max(0, text.trim().split(/\r?\n/).length - 1) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Contact>[] = [
    {
      key: "contact",
      header: t.colContact,
      cell: (contact) => (
        <div className="min-w-0">
          <Link to={`/customers/${contact.id}`} className="font-medium text-ink hover:text-primary">
            <bdi>{contact.fullName || contact.phoneRaw || contact.phoneNormalized}</bdi>
          </Link>
          <div className="text-xs text-ink-soft">
            <bdi dir="ltr">{contact.phoneRaw || contact.phoneNormalized}</bdi>
            {contact.governorate && (
              <>
                {" · "}
                <bdi>{contact.governorate}</bdi>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: t.colType,
      cell: (contact) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={contact.type} tone={contact.type === "customer" ? "success" : "info"} text={c[`type_${contact.type}`]} />
          {contact.isBlacklisted && <StatusBadge value="blacklisted" tone="danger" text={t.blacklisted} />}
        </div>
      ),
    },
    { key: "tags", header: t.colTags, cell: (contact) => <TagChips tags={contact.tags} /> },
    { key: "orders", header: t.colOrders, align: "end", cell: (contact) => <span className="tabular-nums">{contact.ordersCount}</span> },
    {
      key: "spent",
      header: t.colSpent,
      align: "end",
      cell: (contact) => <span className="tabular-nums">{formatMoney(contact.totalSpent, currency)}</span>,
    },
    {
      key: "lastOrder",
      header: t.colLastOrder,
      cell: (contact) => <span className="text-ink-soft">{contact.lastOrderAt ? formatDate(contact.lastOrderAt) : t.never}</span>,
    },
    { key: "delivery", header: t.colDelivery, cell: (contact) => <DeliveryRateBar contact={contact} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t.kpiAll} value={String(list.data?.total ?? "—")} icon={<Users aria-hidden />} />
        <KpiCard label={t.kpiCustomers} value={String(list.data?.customers ?? "—")} />
        <KpiCard label={t.kpiLeads} value={String(list.data?.leads ?? "—")} />
        <KpiCard label={t.kpiConsent} value={String(list.data?.consenting ?? "—")} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label={common.search}
          labelHidden
          type="search"
          className="min-w-56 flex-1"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Field label={t.typeFilter} labelHidden className="w-40">
          {(props) => (
            <Select {...props} value={type} onChange={(e) => setType(e.target.value as "" | ContactType)}>
              <option value="">
                {t.typeFilter}: {t.anyType}
              </option>
              <option value="customer">{c.type_customer}</option>
              <option value="lead">{c.type_lead}</option>
            </Select>
          )}
        </Field>
        <Field label={t.tagFilter} labelHidden className="w-40">
          {(props) => (
            <Select {...props} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">
                {t.tagFilter}: {t.anyTag}
              </option>
              {tagOptions.map((option) => (
                <option key={option.tag} value={option.tag}>
                  {option.tag} ({option.count})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.segmentFilter} labelHidden className="w-44">
          {(props) => (
            <Select {...props} value={segmentId} onChange={(e) => onSegmentChange(e.target.value)}>
              <option value="">
                {t.segmentFilter}: {t.anySegment}
              </option>
              {segmentOptions.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-10" disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="size-4" aria-hidden />
            {exporting ? t.exporting : common.exportCsv}
          </Button>
          <Button className="min-h-10" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden />
            {t.add}
          </Button>
        </div>
      </div>

      <DataState skeleton={<ListSkeleton />} loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable
            columns={columns}
            rows={contacts}
            rowKey={(contact) => contact.id}
            minWidth="56rem"
            empty={
              filtered ? (
                <EmptyState title={t.emptyFiltered} />
              ) : (
                <EmptyState
                  icon={<Users className="size-6" aria-hidden />}
                  title={t.emptyTitle}
                  description={t.emptyDescription}
                  action={<Button onClick={() => setAdding(true)}>{t.add}</Button>}
                />
              )
            }
          />
        </Card>
        <LoadMore hasMore={Boolean(list.data?.nextCursor)} loading={loadingMore} onClick={() => void loadMore()} />
      </DataState>

      <AddContactModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void list.refresh({ silent: true });
          void filters.refresh({ silent: true });
        }}
      />
    </div>
  );
}

function AddContactModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", tags: "", consent: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; customerId?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ fullName: "", phone: "", email: "", tags: "", consent: false });
      setError(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await contactsCreate(apiClient, workspaceId, {
        phone: form.phone.trim(),
        fullName: form.fullName.trim() || undefined,
        email: form.email.trim() || undefined,
        marketingConsent: form.consent,
        tags: parseTagInput(form.tags),
      });
      toast.success(t.added);
      onAdded();
    } catch (err) {
      const code = contactErrorCode(err);
      if (code === "PHONE_TAKEN") {
        const details = (err as { details?: { customerId?: string } }).details;
        setError({ message: c.phoneTaken, customerId: details?.customerId });
      } else if (code === "INVALID_PHONE") setError({ message: c.invalidPhone });
      else setError({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.addTitle} description={t.addDescription}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error.message}{" "}
            {error.customerId && (
              <Link to={`/customers/${error.customerId}`} className="font-medium underline">
                {t.openExisting}
              </Link>
            )}
          </Alert>
        )}
        <TextField label={t.name} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={200} />
        <TextField
          label={t.phone}
          required
          type="tel"
          dir="ltr"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          maxLength={32}
        />
        <TextField label={t.email} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
        <TextField label={t.tags} hint={t.tagsHint} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
          {t.consent}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !form.phone.trim()}>
            {busy ? common.saving : t.add}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
