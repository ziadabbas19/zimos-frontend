import { useState, type FormEvent } from "react";
import { Eye, EyeOff, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminTemplate as Template,
  AdminTemplateInput as TemplateInput,
  AdminTemplateKind as Kind,
  AdminTemplateVersion,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Drawer } from "@/components/Drawer";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SelectField, TextAreaField, TextField } from "@/components/forms";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatMinorMoney, formatRelative, PLATFORM_CURRENCY } from "@/lib/format";

type KindFilter = "all" | Kind;

// Read as `tx`: `t` is a template in this file.
const STRINGS = {
  en: {
    kindStore: "Store",
    kindFunnel: "Funnel",
    kindLanding: "Landing page",
    publishedToast: "{name} is published.",
    unpublishedToast: "{name} is unpublished.",
    all: "All",
    stores: "Stores",
    funnels: "Funnels",
    landings: "Landing pages",
    title: "Templates",
    description: "The gallery merchants pick from after signing up.",
    newTemplate: "New template",
    emptyAll: "No templates yet.",
    emptyKind: "No templates of this kind.",
    colTemplate: "Template",
    colKind: "Kind",
    colPrice: "Price",
    colGallery: "Gallery",
    colVersion: "Version",
    colActions: "Actions",
    free: "Free",
    inGallery: "In gallery",
    publishedNoVersion: "Published, no active version",
    draft: "Draft",
    noneActive: "None active",
    versionOne: "{count} version",
    versionMany: "{count} versions",
    activateFirst: "Add or activate a version first.",
    unpublish: "Unpublish",
    publish: "Publish",
    versionsOf: "Versions of {name}",
    editNamed: "Edit {name}",
    deleteNamed: "Delete {name}",
    createdToast: "{name} created — add a version to publish it.",
    savedToast: "{name} saved.",
    deleteTitle: "Delete {name}?",
    deleteDescription:
      "The template and all its versions are removed. A template a merchant site was built from cannot be deleted — unpublish it instead.",
    deleteTemplate: "Delete template",
    deletedToast: "Template deleted.",
    errPrice: "The price is a whole number of piastres (minor units), 0 or more.",
    modalDescription: "The gallery card. Page content lives in the template's versions.",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    create: "Create",
    name: "Name",
    kind: "Kind",
    category: "Category",
    thumbnailUrl: "Thumbnail URL",
    listPrice: "List price (piastres)",
    swatch: "Swatch colour",
    swatchHint: "Empty: the active version's primary colour.",
    tags: "Tags",
    tagsHint: "Comma-separated.",
    rtl: "Right-to-left",
    versionsTitle: "Versions — {name}",
    versionsDescription: "The gallery offers the newest active version. Versions are never edited: websites were copied from them.",
    inGalleryAs: "In the gallery as v{version}",
    notInGallery: "Not in the gallery",
    newVersion: "New version",
    versionAdded: "Version {version} added.",
    noVersions: "No versions yet. Add one to be able to publish this template.",
    active: "Active",
    inactive: "Inactive",
    versionSummary: "{pages} page(s) ({paths}) · {sites} site(s) built from it · added {when}",
    view: "View",
    versionActive: "v{version} active",
    versionContent: "v{version} content",
    addedReadOnly: "Added {date}. Read-only.",
    errJson: "That is not valid JSON.",
    errShape: 'Expected an object with a "pages" array (and optionally "globalStyles" and "sections").',
    versionJson: "Version content (JSON)",
    versionJsonHint: "Prefilled from the newest version. Every page is checked exactly as it will be when a merchant creates a site from it.",
    makeActive: "Make it the version the gallery offers",
    adding: "Adding…",
    addVersion: "Add version",
    keys: "Keys:",
    eachWith: "each with",
  },
  ar: {
    kindStore: "متجر",
    kindFunnel: "مسار بيع",
    kindLanding: "صفحة هبوط",
    publishedToast: "نُشر {name}.",
    unpublishedToast: "أُلغي نشر {name}.",
    all: "الكل",
    stores: "المتاجر",
    funnels: "مسارات البيع",
    landings: "صفحات الهبوط",
    title: "القوالب",
    description: "المعرض الذي يختار منه التجار بعد التسجيل.",
    newTemplate: "قالب جديد",
    emptyAll: "لا توجد قوالب بعد.",
    emptyKind: "لا توجد قوالب من هذا النوع.",
    colTemplate: "القالب",
    colKind: "النوع",
    colPrice: "السعر",
    colGallery: "المعرض",
    colVersion: "الإصدار",
    colActions: "الإجراءات",
    free: "مجاني",
    inGallery: "في المعرض",
    publishedNoVersion: "منشور، بلا إصدار نشط",
    draft: "مسودة",
    noneActive: "لا يوجد إصدار نشط",
    versionOne: "إصدار واحد",
    versionMany: "عدد الإصدارات: {count}",
    activateFirst: "أضف إصدارًا أو فعّل واحدًا أولًا.",
    unpublish: "إلغاء النشر",
    publish: "نشر",
    versionsOf: "إصدارات {name}",
    editNamed: "تعديل {name}",
    deleteNamed: "حذف {name}",
    createdToast: "أُنشئ {name} — أضف إصدارًا لنشره.",
    savedToast: "حُفظ {name}.",
    deleteTitle: "حذف {name}؟",
    deleteDescription:
      "يُحذف القالب وجميع إصداراته. لا يمكن حذف قالب بُني منه موقع تاجر — ألغِ نشره بدلًا من ذلك.",
    deleteTemplate: "حذف القالب",
    deletedToast: "حُذف القالب.",
    errPrice: "السعر عدد صحيح من القروش (الوحدات الصغرى)، 0 أو أكثر.",
    modalDescription: "بطاقة المعرض. محتوى الصفحات موجود في إصدارات القالب.",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    save: "حفظ",
    create: "إنشاء",
    name: "الاسم",
    kind: "النوع",
    category: "الفئة",
    thumbnailUrl: "رابط الصورة المصغّرة",
    listPrice: "سعر القائمة (بالقروش)",
    swatch: "لون العيّنة",
    swatchHint: "فارغ: اللون الأساسي للإصدار النشط.",
    tags: "الوسوم",
    tagsHint: "مفصولة بفواصل.",
    rtl: "من اليمين إلى اليسار",
    versionsTitle: "الإصدارات — {name}",
    versionsDescription: "يعرض المعرض أحدث إصدار نشط. لا تُعدَّل الإصدارات أبدًا: نُسخت منها مواقع.",
    inGalleryAs: "في المعرض بالإصدار v{version}",
    notInGallery: "ليس في المعرض",
    newVersion: "إصدار جديد",
    versionAdded: "أُضيف الإصدار {version}.",
    noVersions: "لا توجد إصدارات بعد. أضف واحدًا لتتمكن من نشر هذا القالب.",
    active: "نشط",
    inactive: "غير نشط",
    versionSummary: "الصفحات: {pages} ({paths}) · المواقع المبنية منه: {sites} · أُضيف {when}",
    view: "عرض",
    versionActive: "تفعيل v{version}",
    versionContent: "محتوى v{version}",
    addedReadOnly: "أُضيف {date}. للقراءة فقط.",
    errJson: "هذا ليس JSON صالحًا.",
    errShape: "المتوقع كائن يحتوي على مصفوفة \"pages\" (واختياريًا \"globalStyles\" و\"sections\").",
    versionJson: "محتوى الإصدار (JSON)",
    versionJsonHint: "مملوء مسبقًا من أحدث إصدار. تُفحص كل صفحة تمامًا كما ستكون عندما ينشئ تاجر موقعًا منها.",
    makeActive: "اجعله الإصدار الذي يعرضه المعرض",
    adding: "جارٍ الإضافة…",
    addVersion: "إضافة إصدار",
    keys: "المفاتيح:",
    eachWith: "لكل منها",
  },
} satisfies Messages;

export function TemplatesPage() {
  const tx = useT(STRINGS);
  const kindLabel: Record<Kind, string> = { store: tx.kindStore, funnel: tx.kindFunnel, landing: tx.kindLanding };
  const toast = useToast();
  const [kind, setKind] = useState<KindFilter>("all");
  const { data, loading, error, refresh, setData } = useAsync(
    () => adminApi.listTemplates(kind === "all" ? {} : { kind }),
    [kind]
  );
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [versionsOf, setVersionsOf] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [publishing, setPublishing] = useState<Set<string>>(new Set());

  const templates = data ?? [];

  function replace(t: Template) {
    setData((prev) => (prev ?? []).map((row) => (row.id === t.id ? t : row)));
  }

  async function togglePublished(t: Template) {
    setPublishing((s) => new Set(s).add(t.id));
    try {
      const updated = await adminApi.setTemplatePublished(t.id, !t.isPublished);
      replace(updated);
      toast.success(fmt(updated.isPublished ? tx.publishedToast : tx.unpublishedToast, { name: t.name }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishing((s) => {
        const next = new Set(s);
        next.delete(t.id);
        return next;
      });
    }
  }

  const options: Array<{ value: KindFilter; label: string }> = [
    { value: "all", label: tx.all },
    { value: "store", label: tx.stores },
    { value: "funnel", label: tx.funnels },
    { value: "landing", label: tx.landings },
  ];

  return (
    <div>
      <PageHeader
        title={tx.title}
        description={tx.description}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> {tx.newTemplate}
          </Button>
        }
      />
      <FilterChips options={options} value={kind} onChange={setKind} className="mb-4" />

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {templates.length === 0 ? (
          <EmptyBlock message={kind === "all" ? tx.emptyAll : tx.emptyKind} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{tx.colTemplate}</Th>
                  <Th>{tx.colKind}</Th>
                  <Th>{tx.colPrice}</Th>
                  <Th>{tx.colGallery}</Th>
                  <Th>{tx.colVersion}</Th>
                  <Th className="text-end">
                    <span className="sr-only">{tx.colActions}</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {t.thumbnailUrl ? (
                          <img src={t.thumbnailUrl} alt="" className="size-10 shrink-0 rounded-md border border-line object-cover" />
                        ) : (
                          <span
                            className="size-10 shrink-0 rounded-md border border-line"
                            style={{ background: t.primaryColor ?? "var(--color-paper)" }}
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{t.name}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {[t.category, t.rtl ? "RTL" : "LTR", ...t.tags].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">{kindLabel[t.kind]}</Td>
                    <Td className="whitespace-nowrap text-sm">
                      {t.isFree ? tx.free : formatMinorMoney(t.priceAmount, PLATFORM_CURRENCY)}
                      {t.isFree && t.priceAmount > 0 && (
                        <span className="block text-xs text-ink-soft line-through">
                          {formatMinorMoney(t.priceAmount, PLATFORM_CURRENCY)}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {t.inGallery ? (
                        <StatusBadge tone="success" dot>
                          {tx.inGallery}
                        </StatusBadge>
                      ) : t.isPublished ? (
                        <StatusBadge tone="warning" dot>
                          {tx.publishedNoVersion}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" dot>
                          {tx.draft}
                        </StatusBadge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {t.activeVersion !== null ? `v${t.activeVersion}` : <span className="text-ink-soft">{tx.noneActive}</span>}
                      <span className="block text-xs text-ink-soft">
                        {fmt(t.versionCount === 1 ? tx.versionOne : tx.versionMany, { count: t.versionCount })}
                      </span>
                    </Td>
                    <Td className="text-end whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={publishing.has(t.id) || (!t.isPublished && t.activeVersion === null)}
                        title={!t.isPublished && t.activeVersion === null ? tx.activateFirst : undefined}
                        onClick={() => void togglePublished(t)}
                      >
                        {t.isPublished ? <EyeOff /> : <Eye />} {t.isPublished ? tx.unpublish : tx.publish}
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={fmt(tx.versionsOf, { name: t.name })} onClick={() => setVersionsOf(t)}>
                        <History />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={fmt(tx.editNamed, { name: t.name })} onClick={() => setEditing(t)}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={fmt(tx.deleteNamed, { name: t.name })} onClick={() => setDeleting(t)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t, created) => {
            toast.success(fmt(created ? tx.createdToast : tx.savedToast, { name: t.name }));
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
      {versionsOf && (
        <VersionsDrawer
          template={versionsOf}
          onClose={() => setVersionsOf(null)}
          onChanged={() => void refresh({ silent: true })}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={fmt(tx.deleteTitle, { name: deleting?.name ?? "" })}
        description={tx.deleteDescription}
        confirmLabel={tx.deleteTemplate}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteTemplate(deleting.id);
          toast.success(tx.deletedToast);
          setDeleting(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ the form

interface FormState {
  name: string;
  category: string;
  thumbnailUrl: string;
  kind: Kind;
  priceAmount: string;
  isFree: boolean;
  primaryColor: string;
  tags: string;
  rtl: boolean;
}

function toForm(t: Template | null): FormState {
  return {
    name: t?.name ?? "",
    category: t?.category ?? "",
    thumbnailUrl: t?.thumbnailUrl ?? "",
    kind: t?.kind ?? "store",
    priceAmount: String(t?.priceAmount ?? 0),
    isFree: t?.isFree ?? true,
    primaryColor: t?.primaryColor ?? "",
    tags: (t?.tags ?? []).join(", "),
    rtl: t?.rtl ?? true,
  };
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: (t: Template, created: boolean) => void;
}) {
  const tx = useT(STRINGS);
  const [form, setForm] = useState<FormState>(() => toForm(template));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = Number(form.priceAmount);
    if (!Number.isInteger(price) || price < 0) {
      setError(tx.errPrice);
      return;
    }
    setBusy(true);
    setError(null);
    const input: TemplateInput = {
      ...(template ? { id: template.id } : {}),
      name: form.name.trim(),
      category: form.category.trim(),
      thumbnailUrl: form.thumbnailUrl.trim(),
      kind: form.kind,
      priceAmount: price,
      isFree: form.isFree,
      primaryColor: form.primaryColor.trim(),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rtl: form.rtl,
    };
    try {
      onSaved(await adminApi.saveTemplate(input), !template);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={template ? fmt(tx.editNamed, { name: template.name }) : tx.newTemplate}
      description={tx.modalDescription}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tx.cancel}
          </Button>
          <Button type="submit" form="template-form" disabled={busy}>
            {busy ? tx.saving : template ? tx.save : tx.create}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label={tx.name} required maxLength={200} value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={tx.kind} value={form.kind} onChange={(e) => set("kind", e.target.value as Kind)}>
            <option value="store">{tx.kindStore}</option>
            <option value="funnel">{tx.kindFunnel}</option>
            <option value="landing">{tx.kindLanding}</option>
          </SelectField>
          <TextField label={tx.category} maxLength={100} value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
        <TextField
          label={tx.thumbnailUrl}
          type="url"
          maxLength={500}
          value={form.thumbnailUrl}
          onChange={(e) => set("thumbnailUrl", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={tx.listPrice}
            type="number"
            min={0}
            step="1"
            value={form.priceAmount}
            hint={Number(form.priceAmount) > 0 ? formatMinorMoney(Number(form.priceAmount), PLATFORM_CURRENCY) : undefined}
            onChange={(e) => set("priceAmount", e.target.value)}
          />
          <TextField
            label={tx.swatch}
            placeholder="#2563EB"
            hint={tx.swatchHint}
            value={form.primaryColor}
            onChange={(e) => set("primaryColor", e.target.value)}
          />
        </div>
        <TextField label={tx.tags} hint={tx.tagsHint} value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        <div className="flex flex-wrap gap-6">
          <Toggle label={tx.free} checked={form.isFree} onChange={(v) => set("isFree", v)} />
          <Toggle label={tx.rtl} checked={form.rtl} onChange={(v) => set("rtl", v)} />
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------- the versions

function VersionsDrawer({
  template,
  onClose,
  onChanged,
}: {
  template: Template;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tx = useT(STRINGS);
  const toast = useToast();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getTemplate(template.id), [template.id]);
  const [viewing, setViewing] = useState<AdminTemplateVersion | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const versions = data?.versions ?? [];
  const current = data?.template ?? template;

  async function toggle(versionId: string, isActive: boolean) {
    setBusy(versionId);
    try {
      await adminApi.setTemplateVersionActive(template.id, versionId, isActive);
      await refresh({ silent: true });
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function view(versionId: string) {
    try {
      setViewing(await adminApi.getTemplateVersion(template.id, versionId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  /** Starts a new version from the newest one's content, so an edit is a small diff. */
  async function startAdding() {
    const latest = versions[0];
    if (!latest) {
      setAdding(JSON.stringify({ globalStyles: {}, pages: [{ path: "/", title: "Home", pageType: "home", builderData: { version: 1, sections: [] } }], sections: [] }, null, 2));
      return;
    }
    try {
      const full = await adminApi.getTemplateVersion(template.id, latest.id);
      setAdding(JSON.stringify({ globalStyles: full.globalStyles, pages: full.pages, sections: full.sections }, null, 2));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={fmt(tx.versionsTitle, { name: current.name })}
      description={tx.versionsDescription}
      className="sm:max-w-2xl"
    >
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          {current.inGallery ? (
            <StatusBadge tone="success" dot>
              {fmt(tx.inGalleryAs, { version: current.activeVersion ?? "" })}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral" dot>
              {tx.notInGallery}
            </StatusBadge>
          )}
          <Button size="sm" onClick={() => void startAdding()} disabled={adding !== null}>
            <Plus /> {tx.newVersion}
          </Button>
        </div>

        {adding !== null && (
          <NewVersionForm
            templateId={template.id}
            initial={adding}
            onCancel={() => setAdding(null)}
            onCreated={async (n) => {
              toast.success(fmt(tx.versionAdded, { version: n }));
              setAdding(null);
              await refresh({ silent: true });
              onChanged();
            }}
          />
        )}

        {versions.length === 0 ? (
          <EmptyBlock message={tx.noVersions} />
        ) : (
          <ul className="divide-y divide-line rounded-[0.875rem] border border-line">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{v.version}</span>
                    {v.primaryColor && (
                      <span className="size-3 rounded-full border border-line" style={{ background: v.primaryColor }} aria-hidden />
                    )}
                    {v.isActive ? (
                      <StatusBadge tone="success">{tx.active}</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">{tx.inactive}</StatusBadge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {fmt(tx.versionSummary, {
                      pages: v.pageCount,
                      paths: v.pagePaths.join(", "),
                      sites: v.websiteCount,
                      when: formatRelative(v.createdAt),
                    })}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void view(v.id)}>
                  {tx.view}
                </Button>
                <Toggle
                  label={fmt(tx.versionActive, { version: v.version })}
                  hideLabel
                  checked={v.isActive}
                  disabled={busy === v.id}
                  onChange={(on) => void toggle(v.id, on)}
                />
              </li>
            ))}
          </ul>
        )}
      </DataState>

      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={fmt(tx.versionContent, { version: viewing.version })} className="max-w-3xl">
          <p className="mb-2 text-xs text-ink-soft">{fmt(tx.addedReadOnly, { date: formatDate(viewing.createdAt) })}</p>
          <JsonBlock
            value={{ globalStyles: viewing.globalStyles, pages: viewing.pages, sections: viewing.sections }}
            className="max-h-[60vh]"
          />
        </Modal>
      )}
    </Drawer>
  );
}

function NewVersionForm({
  templateId,
  initial,
  onCancel,
  onCreated,
}: {
  templateId: string;
  initial: string;
  onCancel: () => void;
  onCreated: (version: number) => void | Promise<void>;
}) {
  const tx = useT(STRINGS);
  const [json, setJson] = useState(initial);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError(tx.errJson);
      return;
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { pages?: unknown }).pages)) {
      setError(tx.errShape);
      return;
    }
    const body = parsed as { globalStyles?: Record<string, unknown>; pages: []; sections?: [] };
    setBusy(true);
    setError(null);
    try {
      const created = await adminApi.createTemplateVersion(templateId, {
        globalStyles: body.globalStyles ?? {},
        pages: body.pages,
        sections: body.sections ?? [],
        activate,
      });
      await onCreated(created.version);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-[0.875rem] border border-line bg-paper-sunken p-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <TextAreaField
        label={tx.versionJson}
        hint={tx.versionJsonHint}
        rows={14}
        className="font-mono"
        spellCheck={false}
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toggle label={tx.makeActive} checked={activate} onChange={setActivate} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {tx.cancel}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? tx.adding : tx.addVersion}
          </Button>
        </div>
      </div>
      <p className="text-xs text-ink-soft">
        {tx.keys} <Mono>globalStyles</Mono>, <Mono>pages</Mono> ({tx.eachWith} <Mono>path</Mono>, <Mono>title</Mono>,{" "}
        <Mono>pageType</Mono>, <Mono>builderData</Mono>, <Mono>seo</Mono>), <Mono>sections</Mono>.
      </p>
    </form>
  );
}
