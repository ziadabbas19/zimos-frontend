import { useMemo, useState } from "react";
import { Button, Card, CardContent, Spinner } from "@store-builder/ui";
import type { CollectionSummary } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    title: "Collections",
    description: "Storefront groupings this product appears in.",
    none: "Not in any collection yet.",
    removeFrom: "Remove from {name}",
    noCollections: "No collections exist yet — create one on the Collections page.",
    inAll: "In every collection already.",
    pick: "Add to a collection…",
    add: "Add",
    addedToast: "Added to collection.",
    removedToast: "Removed from collection.",
  },
  ar: {
    title: "المجموعات",
    description: "مجموعات المتجر التي يظهر فيها هذا المنتج.",
    none: "ليس ضمن أي مجموعة بعد.",
    removeFrom: "إزالة من {name}",
    noCollections: "لا توجد مجموعات بعد — أنشئ واحدة من صفحة المجموعات.",
    inAll: "موجود في كل المجموعات بالفعل.",
    pick: "أضف إلى مجموعة…",
    add: "إضافة",
    addedToast: "تمت الإضافة إلى المجموعة.",
    removedToast: "تمت الإزالة من المجموعة.",
  },
} satisfies Messages;

interface Props {
  productId: string;
  /** Collections the product currently belongs to (from product detail). */
  memberships: CollectionSummary[];
  onChanged: () => void;
}

export function ProductCollectionsSection({ productId, memberships, onChanged }: Props) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const all = useAsync(() => apiClient.listCollections(workspaceId), [workspaceId]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => new Set(memberships.map((c) => c.id)), [memberships]);
  const available = (all.data ?? []).filter((c) => !memberIds.has(c.id));

  async function add() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      await apiClient.addProductToCollection(workspaceId, productId, pick);
      toast.success(t.addedToast);
      setPick("");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(collectionId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiClient.removeProductFromCollection(workspaceId, productId, collectionId);
      toast.success(t.removedToast);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="text-sm text-ink-soft">{t.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {memberships.length === 0 && (
            <span className="text-sm text-ink-soft">{t.none}</span>
          )}
          {memberships.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-sm text-ink"
            >
              {c.name}
              <button
                onClick={() => remove(c.id)}
                disabled={busy}
                className="cursor-pointer text-ink-soft hover:text-danger"
                aria-label={fmt(t.removeFrom, { name: c.name })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {all.loading ? (
            <Spinner className="size-4" />
          ) : all.error ? (
            <span className="text-sm text-danger">{errorMessage(all.error)}</span>
          ) : available.length === 0 ? (
            <span className="text-sm text-ink-soft">
              {(all.data ?? []).length === 0
                ? t.noCollections
                : t.inAll}
            </span>
          ) : (
            <>
              <Select value={pick} onChange={(e) => setPick(e.target.value)} className="max-w-xs">
                <option value="">{t.pick}</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={add} disabled={!pick || busy}>
                {t.add}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
