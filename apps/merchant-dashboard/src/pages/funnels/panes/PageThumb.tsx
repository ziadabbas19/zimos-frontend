import type { PageTree } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";

/** What each kind of block looks like in the miniature: text grey, pictures tinted, the things a shopper presses solid. */
const TONE: Record<string, string> = {
  heading: "bg-ink/45",
  text: "bg-ink/20",
  rich_text: "bg-ink/20",
  image: "bg-primary/30",
  video: "bg-primary/30",
  button: "bg-primary",
  cod_form: "bg-accent",
  form: "bg-accent",
  product_card: "bg-success/40",
};

/**
 * A miniature of a step's page for the inspector: one line per section (the
 * first five), one bar per block in it. A drawing, not a preview — it only
 * says "this much is on the page".
 */
export function PageThumb({ tree, className }: { tree: PageTree; className?: string }) {
  const rows = tree.sections
    .slice(0, 5)
    .map((section) => (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((col) => (col.elements ?? []).map((el) => String(el.type)))).slice(0, 6));
  return (
    <div
      aria-hidden
      data-slot="funnel-page-thumb"
      className={cn("flex h-20 flex-col justify-center gap-1 overflow-hidden rounded-[0.75rem] border border-line bg-paper px-3 py-2", className)}
    >
      {rows.length === 0 ? (
        <span className="mx-auto h-1.5 w-1/3 rounded-full bg-line" />
      ) : (
        rows.map((types, i) => (
          <div key={i} className="flex min-h-0 flex-1 items-center gap-1">
            {types.length === 0 ? (
              <span className="h-1 w-full rounded-full bg-line" />
            ) : (
              types.map((type, j) => <span key={j} className={cn("h-1.5 flex-1 rounded-full", TONE[type] ?? "bg-ink/15")} />)
            )}
          </div>
        ))
      )}
    </div>
  );
}
