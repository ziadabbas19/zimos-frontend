import type { ShoppableImage } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconEyeOff } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";

const STRINGS = {
  en: {
    open: "Edit “{title}”",
    menuLabel: "Actions for “{title}”",
    hidden: "Hidden",
    noPoints: "No products marked yet",
  },
  ar: {
    open: "تعديل «{title}»",
    menuLabel: "إجراءات «{title}»",
    hidden: "مخفية",
    noPoints: "لا توجد منتجات محددة بعد",
  },
} satisfies Messages;

/**
 * One shoppable image in the gallery: the picture with its points drawn where
 * they are, its title and how many products it marks. The whole card opens the
 * editor (Enter too); «…» on it — and a right-click or a long press — holds
 * the rest: the public link, the ID for the page builder, show / hide, delete.
 */
export function LookCard({ image, menu, busy, onOpen }: { image: ShoppableImage; menu: ContextMenuItem[]; busy: boolean; onOpen: () => void }) {
  const t = useT(STRINGS);
  const points = image.hotspots.length;
  return (
    <li>
      <ContextMenu items={menu} label={fmt(t.menuLabel, { title: image.title })}>
        <article
          data-slot="look-card"
          data-hidden={image.isActive ? undefined : ""}
          aria-busy={busy || undefined}
          className="zimos-look-card relative flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-paper-raised text-ink shadow-[var(--shadow-card)] ring-1 ring-line transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-safe:has-[[data-row-open]:active]:scale-[0.985] motion-reduce:transition-none"
        >
          {/* One big target laid over the card, first so Tab meets it before «…» — which is drawn above it and stays its own stop. */}
          <button
            type="button"
            data-row-open=""
            aria-haspopup="dialog"
            aria-label={fmt(t.open, { title: image.title })}
            onClick={onOpen}
            className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          />

          {/* The picture is laid out left-to-right in every language: a point's x is measured from its left edge. */}
          <div dir="ltr" className="relative aspect-[4/3] overflow-hidden bg-paper-sunken">
            <img src={image.imageUrl} alt="" loading="lazy" className={image.isActive ? "size-full object-cover" : "size-full object-cover opacity-60"} />
            {image.hotspots.map((point, index) => (
              <span
                key={index}
                aria-hidden
                className="zimos-look-dot pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_1px_4px_rgb(0_0_0/0.45)]"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ))}
            {!image.isActive && (
              <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white">
                <IconEyeOff className="size-3.5" aria-hidden />
                {t.hidden}
              </span>
            )}
          </div>

          <div className="flex items-start gap-1 py-2.5 ps-3.5 pe-1.5">
            <div className="min-w-0 flex-1 py-0.5">
              <h2 dir="auto" className="truncate text-sm leading-5 font-semibold text-ink">
                {image.title}
              </h2>
              <p className={points > 0 ? "truncate text-xs leading-5 text-ink-soft" : "truncate text-xs leading-5 font-medium text-accent-dark"}>
                {points > 0 ? countOf("item", points) : t.noPoints}
              </p>
            </div>
            <ItemMenu items={menu} label={fmt(t.menuLabel, { title: image.title })} className="z-10" />
          </div>

        </article>
      </ContextMenu>
    </li>
  );
}
