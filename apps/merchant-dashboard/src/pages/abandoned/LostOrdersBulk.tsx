import { useCallback, useMemo, useState } from "react";
import { lostOrdersBulkDelete, type LostOrder } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconDelete } from "@/components/icons";
import { BulkBar } from "@/components/list";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useLast } from "./lostOrderModel";

const STRINGS = {
  en: {
    selected_one: "{n} order selected",
    selected_two: "{n} orders selected",
    selected_few: "{n} orders selected",
    selected_many: "{n} orders selected",
    selected_other: "{n} orders selected",
    selectAll_one: "Select the one order shown",
    selectAll_two: "Select both orders shown",
    selectAll_few: "Select all {n} shown",
    selectAll_many: "Select all {n} shown",
    selectAll_other: "Select all {n} shown",
    allSelected: "Everything shown is selected.",
    pick: "Tick the orders you want.",
    done: "Done",
    remove: "Delete",
    removeTitle_one: "Delete this lost order?",
    removeTitle_two: "Delete these {n} lost orders?",
    removeTitle_few: "Delete {n} lost orders?",
    removeTitle_many: "Delete {n} lost orders?",
    removeTitle_other: "Delete {n} lost orders?",
    removeBody: "They are removed for good and their recovery links stop working. Lost orders that became orders are kept.",
    cancel: "Cancel",
    working: "Deleting…",
    removed_zero: "Nothing was deleted.",
    removed_one: "{n} lost order deleted.",
    removed_two: "{n} lost orders deleted.",
    removed_few: "{n} lost orders deleted.",
    removed_many: "{n} lost orders deleted.",
    removed_other: "{n} lost orders deleted.",
    skipped_one: "{n} was kept: it became an order.",
    skipped_two: "{n} were kept: they became orders.",
    skipped_few: "{n} were kept: they became orders.",
    skipped_many: "{n} were kept: they became orders.",
    skipped_other: "{n} were kept: they became orders.",
    product: "Product",
    anyProduct: "Any product",
  },
  ar: {
    selected_one: "طلب واحد محدد",
    selected_two: "طلبان محددان",
    selected_few: "{n} طلبات محددة",
    selected_many: "{n} طلبًا محددًا",
    selected_other: "{n} طلب محدد",
    selectAll_one: "تحديد الطلب المعروض",
    selectAll_two: "تحديد الطلبين المعروضين",
    selectAll_few: "تحديد كل الـ{n} المعروضة",
    selectAll_many: "تحديد كل الـ{n} المعروضة",
    selectAll_other: "تحديد كل الـ{n} المعروضة",
    allSelected: "كل المعروض محدد.",
    pick: "حدّد الطلبات التي تريدها.",
    done: "تم",
    remove: "حذف",
    removeTitle_one: "حذف هذا الطلب المفقود؟",
    removeTitle_two: "حذف هذين الطلبين المفقودين؟",
    removeTitle_few: "حذف {n} طلبات مفقودة؟",
    removeTitle_many: "حذف {n} طلبًا مفقودًا؟",
    removeTitle_other: "حذف {n} طلب مفقود؟",
    removeBody: "تُحذف نهائيًا. الطلبات المفقودة التي تحوّلت إلى طلبات تبقى.",
    cancel: "إلغاء",
    working: "جارٍ الحذف…",
    removed_zero: "لم يُحذف شيء.",
    removed_one: "تم حذف طلب مفقود واحد.",
    removed_two: "تم حذف طلبين مفقودين.",
    removed_few: "تم حذف {n} طلبات مفقودة.",
    removed_many: "تم حذف {n} طلبًا مفقودًا.",
    removed_other: "تم حذف {n} طلب مفقود.",
    skipped_one: "طلب واحد بقي كما هو: تحوّل إلى طلب.",
    skipped_two: "طلبان بقيا كما هما: تحوّلا إلى طلبين.",
    skipped_few: "{n} بقيت كما هي: تحوّلت إلى طلبات.",
    skipped_many: "{n} بقيت كما هي: تحوّلت إلى طلبات.",
    skipped_other: "{n} بقيت كما هي: تحوّلت إلى طلبات.",
    product: "المنتج",
    anyProduct: "أي منتج",
  },
} satisfies Messages;

export interface LostOrderSelection {
  /** The ticked lost orders that are on screen now: a row hidden by the search or a filter is never acted on. */
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string, on: boolean) => void;
  /** Every row on screen is ticked. */
  allOn: boolean;
  /** How many rows are on screen. */
  shown: number;
  selectAll: () => void;
  clear: () => void;
}

/** The ticked lost orders, over the rows the list is showing. */
export function useLostOrderSelection(rows: readonly LostOrder[]): LostOrderSelection {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set<string>());
  const ids = useMemo(() => rows.filter((row) => picked.has(row.id)).map((row) => row.id), [rows, picked]);
  const toggle = useCallback((id: string, on: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setPicked(new Set<string>()), []);
  return {
    ids,
    has: (id) => picked.has(id),
    toggle,
    allOn: rows.length > 0 && ids.length === rows.length,
    shown: rows.length,
    selectAll: () => setPicked(new Set(rows.map((row) => row.id))),
    clear,
  };
}

/**
 * The bar that rises while lost orders are ticked: how many, «امسح» (the one
 * bulk endpoint there is: POST /checkout-sessions/bulk-delete), and on its
 * second line "select all shown" — which is how a phone, with no table head,
 * reaches select-all. Deleting asks once and names what is lost.
 *
 * Not gated by role here, as before: the server decides who may delete.
 */
export function LostOrdersBulkBar({
  selection,
  onClear,
  onDone,
}: {
  selection: LostOrderSelection;
  /** Lets go of the selection (and, on a phone, of selecting). */
  onClear: () => void;
  /** After a delete: the list and the stats are read again. */
  onDone: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // How many were ticked when the question was asked; kept while the dialog closes.
  const [asking, setAsking] = useState<number | null>(null);
  const asked = useLast(asking) ?? 0;
  const [busy, setBusy] = useState(false);
  const count = selection.ids.length;

  async function remove() {
    setBusy(true);
    try {
      const result = await lostOrdersBulkDelete(apiClient, workspaceId, selection.ids);
      toast.success(result.deleted === 0 ? t.removed_zero : pluralOf(t, "removed", result.deleted));
      if (result.skipped > 0) toast.success(pluralOf(t, "skipped", result.skipped));
      onClear();
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  return (
    <>
      <BulkBar
        count={count}
        label={pluralOf(t, "selected", count)}
        onClear={onClear}
        busy={busy}
        actions={[{ id: "delete", label: t.remove, icon: IconDelete, destructive: true, onSelect: () => setAsking(count) }]}
        extra={
          selection.allOn ? (
            t.allSelected
          ) : (
            <button
              type="button"
              onClick={selection.selectAll}
              className="inline-flex min-h-8 cursor-pointer items-center rounded-full font-semibold text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-11"
            >
              {pluralOf(t, "selectAll", selection.shown)}
            </button>
          )
        }
      />
      <ConfirmDialog
        open={asking !== null}
        title={pluralOf(t, "removeTitle", asked)}
        description={t.removeBody}
        confirmLabel={t.remove}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setAsking(null)}
        onConfirm={remove}
      />
    </>
  );
}

export interface LostOrderProductOption {
  id: string;
  name: string;
}

/**
 * The products the list can be narrowed to (active and draft, the first 200).
 * Read only once the filter sheet has been opened, and remembered for the
 * session; if it cannot be read the filter simply offers "any product".
 */
export function useLostOrderProducts(enabled: boolean): LostOrderProductOption[] {
  const workspaceId = useWorkspaceId();
  const products = useCachedAsync<LostOrderProductOption[]>(
    enabled ? `lost-orders:products:${workspaceId}` : null,
    async () => {
      if (!enabled) return [];
      const page = await apiClient.listProducts(workspaceId, { status: ["active", "draft"], limit: 200 });
      return page.products.map((product) => ({ id: product.id, name: product.name }));
    },
    [workspaceId, enabled]
  );
  return products.data ?? [];
}

/** The product filter (GET /checkout-sessions?productId=), for the filter sheet. Its group there is its label. */
export function LostOrderProductFilter({
  value,
  onChange,
  products,
}: {
  value: string;
  onChange: (productId: string) => void;
  products: readonly LostOrderProductOption[];
}) {
  const t = useT(STRINGS);
  return (
    <Select aria-label={t.product} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 sm:h-10">
      <option value="">{t.anyProduct}</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name}
        </option>
      ))}
    </Select>
  );
}

/**
 * On a phone, under the tabs while «حدّد» is on and nothing is ticked yet:
 * what to do, "select all shown" one tap away, and the way out. Once a row
 * is ticked the bulk bar takes over (its second line holds the same
 * "select all shown").
 */
export function LostOrdersSelectHint({ selection, onDone }: { selection: LostOrderSelection; onDone: () => void }) {
  const t = useT(STRINGS);
  const LINK =
    "inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-sm font-semibold text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return (
    <div
      role="status"
      data-slot="lost-select-hint"
      className="zimos-lost-hint mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[1.25rem] bg-paper-raised py-1 ps-4 pe-2 text-sm text-ink-soft ring-1 ring-line"
    >
      <span className="min-w-0 flex-1 basis-40 py-2">{t.pick}</span>
      {selection.shown > 0 && (
        <button type="button" onClick={selection.selectAll} className={LINK}>
          {pluralOf(t, "selectAll", selection.shown)}
        </button>
      )}
      <button type="button" onClick={onDone} className={LINK}>
        {t.done}
      </button>
    </div>
  );
}
