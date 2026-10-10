import { useState } from "react";
import { IconDelete, IconEdit, IconLayers, IconPlus, IconPower, IconProducts } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  bundlesDelete,
  bundlesGet,
  bundlesList,
  bundlesSetProducts,
  bundlesUpdate,
  type BundleDto,
  type BundleTierDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { useToast } from "@/components/Toast";
import { BundleEditorDialog } from "./BundleEditorDialog";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";
import { FormProblem, OfferList, OfferListState, OfferPage, OfferRow, SheetActions, TOUCH_BUTTON, TOUCH_FIELD } from "./OfferKit";

/**
 * Quantity bundles: the list of the store's bundles — each with
 * its ladder in one line, the products that use it, its numbers and its state
 * switch. A row opens the bundle's sheet; «…» holds its products and delete.
 */

const STRINGS = {
  en: {
    title: "Bundles",
    description: "Buy more, pay less per piece. Build one and use it on any number of products.",
    newBundle: "New bundle",
    listLabel: "Your bundles",
    emptyTitle: "No bundles yet",
    emptyDescription: "Offer 5% off two pieces and 10% off three, and raise the value of every order.",
    onProducts: "On {products}",
    noProducts: "Not on any product yet",
    edit: "Edit",
    chooseProducts: "Choose its products",
    turnOn: "Turn on",
    turnOff: "Turn off",
    delete: "Delete",
    deleteTitle: "Delete “{name}”?",
    deleteHint: "Its products go back to their normal price. Orders already placed keep theirs.",
    deleted: "“{name}” was deleted.",
    turnedOn: "“{name}” is on.",
    turnedOff: "“{name}” is off.",
    tier_percentage: "{q} pcs: {v}% off",
    tier_fixed_price: "{q} pcs for {v}",
    tier_fixed_amount_off: "{q} pcs: {v} off",
    tier_buy_x_get_y: "{q} pcs: {v} free",
    tier_none: "{q} pcs",
    tierJoin: " · ",
    withFreeShipping: "{tier} + free shipping",
    productsTitle: "Products of “{name}”",
    productsDescription: "A product has one bundle. Ticking a product here takes it off any other bundle.",
    search: "Search products",
    noMatch: "No products match.",
    picked: "{count} picked",
    productsSaved: "Products saved.",
  },
  ar: {
    title: "الباقات",
    description: "اشترِ أكثر وادفع أقل للقطعة. أنشئ باقة واستخدمها على أي عدد من المنتجات.",
    newBundle: "باقة جديدة",
    listLabel: "باقاتك",
    emptyTitle: "لا توجد باقات بعد",
    emptyDescription: "قدّم خصم 5% على قطعتين و10% على ثلاث، وارفع قيمة كل طلب.",
    onProducts: "على {products}",
    noProducts: "غير مستخدمة على أي منتج بعد",
    edit: "تعديل",
    chooseProducts: "اختيار منتجاتها",
    turnOn: "تفعيل",
    turnOff: "إيقاف",
    delete: "حذف",
    deleteTitle: "حذف «{name}»؟",
    deleteHint: "ستعود منتجاتها إلى سعرها العادي. الطلبات التي تمت بها تبقى كما هي.",
    deleted: "تم حذف «{name}».",
    turnedOn: "تم تفعيل «{name}».",
    turnedOff: "تم إيقاف «{name}».",
    tier_percentage: "{q} قطع: خصم {v}%",
    tier_fixed_price: "{q} قطع بسعر {v}",
    tier_fixed_amount_off: "{q} قطع: خصم {v}",
    tier_buy_x_get_y: "{q} قطع: {v} مجانًا",
    tier_none: "{q} قطع",
    tierJoin: " · ",
    withFreeShipping: "{tier} + شحن مجاني",
    productsTitle: "منتجات «{name}»",
    productsDescription: "للمنتج باقة واحدة. تحديد منتج هنا ينقله من أي باقة أخرى.",
    search: "ابحث في المنتجات",
    noMatch: "لا توجد منتجات مطابقة.",
    picked: "تم اختيار {count}",
    productsSaved: "تم حفظ المنتجات.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

function tierText(tier: BundleTierDto, t: Strings): string {
  const q = tier.quantity;
  const base = !tier.discountValue
    ? fmt(t.tier_none, { q })
    : fmt(t[`tier_${tier.discountType}`], {
        q,
        v:
          tier.discountType === "percentage"
            ? tier.discountValue / 100
            : tier.discountType === "buy_x_get_y"
              ? tier.discountValue
              : formatMoney(tier.discountValue),
      });
  return tier.freeShipping ? fmt(t.withFreeShipping, { tier: base }) : base;
}

export function BundlesPage() {
  // Each offer's views, acceptances and added revenue.
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // Shown at once from the session's copy on the way back from the hub, and read again behind it.
  const list = useCachedAsync(`offer-bundles:${workspaceId}`, () => bundlesList(apiClient, workspaceId), [workspaceId]);
  const [editing, setEditing] = useState<BundleDto | "new" | null>(null);
  const [assigning, setAssigning] = useState<BundleDto | null>(null);
  const [deleting, setDeleting] = useState<BundleDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const bundles = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  /** The switch moves at once; a refusal puts it back and says why. Undo is the opposite call. */
  async function setActive(bundle: BundleDto, isActive: boolean, undoable = true): Promise<void> {
    setBusyId(bundle.id);
    list.setData((prev) => (prev ?? []).map((b) => (b.id === bundle.id ? { ...b, isActive } : b)));
    try {
      await bundlesUpdate(apiClient, workspaceId, bundle.id, { isActive });
      const said = fmt(isActive ? t.turnedOn : t.turnedOff, { name: bundle.name });
      if (undoable) toast.undo(said, () => setActive(bundle, !isActive, false));
      else toast.success(said);
      void reload();
    } catch (err) {
      list.setData((prev) => (prev ?? []).map((b) => (b.id === bundle.id ? { ...b, isActive: !isActive } : b)));
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const newButton = (
    <Button type="button" className={TOUCH_BUTTON} onClick={() => setEditing("new")}>
      <IconPlus className="size-4" aria-hidden />
      {t.newBundle}
    </Button>
  );

  const menuFor = (bundle: BundleDto): ContextMenuItem[] => [
    { id: "edit", label: t.edit, icon: IconEdit, onSelect: () => setEditing(bundle) },
    { id: "products", label: t.chooseProducts, icon: IconProducts, onSelect: () => setAssigning(bundle) },
    { id: "toggle", label: bundle.isActive ? t.turnOff : t.turnOn, icon: IconPower, onSelect: () => void setActive(bundle, !bundle.isActive) },
    { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => setDeleting(bundle) },
  ];

  return (
    <OfferPage title={t.title} description={t.description} primaryAction={bundles.length > 0 ? newButton : undefined}>
      <OfferListState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {bundles.length === 0 ? (
          <EmptyState icon={<IconLayers />} title={t.emptyTitle} description={t.emptyDescription} action={newButton} />
        ) : (
          <OfferList label={t.listLabel}>
            {bundles.map((bundle) => (
              <OfferRow
                key={bundle.id}
                name={bundle.name}
                line={<bdi>{bundle.tiers.map((tier) => tierText(tier, t)).join(t.tierJoin)}</bdi>}
                details={
                  <>
                    <span className="tabular-nums">
                      {bundle.productCount > 0 ? fmt(t.onProducts, { products: countOf("item", bundle.productCount) }) : t.noProducts}
                    </span>
                    <OfferNumbers stat={stats?.bundles[bundle.id]} />
                  </>
                }
                onOpen={() => setEditing(bundle)}
                toggle={{ checked: bundle.isActive, busy: busyId === bundle.id, onChange: (next) => void setActive(bundle, next) }}
                menu={menuFor(bundle)}
              />
            ))}
          </OfferList>
        )}
      </OfferListState>

      {editing && (
        <BundleEditorDialog
          bundle={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const wasNew = editing === "new";
            setEditing(null);
            void reload();
            // A new bundle does nothing until it is on a product: go there next.
            if (wasNew) setAssigning(saved);
          }}
        />
      )}
      {assigning && (
        <BundleProductsDialog
          bundle={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteHint}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await bundlesDelete(apiClient, workspaceId, deleting.id);
          toast.success(fmt(t.deleted, { name: deleting.name }));
          setDeleting(null);
          void reload();
        }}
      />
    </OfferPage>
  );
}

function BundleProductsDialog({ bundle, onClose, onSaved }: { bundle: BundleDto; onClose: () => void; onSaved: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [full, products] = await Promise.all([
      bundlesGet(apiClient, workspaceId, bundle.id),
      apiClient.listProducts(workspaceId, { status: ["draft", "active"], limit: 200 }),
    ]);
    setSelected(new Set((full.products ?? []).map((p) => p.id)));
    return products.products;
  }, [workspaceId, bundle.id]);

  const q = search.trim().toLowerCase();
  const shown = (data.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await bundlesSetProducts(apiClient, workspaceId, bundle.id, [...selected]);
      toast.success(t.productsSaved);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={fmt(t.productsTitle, { name: bundle.name })}
      description={t.productsDescription}
      footer={<SheetActions busy={busy} disabled={!selected} onCancel={onClose} onSave={() => void save()} />}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            value={search}
            // Looking for a product is not an edit: closing after a search alone asks nothing.
            onInput={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              setSearch(e.target.value);
            }}
            className={cn("min-w-0 flex-1", TOUCH_FIELD)}
          />
          {selected && selected.size > 0 && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{fmt(t.picked, { count: selected.size })}</span>}
        </div>
        <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()} empty={shown.length === 0} emptyMessage={t.noMatch}>
          <ul className="zimos-offer-checklist max-h-80 divide-y divide-line overflow-y-auto overscroll-contain rounded-[0.875rem] bg-paper-raised ring-1 ring-line">
            {shown.map((product) => (
              <li key={product.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink transition-[background-color] duration-[var(--dur-fade)] hover:bg-ink/4 motion-reduce:transition-none">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                    checked={selected?.has(product.id) ?? false}
                    disabled={busy}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current ?? []);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 truncate">
                    <bdi>{product.name}</bdi>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </DataState>
        <FormProblem>{error}</FormProblem>
      </div>
    </Modal>
  );
}
