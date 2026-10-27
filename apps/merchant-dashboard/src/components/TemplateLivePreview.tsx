import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import type { PageTree } from "@store-builder/api-client";
import { cn, ZLoader } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import type { ColorMode, PreviewTheme } from "@/lib/previewBridge";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import {
  CARD_MARGIN,
  SETTLE_MS,
  ensureFreshSession,
  loadTemplatePreview,
  previewQueue,
  previewTokenFor,
  type TemplatePreviewData,
} from "@/lib/templatePreview";

/** Widths the storefront is laid out at before being scaled into the box. */
const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;
/** A render that hasn't loaded by then gives its slot up and shows the placeholder. */
const LOAD_TIMEOUT_MS = 25_000;
/** How far a card is from the middle of the screen, for the order the waiting cards load in (nearest first). */
function distanceFromView(el: HTMLElement | null): number {
  if (!el) return Number.POSITIVE_INFINITY;
  const rect = el.getBoundingClientRect();
  return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

type Outcome = "ready" | "failed";

/**
 * A template's home page as the storefront really renders it — same route and
 * same components as the editor's StorefrontPreview (the tree is posted as a
 * form into a named iframe; see that component for why), but read-only and
 * scaled down to fit the box.
 *
 * `variant="card"` is the gallery thumbnail: nothing is fetched or posted until
 * the card has been on the screen (or within CARD_MARGIN of it) for
 * SETTLE_MS — a card scrolled past quickly is never loaded — renders wait
 * their turn in `previewQueue` so only a couple load at once, nearest the
 * middle of the screen first, and the frame takes no pointer or keyboard
 * input. Until its frame has loaded the card shows `fallback`, in the box's
 * own shape, and the frame fades in over it only then. `variant="full"` is the large preview in the
 * modal: it loads straight away, can be scrolled, and switches between a
 * desktop and a phone-width layout without re-posting.
 *
 * `fallback` (the gallery's placeholder) shows while the render loads and
 * stays if it can't be had: the template has no home tree, the fetch failed,
 * or the frame never loaded.
 *
 * Commerce blocks pull the merchant's own catalogue, so a store without
 * products shows the template's other sections only — the storefront drops
 * product blocks that have nothing to list.
 *
 * The theme gallery uses the same frame for a page it builds itself: `page`
 * replaces the template's home tree, and `theme` / `colorMode` render it in
 * an unsaved store theme and in light or dark (a new value re-renders).
 *
 * A template may bring a look of its own in its styles. `themeFrom` is handed
 * the look the caller asked for (none included) and those styles, and returns
 * the look to draw; it is only called for a template this component fetched
 * itself, and the page is posted once, with the answer.
 *
 * A card is a 4:3 window onto the desktop layout unless told otherwise:
 * `aspect="3/4"` makes it a portrait box (the templates grid, the site's
 * thumbnail) and `cardLayout="mobile"` lays the page out at a phone's width
 * inside it, so what shows is the top of the store as a shopper's phone has it.
 */
export function TemplateLivePreview({
  workspaceId,
  templateId,
  page,
  theme = null,
  themeFrom,
  colorMode = null,
  title,
  fallback,
  variant = "card",
  device = "desktop",
  aspect = "4/3",
  cardLayout = "desktop",
  className,
}: {
  workspaceId: string;
  /** The template whose home page to show, or — with `page` — just the key its preview slot is kept under. */
  templateId: string;
  /** A page tree to show instead of the template's own. */
  page?: PageTree | null;
  /** An unsaved store look, as the editor sends it (the storefront validates it). */
  theme?: PreviewTheme | null;
  /** The look to draw, given the one asked for and the fetched template's styles. A function that never changes. */
  themeFrom?: (theme: PreviewTheme | null, globalStyles: Record<string, unknown>) => PreviewTheme | null;
  colorMode?: ColorMode | null;
  /** Names the frame for screen readers (full variant only; the card's frame is decorative). */
  title: string;
  fallback: ReactNode;
  variant?: "card" | "full";
  device?: "desktop" | "mobile";
  /** The card's box (card variant only): landscape as before, portrait, or the wider landscape of the website gallery's desktop cards. */
  aspect?: "4/3" | "3/4" | "16/10";
  /** The viewport a card lays the page out at (card variant only). The full variant follows `device`. */
  cardLayout?: "desktop" | "mobile";
  className?: string;
}) {
  const card = variant === "card";
  const frameName = `template-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const posted = useRef(false);
  const token = previewTokenFor(workspaceId, templateId);
  const { width, height } = useElementSize(rootRef);

  // Without IntersectionObserver there is no "near the viewport": load now.
  const [inView, setInView] = useState(() => !card || typeof IntersectionObserver === "undefined");
  const [loaded, setLoaded] = useState<TemplatePreviewData | null>(null);
  // A page handed in is the tree as it is — there is no template to fetch.
  const tree = page !== undefined ? page : (loaded?.home ?? null);
  const [granted, setGranted] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // The large preview skips the queue; a card waits for its turn.
  const slot = card ? granted : tree !== null;
  const phase = page === null ? "failed" : (outcome ?? (slot ? "loading" : "idle"));

  // A card counts as in view once it has stayed on the screen (or just off it) for SETTLE_MS; leaving it counts at once.
  useEffect(() => {
    if (!card) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let settle: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        window.clearTimeout(settle);
        if (entries.some((e) => e.isIntersecting)) settle = window.setTimeout(() => setInView(true), SETTLE_MS);
        else setInView(false);
      },
      { rootMargin: CARD_MARGIN }
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
    };
  }, [card]);

  useEffect(() => {
    if (page !== undefined || !inView || loaded || outcome === "failed") return;
    let cancelled = false;
    loadTemplatePreview(templateId).then(
      (preview) => {
        if (cancelled) return;
        if (preview.home) setLoaded(preview);
        else setOutcome("failed");
      },
      () => {
        if (!cancelled) setOutcome("failed");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [page, inView, loaded, outcome, templateId]);

  // Wait for a render slot. A card that scrolls away before its turn leaves
  // the queue, so the ones on screen go first, the nearest the middle of the
  // screen before the rest; once started, it finishes.
  useEffect(() => {
    if (!card || !tree || granted || !inView) return;
    const cancel = previewQueue.request(
      (release) => {
        releaseRef.current = release;
        setGranted(true);
      },
      () => distanceFromView(rootRef.current)
    );
    return () => {
      if (!releaseRef.current) cancel();
    };
  }, [tree, granted, inView, card]);

  // Never hold a slot past unmount.
  useEffect(() => () => releaseRef.current?.(), []);

  // The frame and form mount with the slot; post into them (again, whenever
  // the look to render it in changes).
  // The tree and the styles arrive together, so the look is settled before the first post.
  const drawn = themeFrom && loaded ? themeFrom(theme, loaded.globalStyles) : theme;
  const themeJson = drawn ? JSON.stringify(drawn) : "";
  useEffect(() => {
    if (!slot || !tree) return;
    let cancelled = false;
    void ensureFreshSession().then(() => {
      const form = formRef.current;
      if (cancelled || !form) return;
      (form.elements.namedItem("tree") as HTMLInputElement).value = JSON.stringify(tree);
      (form.elements.namedItem("accessToken") as HTMLInputElement).value =
        apiClient.tokens.accessToken ?? "";
      (form.elements.namedItem("theme") as HTMLInputElement).value = themeJson;
      (form.elements.namedItem("colorMode") as HTMLInputElement).value = colorMode ?? "";
      posted.current = true;
      form.submit();
    });
    const timer = window.setTimeout(() => {
      setOutcome((o) => o ?? "failed");
      releaseRef.current?.();
    }, LOAD_TIMEOUT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slot, tree, themeJson, colorMode]);

  function onFrameLoad(e: SyntheticEvent<HTMLIFrameElement>) {
    // An empty iframe fires a load for its initial blank document too — some
    // browsers only after the post has gone out. The storefront's page is
    // cross-origin (reading its address throws) or at least not about:blank.
    if (!posted.current) return;
    try {
      if (e.currentTarget.contentWindow?.location.href === "about:blank") return;
    } catch {
      // Cross-origin: the storefront has answered.
    }
    // The load event comes before the store has painted its first section (it streams in), and a card would
    // flash white: the poster stays a moment longer, then the render fades in over it.
    releaseRef.current?.();
    window.setTimeout(() => setOutcome((o) => o ?? "ready"), card ? 900 : 0);
  }

  // Lay the page out at a real viewport width, then scale it into the box.
  const layoutWidth = (card ? cardLayout : device) === "mobile" ? MOBILE_WIDTH : DESKTOP_WIDTH;
  // A card always fills its box (it may be wider than a phone's layout); the large preview never grows past life size.
  const fit = width > 0 ? width / layoutWidth : 0.25;
  const scale = card && cardLayout === "mobile" ? fit : Math.min(1, fit);
  const portrait = aspect === "3/4";
  const wide = aspect === "16/10";
  const cardHeight = portrait ? (layoutWidth * 4) / 3 : wide ? (layoutWidth * 10) / 16 : (layoutWidth * 3) / 4;
  const layoutHeight = card ? cardHeight : height > 0 ? height / scale : 800;
  const showFrame = slot && phase !== "failed";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full overflow-hidden bg-paper",
        card ? (portrait ? "aspect-[3/4]" : wide ? "aspect-[16/10]" : "aspect-[4/3]") : "h-full",
        className
      )}
    >
      {phase !== "ready" && (
        <div className={cn("absolute inset-0", !card && phase !== "failed" && "motion-safe:animate-pulse")}>
          {fallback}
        </div>
      )}
      {!card && phase === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
          <ZLoader />
        </div>
      )}

      {showFrame && (
        <div
          className="relative mx-auto h-full overflow-hidden"
          style={{ width: card ? "100%" : layoutWidth * scale }}
        >
          <iframe
            name={frameName}
            title={title}
            onLoad={onFrameLoad}
            tabIndex={card ? -1 : undefined}
            aria-hidden={card || undefined}
            className={cn(
              "absolute top-0 start-0 origin-top-left border-0 bg-paper-raised transition-opacity duration-200 rtl:origin-top-right",
              card && "pointer-events-none",
              phase === "ready" ? "opacity-100" : "opacity-0"
            )}
            style={{ width: layoutWidth, height: layoutHeight, transform: `scale(${scale})` }}
          />
          <form
            ref={formRef}
            method="post"
            action={`${STOREFRONT_URL}/store/${workspaceId}/preview`}
            target={frameName}
            className="hidden"
          >
            <input type="hidden" name="tree" />
            <input type="hidden" name="accessToken" />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="theme" />
            <input type="hidden" name="colorMode" />
          </form>
        </div>
      )}

      {card && phase === "ready" && (
        // Ends the cropped page softly instead of mid-section.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-paper-raised to-transparent" />
      )}
    </div>
  );
}
