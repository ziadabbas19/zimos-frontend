import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoneyRange, formatProductCode, parseMoney } from "@/lib/format";
import { primaryImage } from "@/lib/media";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ProductImage } from "@/components/ProductImage";
import { LoadMore } from "@/components/LoadMore";
import { useToast } from "@/components/Toast";
import { useCatalogLabels } from "./catalogLabels";
import { ProductRemoveDialog } from "./components/ProductRemoveDialog";

const STRINGS = {
  en: {
    title: "Products",
    description: "Everything you sell — with variants, offers, and stock.",
    newProduct: "New product",
    filterLabel: "Filter products by status",
    tabAll: "All",
    tabActive: "Active",
    tabDraft: "Draft",
    tabArchived: "Archived",
    searchPlaceholder: "Filter loaded products by name or SKU",
    listView: "List view",
    gridView: "Grid view",
    manageCollections: "Manage collections →",
    emptyAll: "No products yet. Create your first one.",
    emptyActive: "No active products.",
    emptyDraft: "No draft products.",
    emptyArchived: "No archived products. Products you archive show up here.",
    emptyFilter: "No products match your filter.",
    colProduct: "Product",
    colStatus: "Status",
    colPrice: "Price range",
    colStock: "Stock",
    colActions: "Actions",
    noVariants: "No variants",
    stock: "{total} in stock · {count} variants",
    stockOne: "{total} in stock · 1 variant",
    noWeight: "No weight",
    noWeightHint: "A variant has no weight. Shipping uses your default item weight for it.",
    edit: "Edit",
    delete: "Delete",
    restore: "Restore",
    restoring: "Restoring…",
    restoreHint: "Restores the product as a draft",
    deletePermanently: "Delete permanently",
    restoredToast: "“{name}” restored as a draft. Set it to Active when it's ready to sell.",
  },
  ar: {
    title: "المنتجات",
    description: "كل ما تبيعه — مع المتغيرات والعروض والمخزون.",
    newProduct: "منتج جديد",
    filterLabel: "تصفية المنتجات حسب الحالة",
    tabAll: "الكل",
    tabActive: "نشط",
    tabDraft: "مسودة",
    tabArchived: "المؤرشف",
    searchPlaceholder: "ابحث في المنتجات المعروضة بالاسم أو SKU",
    listView: "عرض القائمة",
    gridView: "عرض الشبكة",
    manageCollections: "إدارة المجموعات ←",
    emptyAll: "لا توجد منتجات بعد. أنشئ أول منتج.",
    emptyActive: "لا توجد منتجات نشطة.",
    emptyDraft: "لا توجد منتجات في المسودة.",
    emptyArchived: "لا توجد منتجات مؤرشفة. المنتجات التي تؤرشفها تظهر هنا.",
    emptyFilter: "لا توجد منتجات مطابقة للبحث.",
    colProduct: "المنتج",
    colStatus: "الحالة",
    colPrice: "نطاق السعر",
    colStock: "المخزون",
    colActions: "إجراءات",
    noVariants: "بدون متغيرات",
    stock: "المخزون: {total} · المتغيرات: {count}",
    stockOne: "المخزون: {total} · متغير واحد",
    noWeight: "بدون وزن",
    noWeightHint: "يوجد متغير بدون وزن. الشحن يستخدم الوزن الافتراضي للمنتج بدلًا منه.",
    edit: "تعديل",
    delete: "حذف",
    restore: "استعادة",
    restoring: "جارٍ الاستعادة…",
    restoreHint: "يستعيد المنتج كمسودة",
    deletePermanently: "حذف نهائي",
    restoredToast: "تمت استعادة “{name}” كمسودة. اجعله نشطًا عندما يكون جاهزًا للبيع.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** "all" is every product that can still sell or be finished: archived ones have their own tab. */
type Tab = "all" | "active" | "draft" | "archived";

const TAB_STATUS: Record<Tab, ProductStatus | ProductStatus[]> = {
  all: ["draft", "active"],
  active: "active",
  draft: "draft",
  archived: "archived",
};

type CatalogView = "list" | "grid";
const VIEW_KEY = "sb.catalogView";

function readView(): CatalogView {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function priceRange(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => parseMoney(v.priceAmount));
  return formatMoneyRange(Math.min(...prices), Math.max(...prices), variants[0].currency);
}

/** A live physical product with an active variant that has no weight set. */
function missingWeight(product: Product): boolean {
  if (product.productType !== "physical" || product.status === "archived") return false;
  return (product.variants ?? []).some((v) => v.status === "active" && v.weightGrams === null);
}

function NoWeightBadge({ product, t }: { product: Product; t: Strings }) {
  if (!missingWeight(product)) return null;
  return <StatusBadge value="no_weight" tone="warning" text={t.noWeight} className="ms-1.5" />;
}

function stockSummary(product: Product, t: Strings): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return t.noVariants;
  const total = variants.reduce((sum, v) => sum + v.stockOnHand, 0);
  return fmt(variants.length === 1 ? t.stockOne : t.stock, { total, count: variants.length });
}

export function CatalogProductsPage() {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<CatalogView>(readView);
  const [toRemove, setToRemove] = useState<Product | null>(null);
  // Rows with a restore in flight, so a second click can't send it twice.
  const [restoring, setRestoring] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private mode — non-fatal */
    }
  }, [view]);

  const list = useCursorList<Product>(
    (cursor) =>
      apiClient
        .listProducts(workspaceId, { status: TAB_STATUS[tab], cursor, limit: 50 })
        .then((r) => ({ items: r.products, nextCursor: r.nextCursor })),
    [workspaceId, tab]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list.items;
    return list.items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.variants ?? []).some((v) => v.sku?.toLowerCase().includes(q))
    );
  }, [list.items, search]);

  async function restore(product: Product) {
    if (restoring.has(product.id)) return;
    setRestoring((prev) => new Set(prev).add(product.id));
    try {
      await apiClient.restoreProduct(workspaceId, product.id);
      toast.success(fmt(t.restoredToast, { name: product.name }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRestoring((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      // Either way the row's real state is worth re-reading: a
      // PRODUCT_NOT_ARCHIVED means someone else already moved it.
      list.reload();
    }
  }

  const tabs = [
    { value: "all" as const, label: t.tabAll },
    { value: "active" as const, label: t.tabActive },
    { value: "draft" as const, label: t.tabDraft },
    { value: "archived" as const, label: t.tabArchived },
  ];

  const emptyByTab: Record<Tab, string> = {
    all: t.emptyAll,
    active: t.emptyActive,
    draft: t.emptyDraft,
    archived: t.emptyArchived,
  };

  function renderActions(product: Product) {
    const busy = restoring.has(product.id);
    return (
      <>
        <Button asChild size="sm" variant="ghost">
          <Link to={`/catalog/${product.id}`}>{t.edit}</Link>
        </Button>
        {product.status === "archived" ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              title={t.restoreHint}
              disabled={busy}
              onClick={() => restore(product)}
            >
              {busy ? t.restoring : t.restore}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              disabled={busy}
              onClick={() => setToRemove(product)}
            >
              {t.deletePermanently}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={() => setToRemove(product)}
          >
            {t.delete}
          </Button>
        )}
      </>
    );
  }

  const rowProps = { products: filtered, t, statusLabel: labels.status, renderActions };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild>
            <Link to="/catalog/new">{t.newProduct}</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs tabs={tabs} value={tab} onChange={setTab} label={t.filterLabel} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="max-w-xs"
        />

        <div className="ms-auto flex items-center gap-3">
          <div className="flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
            <button
              onClick={() => setView("list")}
              aria-label={t.listView}
              aria-pressed={view === "list"}
              className={cn(
                "cursor-pointer rounded-[0.375rem] p-1.5 transition-colors",
                view === "list" ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <List className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => setView("grid")}
              aria-label={t.gridView}
              aria-pressed={view === "grid"}
              className={cn(
                "cursor-pointer rounded-[0.375rem] p-1.5 transition-colors",
                view === "grid" ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
          <Link to="/catalog/collections" className="text-sm text-primary hover:underline">
            {t.manageCollections}
          </Link>
        </div>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={filtered.length === 0}
        emptyMessage={list.items.length === 0 ? emptyByTab[tab] : t.emptyFilter}
        onRetry={list.reload}
      >
        {view === "list" ? <ProductTable {...rowProps} /> : <ProductGrid {...rowProps} />}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      {toRemove && (
        <ProductRemoveDialog
          key={toRemove.id}
          product={toRemove}
          onClose={() => setToRemove(null)}
          onDone={() => {
            setToRemove(null);
            list.reload();
          }}
        />
      )}

      {Boolean(list.error) && list.items.length > 0 && (
        <p className="mt-2 text-xs text-danger">{errorMessage(list.error)}</p>
      )}
    </div>
  );
}

interface RowsProps {
  products: Product[];
  t: Strings;
  statusLabel: (status: ProductStatus) => string;
  renderActions: (product: Product) => ReactNode;
}

function ProductTable({ products, t, statusLabel, renderActions }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
            <th className="w-14 px-4 py-3 font-medium" />
            <th className="px-4 py-3 text-start font-medium">{t.colProduct}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colStatus}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colPrice}</th>
            <th className="px-4 py-3 text-start font-medium">{t.colStock}</th>
            <th className="px-4 py-3 font-medium">
              <span className="sr-only">{t.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
              <td className="py-2 ps-4">
                <ProductImage
                  media={primaryImage(product)}
                  alt={product.name}
                  className="size-10"
                />
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/catalog/${product.id}`}
                  className="font-medium text-ink hover:text-primary"
                >
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · {formatProductCode(product.productCode)}
                  </span>
                )}
                <div className="text-xs text-ink-soft">{product.slug}</div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex flex-wrap items-center gap-y-1" title={missingWeight(product) ? t.noWeightHint : undefined}>
                  <StatusBadge value={product.status} text={statusLabel(product.status)} />
                  <NoWeightBadge product={product} t={t} />
                </span>
              </td>
              <td className="px-4 py-3 text-ink-soft">{priceRange(product)}</td>
              <td className="px-4 py-3 text-ink-soft">{stockSummary(product, t)}</td>
              <td className="px-4 py-3 text-end whitespace-nowrap">{renderActions(product)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductGrid({ products, t, statusLabel, renderActions }: RowsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised transition-colors hover:border-primary"
        >
          <Link to={`/catalog/${product.id}`} className="block">
            <ProductImage
              media={primaryImage(product)}
              alt={product.name}
              className="aspect-[4/3] w-full rounded-none border-0"
              iconClassName="size-8"
            />
          </Link>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/catalog/${product.id}`}
                  className="font-medium text-ink hover:text-primary"
                >
                  {product.name}
                </Link>
                {formatProductCode(product.productCode) && (
                  <span className="ms-1.5 text-xs text-ink-soft">
                    · {formatProductCode(product.productCode)}
                  </span>
                )}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1" title={missingWeight(product) ? t.noWeightHint : undefined}>
                <StatusBadge value={product.status} text={statusLabel(product.status)} />
                <NoWeightBadge product={product} t={t} />
              </span>
            </div>
            <div className="mt-auto space-y-0.5 text-sm text-ink-soft">
              <div>{priceRange(product)}</div>
              <div className="text-xs">{stockSummary(product, t)}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">{renderActions(product)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
