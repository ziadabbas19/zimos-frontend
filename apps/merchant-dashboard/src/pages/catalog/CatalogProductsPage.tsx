import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "@store-builder/ui";
import type { Product, ProductStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { getErrorMessage } from "@/lib/errors";
import { formatMoneyRange, parseMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STATUS_TABS: Array<{ value: "" | ProductStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function priceRange(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => parseMoney(v.priceAmount));
  return formatMoneyRange(Math.min(...prices), Math.max(...prices), variants[0].currency);
}

function stockSummary(product: Product): string {
  const variants = product.variants ?? [];
  if (variants.length === 0) return "No variants";
  const total = variants.reduce((sum, v) => sum + v.stockOnHand, 0);
  return `${total} in stock · ${variants.length} variant${variants.length === 1 ? "" : "s"}`;
}

export function CatalogProductsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const list = useCursorList<Product>(
    (cursor) =>
      apiClient
        .listProducts(workspaceId, { status: status || undefined, cursor, limit: 50 })
        .then((r) => ({ items: r.products, nextCursor: r.nextCursor })),
    [workspaceId, status]
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

  async function confirmDelete() {
    if (!toDelete) return;
    const name = toDelete.name;
    await apiClient.deleteProduct(workspaceId, toDelete.id);
    toast.success(
      `"${name}" archived. It's hidden from the storefront; existing orders keep their history.`
    );
    setToDelete(null);
    list.reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Products"
        description="Everything you sell — with variants, offers, and stock."
        actions={
          <Button asChild>
            <Link to="/catalog/new">New product</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              onClick={() => setStatus(tab.value)}
              className={
                "rounded-[0.375rem] px-3 py-1.5 text-sm font-medium transition-colors " +
                (status === tab.value
                  ? "bg-primary-soft text-primary-dark"
                  : "text-ink-soft hover:text-ink")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter loaded products by name or SKU"
          className="max-w-xs"
        />
        <Link to="/catalog/collections" className="ml-auto text-sm text-primary hover:underline">
          Manage collections →
        </Link>
      </div>

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={filtered.length === 0}
        emptyMessage={
          list.items.length === 0
            ? "No products yet. Create your first one."
            : "No products match your filter."
        }
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Price range</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-line last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/catalog/${product.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    <div className="text-xs text-ink-soft">{product.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={product.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{priceRange(product)}</td>
                  <td className="px-4 py-3 text-ink-soft">{stockSummary(product)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setToDelete(product)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ""}"?`}
        description="Products are soft-deleted (archived), not removed — so past orders and inventory history stay intact. It disappears from the storefront and can't take new orders."
        confirmLabel="Archive product"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />

      {Boolean(list.error) && list.items.length > 0 && (
        <p className="mt-2 text-xs text-danger">{getErrorMessage(list.error)}</p>
      )}
    </div>
  );
}
