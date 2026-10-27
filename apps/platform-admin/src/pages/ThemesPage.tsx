import { useState } from "react";
import { Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { adminThemeUpdate, adminThemesList, type CatalogTheme } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Panel, Td, Th } from "@/components/Panel";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Themes",
    description:
      "The store themes merchants can pick. A theme's look is code in the storefront; here you name it, sort it, price it and switch it on or off.",
    empty: "No themes yet — the catalog starts with the storefront's own themes once the migrations have run.",
    catalog: "Catalog",
    colTheme: "Theme",
    colCategory: "Category",
    colKind: "Kind",
    colPrice: "Price",
    colStores: "Stores using it",
    colStatus: "Status",
    free: "Free",
    offered: "Offered",
    hidden: "Hidden",
    edit: "Edit",
    errPrice: "The price is a positive amount, or empty for free.",
    savedToast: "Theme saved.",
    editNamed: "Edit {name}",
    originalNote: "The original look is every store's fallback: it stays free and offered.",
    cancel: "Cancel",
    save: "Save",
    nameEn: "Name (English)",
    nameAr: "Name (Arabic)",
    descriptionEn: "Description (English)",
    descriptionAr: "Description (Arabic)",
    category: "Category",
    categoryHint: "e.g. fashion, kids, electronics",
    kind: "Kind",
    kindStore: "Store (many products)",
    kindLanding: "Landing (one product)",
    tags: "Tags",
    tagsHint: "Comma-separated",
    order: "Order",
    previews: "Preview pictures",
    previewsHint: "One https link per line, up to 6 (desktop and mobile).",
    price: "Price",
    priceHint: "Empty = free. Paid themes show their price but can't be bought until the wallet exists.",
    currency: "Currency",
    offeredToStores: "Offered to stores (stores already on it keep it)",
  },
  ar: {
    title: "الثيمات",
    description:
      "ثيمات المتاجر التي يمكن للتجار اختيارها. مظهر الثيم كود في واجهة المتجر؛ هنا تسمّيه وترتّبه وتسعّره وتفعّله أو توقفه.",
    empty: "لا توجد ثيمات بعد — يبدأ الكتالوج بثيمات واجهة المتجر نفسها بعد تشغيل عمليات الترحيل.",
    catalog: "الكتالوج",
    colTheme: "الثيم",
    colCategory: "الفئة",
    colKind: "النوع",
    colPrice: "السعر",
    colStores: "المتاجر التي تستخدمه",
    colStatus: "الحالة",
    free: "مجاني",
    offered: "معروض",
    hidden: "مخفي",
    edit: "تعديل",
    errPrice: "السعر مبلغ موجب، أو فارغ للمجاني.",
    savedToast: "حُفظ الثيم.",
    editNamed: "تعديل {name}",
    originalNote: "المظهر الأصلي هو البديل الافتراضي لكل متجر: يبقى مجانيًا ومعروضًا.",
    cancel: "إلغاء",
    save: "حفظ",
    nameEn: "الاسم (بالإنجليزية)",
    nameAr: "الاسم (بالعربية)",
    descriptionEn: "الوصف (بالإنجليزية)",
    descriptionAr: "الوصف (بالعربية)",
    category: "الفئة",
    categoryHint: "مثل: fashion، kids، electronics",
    kind: "النوع",
    kindStore: "متجر (منتجات متعددة)",
    kindLanding: "صفحة هبوط (منتج واحد)",
    tags: "الوسوم",
    tagsHint: "مفصولة بفواصل",
    order: "الترتيب",
    previews: "صور المعاينة",
    previewsHint: "رابط https واحد في كل سطر، حتى 6 (للحاسوب والجوال).",
    price: "السعر",
    priceHint: "فارغ = مجاني. تُعرض الثيمات المدفوعة بسعرها لكن لا يمكن شراؤها حتى تتوفر المحفظة.",
    currency: "العملة",
    offeredToStores: "معروض للمتاجر (المتاجر التي تستخدمه تحتفظ به)",
  },
} satisfies Messages;

/**
 * The store theme catalog (SPEC §8.1, themes/themesCatalog.js). A theme is
 * storefront code; each row here describes one — its names, category, kind,
 * preview pictures, order, whether stores may pick it, and its price. Prices
 * are set here, never in code; a paid theme can't be bought until the wallet
 * exists, so stores see it with its price but can't switch to it.
 */
export function ThemesPage() {
  const t = useT(STRINGS);
  const { can } = useAuth();
  const { data, loading, error, refresh } = useAsync(() => adminThemesList(apiClient), []);
  const [editing, setEditing] = useState<CatalogTheme | null>(null);
  const canManage = can("templates.manage");

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
      />
      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && data.length === 0 ? (
          <EmptyBlock message={t.empty} />
        ) : (
          <Panel title={t.catalog}>
            <Table>
              <TableHeader>
                <TableRow>
                  <Th>{t.colTheme}</Th>
                  <Th>{t.colCategory}</Th>
                  <Th>{t.colKind}</Th>
                  <Th>{t.colPrice}</Th>
                  <Th>{t.colStores}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((theme) => (
                  <TableRow key={theme.key}>
                    <Td>
                      <div className="font-medium">{theme.name.en || theme.key}</div>
                      <div className="text-xs text-ink-soft" dir="rtl">
                        {theme.name.ar}
                      </div>
                      <div className="font-mono text-[11px] text-ink-soft">{theme.key}</div>
                    </Td>
                    <Td>{theme.category}</Td>
                    <Td>{theme.kind}</Td>
                    <Td>{theme.price ? formatMinorMoney(theme.price.amount, theme.price.currency) : t.free}</Td>
                    <Td>{theme.stores ?? 0}</Td>
                    <Td>
                      <StatusBadge tone={theme.isActive ? "success" : "neutral"}>{theme.isActive ? t.offered : t.hidden}</StatusBadge>
                    </Td>
                    <Td>
                      {canManage && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(theme)}>
                          {t.edit}
                        </Button>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
      {editing && (
        <ThemeEditor
          theme={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

function ThemeEditor({ theme, onClose, onSaved }: { theme: CatalogTheme; onClose: () => void; onSaved: () => void }) {
  const tx = useT(STRINGS);
  const toast = useToast();
  const [form, setForm] = useState({
    nameEn: theme.name.en ?? "",
    nameAr: theme.name.ar ?? "",
    descriptionEn: theme.description.en ?? "",
    descriptionAr: theme.description.ar ?? "",
    category: theme.category,
    kind: theme.kind,
    tags: theme.tags.join(", "),
    previewImages: theme.previewImages.join("\n"),
    position: String(theme.position),
    isActive: theme.isActive,
    price: theme.price ? String(theme.price.amount / 100) : "",
    currency: theme.price?.currency ?? "EGP",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  const original = theme.key === "original";

  async function save() {
    const amount = form.price.trim() === "" ? null : Math.round(Number(form.price) * 100);
    if (amount !== null && (!Number.isFinite(amount) || amount < 1)) return toast.error(tx.errPrice);
    setBusy(true);
    try {
      await adminThemeUpdate(apiClient, theme.key, {
        name: { en: form.nameEn.trim(), ar: form.nameAr.trim() },
        description: { en: form.descriptionEn.trim(), ar: form.descriptionAr.trim() },
        category: form.category.trim().toLowerCase(),
        kind: form.kind,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        previewImages: form.previewImages.split("\n").map((u) => u.trim()).filter(Boolean),
        position: Number.parseInt(form.position, 10) || 0,
        ...(original ? {} : { isActive: form.isActive, price: amount === null ? null : { amount, currency: form.currency.trim().toUpperCase() } }),
      });
      toast.success(tx.savedToast);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={fmt(tx.editNamed, { name: theme.name.en || theme.key })}
      description={original ? tx.originalNote : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tx.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {tx.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={tx.nameEn} value={form.nameEn} maxLength={80} onChange={(e) => set({ nameEn: e.target.value })} />
        <TextField label={tx.nameAr} dir="rtl" value={form.nameAr} maxLength={80} onChange={(e) => set({ nameAr: e.target.value })} />
        <TextAreaField label={tx.descriptionEn} rows={2} value={form.descriptionEn} maxLength={300} onChange={(e) => set({ descriptionEn: e.target.value })} />
        <TextAreaField label={tx.descriptionAr} dir="rtl" rows={2} value={form.descriptionAr} maxLength={300} onChange={(e) => set({ descriptionAr: e.target.value })} />
        <TextField label={tx.category} hint={tx.categoryHint} value={form.category} onChange={(e) => set({ category: e.target.value })} />
        <SelectField label={tx.kind} value={form.kind} onChange={(e) => set({ kind: e.target.value as CatalogTheme["kind"] })}>
          <option value="store">{tx.kindStore}</option>
          <option value="landing">{tx.kindLanding}</option>
        </SelectField>
        <TextField label={tx.tags} hint={tx.tagsHint} value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
        <TextField label={tx.order} type="number" min={0} value={form.position} onChange={(e) => set({ position: e.target.value })} />
        <TextAreaField
          label={tx.previews}
          hint={tx.previewsHint}
          className="sm:col-span-2"
          rows={3}
          value={form.previewImages}
          onChange={(e) => set({ previewImages: e.target.value })}
        />
        {!original && (
          <>
            <TextField label={tx.price} hint={tx.priceHint} inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} />
            <TextField label={tx.currency} maxLength={3} value={form.currency} onChange={(e) => set({ currency: e.target.value })} />
            <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
              {tx.offeredToStores}
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
