import { useState, type ReactNode } from "react";
import type { OrderListParams } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";

const STRINGS = {
  en: {
    selectShown: "Select all {orders} shown",
    shownSelected: "All {orders} shown are selected.",
    selectAll: "Select all {orders} in this list",
    selectFirst: "Select the first {max} of {total} in this list",
    selectAllUnknown: "Select every order in this list",
    loading: "Selecting…",
    allSelected: "All {orders} in this list are selected.",
    capped: "A bulk action takes up to {max} orders at a time: the first {count} are selected.",
  },
  ar: {
    selectShown: "تحديد كل المعروض ({orders})",
    shownSelected: "كل المعروض محدد ({orders}).",
    selectAll: "تحديد كل ما في القائمة ({orders})",
    selectFirst: "تحديد أول {max} من {total} في القائمة",
    selectAllUnknown: "حدّد كل الطلبات في القائمة",
    loading: "جارٍ التحديد…",
    allSelected: "كل ما في القائمة محدد ({orders}).",
    capped: "يأخذ الإجراء الجماعي {max} طلبًا كحد أقصى في المرة الواحدة: حُدّد أول {count}.",
  },
} satisfies Messages;

/** The most orders one bulk action takes (POST /orders/bulk). */
const MAX = 500;

/** A quiet action inside the bulk bar's second line: words in the brand colour, 44px under a finger. */
const LINK =
  "inline-flex min-h-8 cursor-pointer items-center rounded-full font-semibold text-primary-dark underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 pointer-coarse:min-h-11 dark:text-primary";

/**
 * The second line of the bulk bar: how to take more than was ticked by hand.
 *
 *  - some of the rows on screen are ticked → "select all N shown" (on a phone
 *    this is the way to select everything: cards have no header checkbox);
 *  - every row on screen is ticked and the list has more → "select all {total}
 *    in this list": fetched from the list
 *    itself, in its order, 200 at a time up to the bulk limit of 500;
 *  - afterwards it says how many that was, or that the limit cut it short.
 *
 * Returns null when there is nothing to offer, so the bar keeps to one line.
 */
export function useSelectMatching({
  params,
  shownIds,
  selected,
  hasMore,
  total,
  onSelect,
}: {
  /** The list's own query: stage, sort, search and filters. */
  params: OrderListParams;
  /** The orders on screen, in order. */
  shownIds: readonly string[];
  selected: ReadonlySet<string>;
  hasMore: boolean;
  /** How many orders the list holds, when the counts are in. */
  total: number | undefined;
  onSelect: (ids: string[]) => void;
}): ReactNode {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How many "select all" ticked: the message stays only while the selection is that one.
  const [matched, setMatched] = useState<number | null>(null);

  const shownCount = shownIds.length;
  const selectedCount = selected.size;
  if (selectedCount === 0) return null;

  const allShownSelected = shownCount > 0 && shownIds.every((id) => selected.has(id));
  const showingAll = matched !== null && matched === selectedCount && selectedCount > shownCount;

  async function selectAll() {
    setBusy(true);
    setError(null);
    try {
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await apiClient.listOrders(workspaceId, { ...params, cursor, limit: 200 });
        ids.push(...page.orders.map((o) => o.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor && ids.length < MAX);
      const chosen = [...new Set(ids)].slice(0, MAX);
      setMatched(chosen.length);
      onSelect(chosen);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  let line: ReactNode = null;
  if (showingAll) {
    const capped = total !== undefined && total > selectedCount;
    line = <span>{capped ? fmt(t.capped, { max: MAX, count: selectedCount }) : fmt(t.allSelected, { orders: countOf("order", selectedCount) })}</span>;
  } else if (!allShownSelected) {
    line = (
      <button type="button" className={LINK} onClick={() => onSelect([...shownIds])}>
        {fmt(t.selectShown, { orders: countOf("order", shownCount) })}
      </button>
    );
  } else if (hasMore) {
    line = (
      <>
        <span>{fmt(t.shownSelected, { orders: countOf("order", shownCount) })}</span>
        <button type="button" className={LINK} onClick={() => void selectAll()} disabled={busy}>
          {busy
            ? t.loading
            : total === undefined
              ? t.selectAllUnknown
              : total > MAX
                ? fmt(t.selectFirst, { max: MAX, total })
                : fmt(t.selectAll, { orders: countOf("order", total) })}
        </button>
      </>
    );
  }

  if (line === null && !error) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5" role="status">
      {line}
      {error && (
        <span className="text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
