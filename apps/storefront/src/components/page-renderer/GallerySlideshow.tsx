"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowIcon, PauseIcon, PlayIcon } from "@/components/Icons";
import { skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { StoreImage } from "@/components/StoreImage";

/** How long each slide holds before the next one takes over. */
const AUTOPLAY_MS = 5000;

// Read through `useSyncExternalStore`, the same way `ThemeToggle` reads the
// `.dark` class: it is the one hook built for "subscribe to something outside
// React", so there's no setState-in-effect on mount and no server/client
// mismatch — the SSR snapshot below is a stable, motion-safe default, and the
// real value takes over the moment the browser can answer either question.
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getReducedMotionServerSnapshot = () => true;

function subscribeTabVisible(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const getTabVisible = () => document.visibilityState === "visible";
const getTabVisibleServerSnapshot = () => false;

/**
 * The `gallery` element's `layout: "slideshow"` mode — a full-bleed,
 * autoplaying carousel instead of the grid `GalleryElement` draws by default.
 *
 * Autoplay is gated by three things, all of which must hold:
 *  - the visitor hasn't asked for reduced motion (checked once on mount and
 *    kept in sync with the OS setting);
 *  - the browser tab is the visible one (`document.visibilityState`);
 *  - the slideshow itself is at least partly on screen (`IntersectionObserver`).
 * Any of those failing pauses the timer without touching `playing`, so the
 * pause/play button always reflects the visitor's own choice, not a state the
 * slideshow picked for them — and under reduced motion the button, the
 * arrows and the dots stay fully usable, just with nothing moving on its own.
 *
 * "Full-bleed" here means edge-to-edge *within whatever column or section
 * holds it* — no border, no rounding, no side padding, unlike a grid tile.
 * A merchant who wants it to run under the page's own side margins too sets
 * the section's existing "Full width" setting; the slideshow doesn't fight
 * that by reaching for viewport-width CSS of its own.
 */
export function GallerySlideshow({ images, title }: { images: string[]; title: string }) {
  const { t, dir } = useStore();
  const many = images.length > 1;
  const forward = dir === "rtl" ? -1 : 1;

  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [onScreen, setOnScreen] = useState(true);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServerSnapshot
  );
  const tabVisible = useSyncExternalStore(subscribeTabVisible, getTabVisible, getTabVisibleServerSnapshot);

  const rootRef = useRef<HTMLDivElement>(null);

  const step = (delta: number) => setActive((i) => (i + delta + images.length) % images.length);
  const markLoaded = (i: number) =>
    setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.3,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const autoplay = many && playing && !reducedMotion && tabVisible && onScreen;

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => step(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `step` closes over `images.length`, not `active`; re-running per tick would restart the interval on every slide.
  }, [autoplay, images.length]);

  if (images.length === 0) return null;

  return (
    <div ref={rootRef} className="relative aspect-[4/5] w-full overflow-hidden bg-paper sm:aspect-[16/7]">
      {images.map((src, i) => (
        <div
          key={`${src}-${i}`}
          aria-hidden={i !== active}
          className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
            i === active ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {!loaded.has(i) && <span aria-hidden className={`absolute inset-0 ${skeleton}`} />}
          <StoreImage
            src={src}
            alt={title || ""}
            width={1600}
            height={900}
            sizes="100vw"
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => markLoaded(i)}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {title.trim() && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent px-4 pb-14 pt-16 sm:px-8 sm:pb-16"
        >
          <h3 className="text-xl font-bold text-white sm:text-3xl">{title}</h3>
        </div>
      )}

      {many && (
        <>
          <button
            type="button"
            aria-label={t.shop.previousSlide}
            onClick={() => step(-forward)}
            className="absolute inset-y-0 start-2 z-10 flex items-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-raised/90 text-ink shadow-sm backdrop-blur transition-colors hover:text-primary sm:h-10 sm:w-10">
              <ArrowIcon className="rotate-180 rtl:rotate-0" />
            </span>
          </button>
          <button
            type="button"
            aria-label={t.shop.nextSlide}
            onClick={() => step(forward)}
            className="absolute inset-y-0 end-2 z-10 flex items-center"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-raised/90 text-ink shadow-sm backdrop-blur transition-colors hover:text-primary sm:h-10 sm:w-10">
              <ArrowIcon className="rtl:rotate-180" />
            </span>
          </button>

          {/* Progress bars, one per slide — the active one fills over the
              autoplay interval; `key={active}` restarts its animation each
              time the slide changes instead of jumping straight to full. */}
          <div className="absolute inset-x-3 top-3 z-10 flex gap-1.5 sm:inset-x-4 sm:top-4">
            {images.map((_, i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
                {i === active && (
                  <span
                    key={active}
                    className="zimos-slide-progress-fill block h-full w-full rounded-full bg-white"
                    style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: autoplay ? "running" : "paused" }}
                  />
                )}
                {i < active && <span className="block h-full w-full rounded-full bg-white" />}
              </span>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-3 sm:bottom-4">
            <div className="flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={t.shop.goToSlide(i + 1)}
                  aria-current={i === active}
                  onClick={() => setActive(i)}
                  className={`h-2 w-2 rounded-full transition-[width,background-color] ${
                    i === active ? "w-5 bg-white" : "bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label={playing ? t.shop.pauseSlideshow : t.shop.playSlideshow}
              onClick={() => setPlaying((p) => !p)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
            >
              {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
