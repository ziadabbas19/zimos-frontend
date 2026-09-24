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
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCatalogLabels } from "../catalogLabels";
import { VariantForm } from "./VariantForm";

const STRINGS = {
  en: {
    title: "Variants",
    description: "Each buyable row — size / colour, its price and stock.",
    add: "Add variant",
    empty: "No variants yet. Add at least one so the product can be sold.",
    colVariant: "Variant",
    colSku: "SKU",
    colPrice: "Price",
    colStock: "Stock",
    colStatus: "Status",
    colActions: "Actions",
    archivedWithProduct: "Archived with product",
    archivedWithProductHint: "Comes back when the product is restored.",
    edit: "Edit",
    delete: "Delete",
    addTitle: "Add variant",
    editTitle: "Edit variant",
    deleteTitle: "Delete this variant?",
    deleteDescription:
      "It's archived, not removed, so order lines and inventory history that reference it stay intact.",
    deleteConfirm: "Archive variant",
    working: "Archiving…",
    cancel: "Cancel",
    archivedToast: "Variant archived.",
    addedToast: "Variant added.",
    savedToast: "Variant saved.",
  },
  ar: {
    title: "المتغيرات",
    description: "كل صف قابل للشراء — المقاس / اللون وسعره ومخزونه.",
    add: "إضافة متغير",
    empty: "لا توجد متغيرات بعد. أضف متغيرًا واحدًا على الأقل حتى يمكن بيع المنتج.",
    colVariant: "المتغير",
    colSku: "SKU",
    colPrice: "السعر",
    colStock: "المخزون",
    colStatus: "الحالة",
    colActions: "إجراءات",
    archivedWithProduct: "مؤرشف مع المنتج",
    archivedWithProductHint: "يعود عند استعادة المنتج.",
    edit: "تعديل",
    delete: "حذف",
    addTitle: "إضافة متغير",
    editTitle: "تعديل المتغير",
    deleteTitle: "حذف هذا المتغير؟",
    deleteDescription:
      "تتم أرشفته وليس حذفه، لذلك تبقى بنود الأوردرات وسجل المخزون المرتبطة به كما هي.",
    deleteConfirm: "أرشفة المتغير",
    working: "جارٍ الأرشفة…",
    cancel: "إلغاء",
    archivedToast: "تمت أرشفة المتغير.",
    addedToast: "تمت إضافة المتغير.",
    savedToast: "تم حفظ المتغير.",
  },
} satisfies Messages;

interface Props {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}

export function VariantsSection({ productId, variants, onChanged }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteVariant(workspaceId, deleting.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    toast.success(t.archivedToast);
    setDeleting(null);
    onChanged();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
            <p className="text-sm text-ink-soft">{t.description}</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            {t.add}
          </Button>
        </div>

        {variants.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pe-3 text-start font-medium">{t.colVariant}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t.colSku}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t.colPrice}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t.colStock}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t.colStatus}</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">{t.colActions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="py-2 pe-3 text-ink">
                      {formatOptions(v.optionValues) || <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="py-2 pe-3 text-ink-soft">{v.sku || "—"}</td>
                    <td className="py-2 pe-3 text-ink-soft">{formatMoney(v.priceAmount, v.currency)}</td>
                    <td className="py-2 pe-3 text-ink-soft">
                      {v.stockOnHand}
                      {v.reservedStock ? ` (−${v.reservedStock})` : ""}
                    </td>
                    <td className="py-2 pe-3">
                      <StatusBadge
                        value={v.status}
                        text={v.archivedWithProduct ? t.archivedWithProduct : labels.status(v.status)}
                      />
                      {v.archivedWithProduct && (
                        <span className="sr-only"> {t.archivedWithProductHint}</span>
                      )}
                    </td>
                    <td className="py-2 text-end whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        {t.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(v)}
                      >
                        {t.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.addTitle}>
        <VariantForm
          productId={productId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success(t.addedToast);
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editTitle}>
        {editing && (
          <VariantForm
            productId={productId}
            variant={editing}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              toast.success(t.savedToast);
              onChanged();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t.deleteTitle}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.working}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
