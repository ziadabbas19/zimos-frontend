import { ZLoader } from "@store-builder/ui";

/**
 * The progress bar of a bulk action on products (edit, delete), shown for any
 * number of them. With `done` it fills as the chunks come back; without it the
 * action is one request the server applies all at once, and the bar only
 * shows that it is under way.
 */
export function BulkProgress({ label, done, total }: { label: string; done?: number; total: number }) {
  const value = done === undefined ? undefined : Math.min(done, total);
  return (
    <div className="space-y-2" data-slot="bulk-progress">
      <p role="status" className="flex items-center gap-3 text-sm text-ink">
        <ZLoader size="sm" aria-hidden />
        {label}
      </p>
      <progress className="h-2 w-full accent-primary" aria-label={label} max={Math.max(total, 1)} value={value} />
    </div>
  );
}
