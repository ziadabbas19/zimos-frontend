import { Button, Spinner } from "@store-builder/ui";

interface LoadMoreProps {
  /** Truthy when there's another page (the cursor). */
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}

/** Cursor pagination control — matches the backend's cursor pattern, no page numbers. */
export function LoadMore({ hasMore, loading, onClick }: LoadMoreProps) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading ? <Spinner className="size-4" /> : "Load more"}
      </Button>
    </div>
  );
}
