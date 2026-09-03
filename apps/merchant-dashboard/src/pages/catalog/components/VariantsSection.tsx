import { useState } from "react";
import { Button, Card, CardContent } from "@store-builder/ui";
import type { Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, formatOptions } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { VariantForm } from "./VariantForm";

interface Props {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}

export function VariantsSection({ productId, variants, onChanged }: Props) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteVariant(workspaceId, deleting.id);
    toast.success("Variant archived.");
    setDeleting(null);
    onChanged();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">Variants</h2>
            <p className="text-sm text-ink-soft">Each buyable row — size / colour, its price and stock.</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            Add variant
          </Button>
        </div>

        {variants.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No variants yet. Add at least one so the product can be sold.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-3 font-medium">Variant</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Price</th>
                  <th className="py-2 pr-3 font-medium">Stock</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink">
                      {formatOptions(v.optionValues) || <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{v.sku || "—"}</td>
                    <td className="py-2 pr-3 text-ink-soft">{formatMoney(v.priceAmount, v.currency)}</td>
                    <td className="py-2 pr-3 text-ink-soft">
                      {v.stockOnHand}
                      {v.reservedStock ? ` (−${v.reservedStock})` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge value={v.status} />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(v)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add variant">
        <VariantForm
          productId={productId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success("Variant added.");
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit variant">
        {editing && (
          <VariantForm
            productId={productId}
            variant={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              toast.success("Variant saved.");
              onChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this variant?"
        description="It's archived, not removed, so order lines and inventory history that reference it stay intact."
        confirmLabel="Archive variant"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
