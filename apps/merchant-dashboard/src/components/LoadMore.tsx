import { Button, Spinner } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loadMore: "Load more", loading: "Loading…" },
  ar: { loadMore: "عرض المزيد", loading: "جارٍ التحميل…" },
} satisfies Messages;

interface LoadMoreProps {
  /** Truthy when there's another page (the cursor). */
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}

/** Cursor pagination control — matches the backend's cursor pattern, no page numbers. */
export function LoadMore({ hasMore, loading, onClick }: LoadMoreProps) {
  const t = useT(STRINGS);
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" onClick={onClick} disabled={loading} className="min-h-11">
        {loading ? <Spinner className="size-4" aria-label={t.loading} /> : t.loadMore}
      </Button>
    </div>
  );
}
