import { useState } from "react";
import { Button, Card, CardContent } from "@store-builder/ui";
import type { Offer, Variant } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatMoney, variantLabel } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCatalogLabels } from "../catalogLabels";
import { OfferForm } from "./OfferForm";

const STRINGS = {
  en: {
    title: "Offers",
    description: "Priced bundles of one or more variants.",
    create: "Create offer",
    empty: "No offers yet.",
    computedPrice: "Computed price",
    variantFallback: "Variant {id}",
    archivedWithProduct: "Archived with product",
    edit: "Edit",
    delete: "Delete",
    createTitle: "Create offer",
    editTitle: "Edit offer",
    deleteTitle: "Delete “{name}”?",
    deleteDescription: "It's archived, not removed, so any order placed through this offer keeps its record.",
    deleteConfirm: "Archive offer",
    working: "Archiving…",
    cancel: "Cancel",
    archivedToast: "Offer archived.",
    createdToast: "Offer created.",
    savedToast: "Offer saved.",
  },
  ar: {
    title: "العروض",
    description: "باقات بسعر محدد من متغير واحد أو أكثر.",
    create: "إنشاء عرض",
    empty: "لا توجد عروض بعد.",
    computedPrice: "سعر محسوب",
    variantFallback: "متغير {id}",
    archivedWithProduct: "مؤرشف مع المنتج",
    edit: "تعديل",
    delete: "حذف",
    createTitle: "إنشاء عرض",
    editTitle: "تعديل العرض",
    deleteTitle: "حذف “{name}”؟",
    deleteDescription: "تتم أرشفته وليس حذفه، لذلك يحتفظ أي أوردر تم من خلال هذا العرض بسجله.",
    deleteConfirm: "أرشفة العرض",
    working: "جارٍ الأرشفة…",
    cancel: "إلغاء",
    archivedToast: "تمت أرشفة العرض.",
    createdToast: "تم إنشاء العرض.",
    savedToast: "تم حفظ العرض.",
  },
} satisfies Messages;

interface Props {
  productId: string;
  offers: Offer[];
  variants: Variant[];
  onChanged: () => void;
}

export function OffersSection({ productId, offers, variants, onChanged }: Props) {
  const t = useT(STRINGS);
  const labels = useCatalogLabels();
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);

  const variantName = (id: string) => {
    const v = variants.find((x) => x.id === id);
    return v ? variantLabel(v) : fmt(t.variantFallback, { id: id.slice(0, 8) });
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiClient.deleteOffer(workspaceId, deleting.id);
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
            {t.create}
          </Button>
        </div>

        {offers.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            {t.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[0.5rem] border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{offer.name}</span>
                    {offer.isDefault && <StatusBadge value="default" tone="info" text={labels.defaultOffer} />}
                    <StatusBadge
                      value={offer.status}
                      text={offer.archivedWithProduct ? t.archivedWithProduct : labels.status(offer.status)}
                    />
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {offer.pricingMode === "fixed"
                      ? formatMoney(offer.priceAmount, offer.currency)
                      : t.computedPrice}
                    {" · "}
                    {offer.lines.map((l) => `${l.quantity}× ${variantName(l.variantId)}`).join(", ")}
                  </div>
                </div>
                <div className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(offer)}>
                    {t.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setDeleting(offer)}
                  >
                    {t.delete}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.createTitle}>
        <OfferForm
          productId={productId}
          variants={variants}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            toast.success(t.createdToast);
            onChanged();
          }}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t.editTitle}>
        {editing && (
          <OfferForm
            productId={productId}
            variants={variants}
            offer={editing}
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
        title={fmt(t.deleteTitle, { name: deleting?.name ?? "" })}
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
