import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { IconChart, IconEye, IconOrders, IconUserAdd } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { PageTree } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { MAP_STRINGS, num, pct } from "./canvas/strings";
import { useFunnelNumbers, type StatsPeriod, type StepNumbers } from "./canvas/useFunnelNumbers";

/**
 * The funnel map's tools: pan and zoom that follow the hand (one finger pans,
 * two pinch; the wheel scrolls, ctrl / cmd + wheel zooms around the pointer),
 * a schematic thumbnail of each step's page, and each step's numbers for a
 * period from the funnel's analytics.
 */

const STRINGS = {
  en: {
    period: "Numbers for",
    days7: "Last 7 days",
    days30: "Last 30 days",
    days90: "Last 90 days",
  },
  ar: {
    period: "الأرقام عن",
    days7: "آخر 7 أيام",
    days30: "آخر 30 يوم",
    days90: "آخر 90 يوم",
  },
} satisfies Messages;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 1.6;
/** The smallest zoom "fit" picks on a phone: below it a card's name cannot be read, so the map pans instead. */
const READABLE_ZOOM = 0.6;
/** Room "fit" leaves around the steps, in screen pixels: beside them, and above and under them for the floating bars. */
const FIT_MARGIN = 24;
const FIT_TOP = 60;
const FIT_BOTTOM = 64;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

type Point = { x: number; y: number };

/** The box the steps take on the map, in map coordinates. */
export interface FlowBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FlowZoom {
  /** The map's scale: 1 = cards at their real size. */
  zoom: number;
  /** A pointer event's place on the map (what a card's x / y are in), whatever the zoom and scroll. */
  toMap: (e: { clientX: number; clientY: number }) => Point;
  /** Spread on the scrolling map box: a drag on its empty ground pans, two fingers pinch. */
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  };
  /** True while the ground is being dragged (the cursor closes its hand). */
  panning: boolean;
  /** True while two fingers are on the map: a card under one of them must not move. */
  isPinching: () => boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Show every step: on a wide box the whole funnel, on a phone its start at a readable size. */
  fit: () => boolean;
  /** Scroll just enough to bring a map rectangle into view. */
  reveal: (box: { x: number; y: number; width: number; height: number }) => void;
}

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Is this press on the map's empty ground (not on a card, an arrow's pill, a dot or a menu)? */
const onGround = (target: EventTarget | null) => target instanceof HTMLElement && target.dataset.flowGround !== undefined;

/**
 * Zoom and pan for the scrolling map box. The box scrolls natively (so the
 * wheel and a trackpad pan it for free); zooming scales its content and then
 * scrolls so the point under the pointer — or between the two fingers — stays
 * where it is. `autoFitKey` (the funnel's id once it has steps) fits the map
 * once, the first time the box has a size.
 */
export function useFlowZoom(containerRef: RefObject<HTMLDivElement | null>, bounds: FlowBounds, autoFitKey: string | null = null): FlowZoom {
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(1);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  /** Where to scroll once the new zoom is on screen. */
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);

  const flushScroll = useCallback(() => {
    const el = containerRef.current;
    const next = pendingScroll.current;
    if (!el || !next) return;
    pendingScroll.current = null;
    el.scrollLeft = Math.max(0, next.left);
    el.scrollTop = Math.max(0, next.top);
  }, [containerRef]);

  // After React has drawn the map at the new scale, never before: the box cannot scroll past its old size.
  useLayoutEffect(flushScroll, [zoom, flushScroll]);

  /** Set the zoom so that the map point `anchor` sits at `at` (pixels from the box's corner). */
  const zoomTo = useCallback(
    (next: number, anchor: Point, at: Point) => {
      const z = clampZoom(next);
      pendingScroll.current = { left: anchor.x * z - at.x, top: anchor.y * z - at.y };
      if (z === zoomRef.current) {
        flushScroll();
        return;
      }
      zoomRef.current = z;
      setZoom(z);
    },
    [flushScroll]
  );

  /** Zoom by a factor, keeping the point at `at` (default: the middle of the box) where it is. */
  const zoomBy = useCallback(
    (factor: number, at?: Point) => {
      const el = containerRef.current;
      if (!el) return;
      const p = at ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
      const z = zoomRef.current;
      zoomTo(z * factor, { x: (el.scrollLeft + p.x) / z, y: (el.scrollTop + p.y) / z }, p);
    },
    [containerRef, zoomTo]
  );

  const toMap = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      return {
        x: (e.clientX - (rect?.left ?? 0) + (el?.scrollLeft ?? 0)) / zoomRef.current,
        y: (e.clientY - (rect?.top ?? 0) + (el?.scrollTop ?? 0)) / zoomRef.current,
      };
    },
    [containerRef]
  );

  // --- the wheel: scroll by default, zoom with ctrl / cmd (a trackpad pinch arrives as ctrl + wheel) ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const at = (e: { clientX: number; clientY: number }): Point => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel: the box scrolls by itself
      e.preventDefault();
      // deltaMode 1 = lines (a mouse wheel in Firefox): about 16px a line.
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.min(1.25, Math.max(0.8, Math.exp(-delta * 0.01))), at(e));
    };
    // Safari's trackpad pinch: its own gesture events, with the scale since the pinch began.
    let gestureStart = 1;
    type GestureEvent = Event & { scale?: number; clientX?: number; clientY?: number };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStart = zoomRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      if (typeof g.scale !== "number" || g.scale <= 0) return;
      const rect = el.getBoundingClientRect();
      const p = { x: (g.clientX ?? rect.left + rect.width / 2) - rect.left, y: (g.clientY ?? rect.top + rect.height / 2) - rect.top };
      zoomBy((gestureStart * g.scale) / zoomRef.current, p);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
    };
    // autoFitKey: the map box only exists once the funnel has steps, so listen again when it appears.
  }, [containerRef, zoomBy, autoFitKey]);

  // --- fingers and the mouse on the ground ---
  /** Every touch now on the map, by pointer id (client coordinates). */
  const touches = useRef(new Map<number, Point>());
  const pan = useRef<{ id: number; x: number; y: number; left: number; top: number; at: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; anchor: Point } | null>(null);
  const frame = useRef(0);
  const glide = useRef(0);

  const stopGlide = () => {
    if (glide.current) cancelAnimationFrame(glide.current);
    glide.current = 0;
  };
  useEffect(
    () => () => {
      if (glide.current) cancelAnimationFrame(glide.current);
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    []
  );

  const twoFingers = (): { distance: number; centre: Point } | null => {
    const el = containerRef.current;
    const [a, b] = [...touches.current.values()];
    if (!el || !a || !b) return null;
    const rect = el.getBoundingClientRect();
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      centre: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
    };
  };

  const handlers: FlowZoom["handlers"] = {
    onPointerDown: (e) => {
      const el = containerRef.current;
      if (!el) return;
      stopGlide();
      if (e.pointerType === "touch") {
        // A first finger means no other is down: forget any whose lift was never seen.
        if (e.isPrimary) touches.current.clear();
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.current.size === 2) {
          const two = twoFingers();
          if (two) {
            const z = zoomRef.current;
            pinch.current = { distance: two.distance, zoom: z, anchor: { x: (el.scrollLeft + two.centre.x) / z, y: (el.scrollTop + two.centre.y) / z } };
            pan.current = null;
            setPanning(false);
          }
          return;
        }
      }
      if (e.button !== 0 || !onGround(e.target)) return;
      pan.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, at: performance.now(), vx: 0, vy: 0 };
      setPanning(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // A pointer that is already gone cannot be captured; the drag simply ends at the box's edge.
      }
    },
    onPointerMove: (e) => {
      const el = containerRef.current;
      if (!el) return;
      if (e.pointerType === "touch" && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current) {
        if (frame.current) return;
        // One zoom per frame, however many moves the two fingers send.
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          const two = twoFingers();
          const start = pinch.current;
          if (two && start) zoomTo(start.zoom * (two.distance / start.distance), start.anchor, two.centre);
        });
        return;
      }
      const p = pan.current;
      if (!p || p.id !== e.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - p.at);
      const left = p.left - (e.clientX - p.x);
      const top = p.top - (e.clientY - p.y);
      // Speed in px/ms, smoothed, for the glide after the finger lifts.
      p.vx = 0.7 * ((left - el.scrollLeft) / dt) + 0.3 * p.vx;
      p.vy = 0.7 * ((top - el.scrollTop) / dt) + 0.3 * p.vy;
      p.at = now;
      el.scrollLeft = left;
      el.scrollTop = top;
    },
    onPointerUp: (e) => end(e, true),
    onPointerCancel: (e) => end(e, false),
  };

  function end(e: ReactPointerEvent<HTMLDivElement>, mayGlide: boolean) {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    const p = pan.current;
    if (!p || p.id !== e.pointerId) return;
    pan.current = null;
    setPanning(false);
    const el = containerRef.current;
    if (!el) return;
    // A flick keeps the map moving and lets it settle, the way a scrolled list does.
    const fresh = performance.now() - p.at < 80;
    if (!mayGlide || e.pointerType !== "touch" || !fresh || Math.hypot(p.vx, p.vy) < 0.3 || reducedMotion()) return;
    let vx = p.vx;
    let vy = p.vy;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      el.scrollLeft += vx * dt;
      el.scrollTop += vy * dt;
      const decay = Math.pow(0.995, dt);
      vx *= decay;
      vy *= decay;
      glide.current = Math.hypot(vx, vy) > 0.03 ? requestAnimationFrame(step) : 0;
    };
    glide.current = requestAnimationFrame(step);
  }

  // `fixed`: open at that zoom from the first step (the map opens at 100%); without it, shrink until every step shows.
  const fit = useCallback((fixed?: number) => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return false;
    const b = boundsRef.current;
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const roomX = Math.max(120, el.clientWidth - FIT_MARGIN * 2);
    const roomY = Math.max(120, el.clientHeight - FIT_TOP - FIT_BOTTOM);
    // A phone-wide box never shrinks the cards past reading size: it shows the start and pans.
    const floor = el.clientWidth < 640 ? READABLE_ZOOM : MIN_ZOOM;
    const z = clampZoom(fixed ?? Math.max(floor, Math.min(1, roomX / w, roomY / h)));
    // Centred when the steps fit; otherwise from the first step, with the margin.
    const spareX = Math.max(0, roomX - w * z);
    const spareY = Math.max(0, roomY - h * z);
    pendingScroll.current = { left: b.minX * z - FIT_MARGIN - spareX / 2, top: b.minY * z - FIT_TOP - spareY / 2 };
    if (z === zoomRef.current) flushScroll();
    else {
      zoomRef.current = z;
      setZoom(z);
    }
    return true;
  }, [containerRef, flushScroll]);

  // Once per funnel, as soon as the box has a size (it may be mounted before its pane is laid out).
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!autoFitKey) {
      fitted.current = null;
      return;
    }
    const el = containerRef.current;
    if (!el || fitted.current === autoFitKey) return;
    const run = () => {
      if (fitted.current === autoFitKey) return true;
      // 100% on a desktop; a phone is too narrow for that (one card and a half), so it fits to reading size.
      if (!(el.clientWidth >= 640 ? fit(1) : fit())) return false;
      fitted.current = autoFitKey;
      return true;
    };
    if (run() || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (run()) observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoFitKey, containerRef, fit]);

  const reveal = useCallback(
    (box: { x: number; y: number; width: number; height: number }) => {
      const el = containerRef.current;
      if (!el || el.clientWidth === 0) return;
      const z = zoomRef.current;
      const margin = 16;
      const left = box.x * z - margin;
      const right = (box.x + box.width) * z + margin;
      const top = box.y * z - margin;
      const bottom = (box.y + box.height) * z + margin;
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left);
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
      if (top < el.scrollTop) el.scrollTop = Math.max(0, top);
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    },
    [containerRef]
  );

  const isPinching = useCallback(() => pinch.current !== null, []);
  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);

  return { zoom, toMap, handlers, panning, isPinching, zoomIn, zoomOut, fit, reveal };
}

// --- thumbnails ----------------------------------------------------------------

const TONE: Record<string, string> = {
  heading: "bg-ink/50",
  text: "bg-ink/20",
  image: "bg-primary/30",
  video: "bg-primary/30",
  button: "bg-primary",
  cod_form: "bg-accent",
  product_card: "bg-success/40",
};

/** A schematic of the step's page: one row per section (the first four), a block per element. */
export function StepThumbnail({ tree, className }: { tree: PageTree; className?: string }) {
  const rows = tree.sections.slice(0, 4).map((section) =>
    (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((col) => (col.elements ?? []).map((el) => el.type))).slice(0, 6)
  );
  return (
    <div aria-hidden data-slot="step-thumb" className={cn("flex h-10 flex-col gap-0.5 overflow-hidden rounded-lg border border-line bg-paper p-1", className)}>
      {rows.map((types, i) => (
        <div key={i} className="flex min-h-0 flex-1 items-center gap-0.5">
          {types.length === 0 ? (
            <span className="h-1 w-full rounded-full bg-line" />
          ) : (
            types.map((type, j) => <span key={j} className={cn("h-1.5 flex-1 rounded-full", TONE[type] ?? "bg-ink/15")} />)
          )}
        </div>
      ))}
    </div>
  );
}

// --- numbers -------------------------------------------------------------------

export type StepStats = StepNumbers;

/** Each step's numbers for the chosen period, with the period's select (7 / 30 / 90 days). */
export function useStepStats(funnelId: string | null) {
  const t = useT(STRINGS);
  const { byKey, period, setPeriod, available } = useFunnelNumbers(funnelId);
  const picker = (
    // 16px on a phone, so focusing it never zooms the page.
    <Select
      aria-label={t.period}
      className="zimos-flow-period h-9 w-auto rounded-full py-0 ps-3 pe-2 text-base sm:text-xs pointer-coarse:h-11"
      value={period}
      onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
    >
      <option value="7">{t.days7}</option>
      <option value="30">{t.days30}</option>
      <option value="90">{t.days90}</option>
    </Select>
  );
  return { byKey, picker, period, available };
}

/** One step's line of numbers on its card: visits, orders where the step takes them, and how many of the funnel's visitors got here. */
export function StepStatsLine({ stats }: { stats: StepStats | undefined }) {
  const t = useT(MAP_STRINGS);
  if (!stats) return null;
  if (stats.visits === 0) return <p className="text-[11px] leading-4 text-ink-soft">{t.noVisits}</p>;
  const cells: Array<{ id: string; icon: typeof IconEye; value: string; label: string }> = [{ id: "visits", icon: IconEye, value: num(stats.visits), label: t.visits }];
  if (stats.orders !== null) cells.push({ id: "orders", icon: IconOrders, value: num(stats.orders), label: t.orders });
  else if (stats.signups !== null) cells.push({ id: "signups", icon: IconUserAdd, value: num(stats.signups), label: t.signups });
  if (stats.reach !== null) cells.push({ id: "reach", icon: IconChart, value: pct(stats.reach), label: t.reach });
  return (
    <div data-slot="step-stats" className="flex items-end gap-3" title={fmt(t.statsOf, { visits: stats.visits, reach: pct(stats.reach) })}>
      {cells.map(({ id, icon: Glyph, value, label }) => (
        <div key={id} className="min-w-0">
          <p className="flex items-center gap-1 text-[13px] font-semibold leading-4 tabular-nums text-ink">
            <Glyph className="size-3 shrink-0 text-ink-soft" aria-hidden />
            <bdi>{value}</bdi>
          </p>
          <p className="truncate text-[10.5px] leading-[14px] text-ink-soft">{label}</p>
        </div>
      ))}
    </div>
  );
}
