import type { CSSProperties } from "react";
import { cn } from "@store-builder/ui";
import { IconCart, IconSearch } from "@/components/icons";

/**
 * Stands in for a template while its live render loads (or when none can be
 * had): a small storefront drawn in the template's OWN colour with its own
 * name as the headline — a header, an opening block, a row of products — so
 * every card in the gallery is its own store from the first paint instead of
 * the same grey sketch. Decorative: the card's text already names the
 * template. Fills the box it is given.
 *
 * `color` is the template's primary colour (any CSS colour); without it the
 * dashboard's brand colour is used. `title` is the template's name.
 * `label` adds a strip of words along the bottom, for the large preview, where
 * a render that never arrives should say so.
 */
export function TemplatePlaceholder({
  label,
  className,
  color,
  title,
}: {
  label?: string;
  className?: string;
  color?: string | null;
  title?: string;
}) {
  const tint = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "var(--color-primary)";
  const style = { "--tpl": tint } as CSSProperties;
  return (
    <div aria-hidden={label ? undefined : true} style={style} className={cn("relative flex h-full w-full flex-col overflow-hidden bg-white text-[#1b1d22]", className)}>
      {/* the store's bar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-black/8 px-2.5 py-2">
        <span className="size-2.5 rounded-[3px] bg-[var(--tpl)]" />
        <span className="h-1.5 w-9 rounded-full bg-black/55" />
        <IconSearch className="ms-auto size-3 text-black/45" />
        <IconCart className="size-3 text-black/45" />
      </div>
      {/* the opening block, in the template's colour */}
      <div
        className="flex flex-[1.35] flex-col items-start justify-end gap-1.5 p-3 text-white"
        style={{ backgroundImage: "linear-gradient(155deg, color-mix(in srgb, var(--tpl) 82%, #fff) 0%, var(--tpl) 55%, color-mix(in srgb, var(--tpl) 78%, #000) 100%)" }}
      >
        {title ? (
          <span className="line-clamp-2 text-[13px] leading-[1.25] font-bold [text-wrap:balance]">{title}</span>
        ) : (
          <span className="block h-2 w-3/4 rounded-full bg-white/85" />
        )}
        <span className="block h-1.5 w-2/3 rounded-full bg-white/55" />
        <span className="mt-1 block h-4 w-14 rounded-full bg-white" />
      </div>
      {/* two products */}
      <div className="grid flex-1 grid-cols-2 gap-2 p-2.5">
        {[0, 1].map((i) => (
          <span key={i} className="flex min-h-0 flex-col gap-1">
            <span className="min-h-0 flex-1 rounded-md" style={{ backgroundColor: "color-mix(in srgb, var(--tpl) 14%, #f3f4f6)" }} />
            <span className="h-1.5 w-4/5 rounded-full bg-black/35" />
            <span className="h-1.5 w-2/5 rounded-full bg-[var(--tpl)]" />
          </span>
        ))}
      </div>
      {label && (
        <span className="absolute inset-x-0 bottom-0 bg-white/92 px-2 py-1.5 text-center text-xs font-medium text-[#555b66]">{label}</span>
      )}
    </div>
  );
}
