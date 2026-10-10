import { useEffect, useState } from "react";
import { ListToolbar } from "@/components/list";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SEARCH_MAX, SEARCH_MIN } from "./useOrdersQuery";

const STRINGS = {
  en: {
    searchLabel: "Search orders",
    searchPlaceholder: "Order #, name, phone or its last 4 digits, waybill",
    searchTooShort: "Type at least 2 characters to search.",
  },
  ar: {
    searchLabel: "البحث في الطلبات",
    searchPlaceholder: "رقم الطلب، الاسم، الهاتف أو آخر 4 أرقام، رقم البوليصة",
    searchTooShort: "اكتب حرفين على الأقل للبحث.",
  },
} satisfies Messages;

const SEARCH_DEBOUNCE_MS = 300;

/** `value`, once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * The one toolbar of the orders list: the search and the Filters button.
 *
 * The search matches the order number, the customer's name or email, the phone
 * (or just its last 4+ digits) or a courier waybill. What is typed stays here
 * and is drawn at once — the request is what waits (300 ms after the last
 * key), so typing never stutters and only this toolbar re-renders per key.
 * The URL only ever holds a query the API accepts (2+ characters): a single
 * character stays local, with a line saying one more is needed.
 */
export function OrdersToolbar({
  q,
  onSearch,
  filterCount,
  onOpenFilters,
}: {
  /** The search in the URL (`?q=`), already valid or empty. */
  q: string;
  /** Write the search to the URL; null takes it off. */
  onSearch: (next: string | null) => void;
  /** Filters in effect inside the sheet. */
  filterCount: number;
  onOpenFilters: () => void;
}) {
  const t = useT(STRINGS);

  // What's typed, ahead of the debounce.
  const [draft, setDraft] = useState(q);
  // Back/forward, a saved view or a shared link changed the query under us:
  // adopt it, unless it's just what the draft already says.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (draft.trim() !== q) setDraft(q);
  }

  const debounced = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    const next = debounced.length >= SEARCH_MIN ? debounced : "";
    if (next !== q) onSearch(next || null);
    // Only a settled draft should write the URL — not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const typed = draft.trim().length;
  const tooShort = typed > 0 && typed < SEARCH_MIN;

  return (
    <ListToolbar
      search={{
        value: draft,
        onChange: (value) => {
          const next = value.slice(0, SEARCH_MAX);
          setDraft(next);
          // Emptied (the clear button, Escape, or by hand): the list answers at once, not after the wait.
          if (next.trim() === "" && q) onSearch(null);
        },
        placeholder: t.searchPlaceholder,
        label: t.searchLabel,
        hint: tooShort ? t.searchTooShort : undefined,
      }}
      filters={{ count: filterCount, onOpen: onOpenFilters }}
    />
  );
}
