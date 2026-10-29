"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowIcon, CrossIcon } from "@/components/Icons";
import { focusRing, iconBtn } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { swipeStep } from "@/lib/swipe";
import { useDialog } from "@/lib/useDialog";
import { num, safeUrl, str, type Props } from "./props";

/**
 * `story_gallery`: the store's story in pictures, for the About page (backend
 * pages/pageTree.js). Up to STORY_GALLERY_MAX photos from the media library in
 * a grid, each with an optional title (its alt text too) and a few words under
 * it. Their words are translated like every page text, before they get here.
 *
 * A photo opens full size in a lightbox: a modal dialog (lib/useDialog — the
 * focus stays inside, Escape closes it, the focus goes back to the photo that
 * opened it) with the previous and next photos a button, an arrow key or a
 * swipe away. In an RTL store the next photo sits to the left, as in the
 * product gallery.
 *
 * In the editor's preview a click picks the element (and opens that photo's
 * card in the inspector, `data-xs-item`), so the lightbox stays shut there.
 */

/** The most photos one gallery holds (backend STORY_GALLERY_MAX). */
export const STORY_GALLERY_MAX = 24;

const TEXT = {
  en: {
    gallery: "Photos",
    open: (name: string) => `Open the photo larger: ${name}`,
    openNth: (n: number) => `Open photo ${n} larger`,
    close: "Close the photo",
    previous: "Previous photo",
    next: "Next photo",
  },
  ar: {
    gallery: "الصور",
    open: (name: string) => `افتح الصورة أكبر: ${name}`,
    openNth: (n: number) => `افتح الصورة رقم ${n} أكبر`,
    close: "اقفل الصورة",
    previous: "الصورة اللي قبلها",
    next: "الصورة اللي بعدها",
  },
  fr: {
    gallery: "Photos",
    open: (name: string) => `Agrandir la photo : ${name}`,
    openNth: (n: number) => `Agrandir la photo ${n}`,
    close: "Fermer la photo",
    previous: "Photo précédente",
    next: "Photo suivante",
  },
};

export interface StoryPhoto {
  /** Where the photo sits in the element's `items` (the editor's card for it). */
  index: number;
  src: string;
  title: string;
  description: string;
}

/** The photos to show: entries with a usable address only, in their order, at most STORY_GALLERY_MAX. */
export function storyPhotos(props: Props): StoryPhoto[] {
  const raw = Array.isArray(props.items) ? props.items : [];
  const photos: StoryPhoto[] = [];
  raw.forEach((entry, index) => {
    if (photos.length >= STORY_GALLERY_MAX) return;
    const item = entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Props) : {};
    const src = safeUrl(str(item, "src"));
    if (!src) return;
    photos.push({ index, src, title: str(item, "title").trim(), description: str(item, "description").trim() });
  });
  return photos;
}

/** The computer's columns; a small phone shows one, a phone or a tablet two. */
const DESKTOP_COLUMNS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** The photo's box in the grid: one shape for all, so the rows line up whatever the files are. */
const FRAME = "zt-img relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-paper";

export function StoryGalleryElement({ props, editable = false }: { props: Props; editable?: boolean }) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const [open, setOpen] = useState<number | null>(null);
  const photos = storyPhotos(props);
  if (photos.length === 0) return null;

  const title = str(props, "title").trim();
  const columns = num(props, "columns", 3, 2, 4);

  return (
    <div>
      {title && (
        <h2 dir="auto" className="zt-heading mb-5 text-2xl font-bold text-ink sm:text-3xl">
          {title}
        </h2>
      )}
      <ul className={`grid grid-cols-1 gap-x-4 gap-y-6 min-[400px]:grid-cols-2 sm:gap-x-5 ${DESKTOP_COLUMNS[columns]}`}>
        {photos.map((photo, i) => {
          const img = (
            // Merchant media are arbitrary remote URLs, drawn as the gallery and image elements draw them.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              alt={photo.title}
              width={800}
              height={600}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.03]"
            />
          );
          return (
            <li key={`${photo.src}-${photo.index}`}>
              <figure className="flex h-full flex-col gap-3" data-xs-item={editable ? `items.${photo.index}` : undefined}>
                {editable ? (
                  <div className={FRAME}>{img}</div>
                ) : (
                  <button
                    type="button"
                    aria-label={photo.title ? text.open(photo.title) : text.openNth(i + 1)}
                    onClick={(e) => {
                      // Safari does not focus a pressed button; the dialog hands the focus back to it on close.
                      e.currentTarget.focus();
                      setOpen(i);
                    }}
                    className={`${FRAME} group cursor-zoom-in ${focusRing}`}
                  >
                    {img}
                  </button>
                )}
                {(photo.title || photo.description) && (
                  <figcaption className="space-y-1">
                    {photo.title && (
                      <p dir="auto" className="font-semibold text-ink">
                        {photo.title}
                      </p>
                    )}
                    {photo.description && (
                      <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                        {photo.description}
                      </p>
                    )}
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
      {open !== null && !editable && (
        <StoryLightbox photos={photos} start={open} label={title || text.gallery} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function StoryLightbox({
  photos,
  start,
  label,
  onClose,
}: {
  photos: StoryPhoto[];
  start: number;
  label: string;
  onClose: () => void;
}) {
  const { locale, dir } = useStore();
  const text = pickText(TEXT, locale);
  const [index, setIndex] = useState(start);
  const dialogRef = useDialog<HTMLDivElement>({ open: true, onClose });
  const many = photos.length > 1;
  // The next photo sits towards the reading end: on the left in an RTL store.
  const forward = dir === "rtl" ? -1 : 1;

  const step = useCallback((delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length), [photos.length]);

  // The arrow keys go the way they point (lib/useDialog already handles Escape and Tab).
  useEffect(() => {
    if (!many) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(forward);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-forward);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [many, step, forward]);

  // A swipe on a phone; the click that follows the swipe must not close the lightbox.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const photo = photos[index] ?? photos[0];
  if (!photo) return null;

  // Drawn under the store's wrapper, not inside the page: a section may be the containing
  // block of fixed boxes (a transform, a filter), which would pin the lightbox inside it.
  const host = document.querySelector<HTMLElement>(".brand-theme") ?? document.body;
  // Over the photo's edges on a phone, beside it from `sm` (the stage keeps room for them there).
  const side = "pointer-events-none absolute inset-y-0 z-10 flex items-center";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      dir={dir}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-paper/95 p-4 outline-none backdrop-blur-sm sm:p-8"
      // The backdrop is the dialog itself; a press on the photo, its words or a button stops before it gets here.
      onClick={() => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" dir="ltr" className="text-sm tabular-nums text-ink-soft">
          {many ? `${index + 1} / ${photos.length}` : ""}
        </p>
        <button
          type="button"
          data-autofocus
          aria-label={text.close}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={iconBtn}
        >
          <CrossIcon />
        </button>
      </div>

      <div
        className="relative mt-3 flex min-h-0 flex-1 items-center justify-center sm:px-16"
        onPointerDown={(e) => {
          swiped.current = false;
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from || !many) return;
          const delta = swipeStep(from, { x: e.clientX, y: e.clientY }, forward);
          if (delta === null) return;
          swiped.current = true;
          step(delta);
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {many && (
          <span className={`${side} start-0`}>
            <button
              type="button"
              aria-label={text.previous}
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className={`${iconBtn} pointer-events-auto shadow-sm`}
            >
              <ArrowIcon className="rotate-180 rtl:rotate-0" />
            </button>
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- merchant media, as in the grid. */}
        <img
          key={`${photo.src}-${photo.index}`}
          src={photo.src}
          alt={photo.title}
          decoding="async"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full min-h-0 w-auto max-w-full touch-pan-y select-none rounded-2xl object-contain"
        />
        {many && (
          <span className={`${side} end-0`}>
            <button
              type="button"
              aria-label={text.next}
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className={`${iconBtn} pointer-events-auto shadow-sm`}
            >
              <ArrowIcon className="rtl:rotate-180" />
            </button>
          </span>
        )}
      </div>

      {(photo.title || photo.description) && (
        <div className="mx-auto mt-4 w-full max-w-2xl text-center" onClick={(e) => e.stopPropagation()}>
          {photo.title && (
            <p dir="auto" className="text-base font-semibold text-ink sm:text-lg">
              {photo.title}
            </p>
          )}
          {photo.description && (
            <p dir="auto" className="mt-1 max-h-[24vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {photo.description}
            </p>
          )}
        </div>
      )}
    </div>,
    host
  );
}
