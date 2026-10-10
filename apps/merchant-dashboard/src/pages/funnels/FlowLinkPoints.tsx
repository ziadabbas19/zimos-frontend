import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconPlus } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { PageElement, PageTree } from "@store-builder/api-client";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { tempId, type UiEdge, type UiEdgeCondition, type UiFunnel, type UiStep } from "./funnelAdapter";

/**
 * Link points on a funnel map card: every way out of the step's
 * page — each button that moves the shopper on, the order form, an offer's
 * "Yes" and "No" — is a dot on the card's edge. Dragging from a dot to
 * another card draws that path; pressing it (or Enter) lists the steps to
 * pick from instead. A button's path is `clicked_through` with its element id
 * (funnels/funnelRouting.js follows it only for that button); the others are
 * the step's own outcomes.
 */

const STRINGS = {
  en: {
    order: "Order placed",
    yes: "Yes",
    no: "No",
    next: "Continue",
    link: "Link “{label}” to another step",
    linkTo: "“{label}” goes to…",
    linked: "goes to {name}",
    newStep: "A new step…",
    close: "Close",
  },
  ar: {
    order: "تم الطلب",
    yes: "أيوه، ضيفه",
    no: "لا، شكرًا",
    next: "متابعة",
    link: "اربط «{label}» بخطوة تانية",
    linkTo: "«{label}» يروح على…",
    linked: "بيروح على {name}",
    newStep: "خطوة جديدة…",
    close: "إغلاق",
  },
} satisfies Messages;

/** The labels of a card's own outcomes (order, yes, no, continue). */
export function useLinkLabels() {
  return useT(STRINGS);
}

export type LinkPoint = { id: string; label: string; condition: UiEdgeCondition; sourceElementId: string | null };

const MAX_POINTS = 5;
export const POINT_TOP = 44;
export const POINT_GAP = 22;
export const pointY = (index: number) => POINT_TOP + index * POINT_GAP;

function elementsOf(tree: PageTree): PageElement[] {
  return tree.sections.flatMap((s) => (s.rows ?? []).flatMap((r) => (r.columns ?? []).flatMap((c) => c.elements ?? [])));
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The step's ways out, in the order they are drawn. */
export function linkPointsOf(step: UiStep, labels: { order: string; yes: string; no: string; next: string }): LinkPoint[] {
  const points: LinkPoint[] = [];
  const elements = elementsOf(step.tree);
  if (step.type === "checkout" || elements.some((e) => e.type === "cod_form")) {
    points.push({ id: "order", label: labels.order, condition: "completed_checkout", sourceElementId: null });
  }
  if (step.type === "upsell" || step.type === "downsell") {
    points.push({ id: "yes", label: labels.yes, condition: "accepted_offer", sourceElementId: null });
    points.push({ id: "no", label: labels.no, condition: "declined_offer", sourceElementId: null });
  }
  // A button with no link of its own moves the shopper on (PageRenderer, funnel mode).
  for (const el of elements) {
    if (el.type !== "button") continue;
    const props = (el.props ?? {}) as Record<string, unknown>;
    if (str(props.href) || !str(props.label)) continue;
    points.push({ id: el.id, label: str(props.label), condition: "clicked_through", sourceElementId: el.id });
  }
  if (points.length === 0 && step.type !== "thank_you") {
    points.push({ id: "next", label: labels.next, condition: "always", sourceElementId: null });
  }
  return points.slice(0, MAX_POINTS);
}

/** Which point an edge leaves from, if any. */
export function pointOfEdge(points: LinkPoint[], edge: UiEdge): number {
  return points.findIndex((p) =>
    p.condition === "clicked_through" ? edge.condition === "clicked_through" && edge.sourceElementId === p.sourceElementId : edge.condition === p.condition
  );
}

/**
 * The funnel with `point` of `fromKey` leading to `toKey`: the point's
 * previous path is replaced (one arrow per point). A button's path outranks
 * the step's general ones, so that button follows it.
 */
export function linkPoint(f: UiFunnel, fromKey: string, toKey: string, point: LinkPoint): UiFunnel {
  const same = (e: UiEdge) =>
    e.fromStepKey === fromKey &&
    (point.condition === "clicked_through"
      ? e.condition === "clicked_through" && e.sourceElementId === point.sourceElementId
      : e.condition === point.condition && !e.sourceElementId);
  const existing = f.edges.find(same);
  const priority = point.sourceElementId ? 2 : point.condition === "accepted_offer" ? 1 : 0;
  const next: UiEdge = existing
    ? { ...existing, toStepKey: toKey }
    : { id: tempId(), serverId: null, fromStepKey: fromKey, toStepKey: toKey, condition: point.condition, sourceElementId: point.sourceElementId, priority };
  return { ...f, edges: existing ? f.edges.map((e) => (e === existing ? next : e)) : [...f.edges, next] };
}

export type LinkDrag = { fromKey: string; point: LinkPoint; x1: number; y1: number; x2: number; y2: number };

/** A dot's colour says which way out it is: yes green, no amber, the order in the store's colour. */
const DOT_TONE: Record<UiEdgeCondition, { dot: string; chip: string }> = {
  accepted_offer: { dot: "border-success text-success", chip: "bg-success-soft text-success" },
  declined_offer: { dot: "border-accent text-accent", chip: "bg-accent-soft text-accent-dark" },
  completed_checkout: { dot: "border-primary text-primary", chip: "bg-primary-soft text-primary-dark dark:text-primary" },
  clicked_through: { dot: "border-ink text-ink", chip: "bg-paper-raised text-ink ring-1 ring-line" },
  always: { dot: "border-ink-soft text-ink-soft", chip: "bg-paper-raised text-ink-soft ring-1 ring-line" },
};

/**
 * A card's dots, on its end edge. Drag one to a card, or press it to pick a
 * step. An offer's two answers are always named beside their dots; the other
 * ways out are named while they lead nowhere yet, or when `showLabels` is on
 * (the card is selected).
 */
export function LinkPoints({
  step,
  steps,
  edges,
  cardWidth,
  toMap,
  onDrag,
  onDrop,
  onPick,
  showLabels = false,
  zoom = 1,
}: {
  step: UiStep;
  steps: UiStep[];
  edges: UiEdge[];
  cardWidth: number;
  toMap: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  onDrag: (drag: LinkDrag | null) => void;
  onDrop: (drag: LinkDrag) => void;
  onPick: (point: LinkPoint, toKey: string | null) => void;
  /** Name every dot, not only an offer's answers and the dots that lead nowhere. Default false. */
  showLabels?: boolean;
  /** The map's zoom: the list a dot opens is drawn at its real size whatever the zoom. Default 1. */
  zoom?: number;
}) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<LinkDrag | null>(null);
  const points = linkPointsOf(step, t);

  const start = (e: ReactPointerEvent<HTMLButtonElement>, point: LinkPoint, index: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = toMap(e);
    const next = { fromKey: step.key, point, x1: step.x + cardWidth, y1: step.y + pointY(index), x2: at.x, y2: at.y };
    setDrag(next);
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const at = toMap(e);
    const next = { ...drag, x2: at.x, y2: at.y };
    setDrag(next);
    if (Math.abs(next.x2 - next.x1) + Math.abs(next.y2 - next.y1) > 8) onDrag(next);
  };
  const end = (e: ReactPointerEvent<HTMLButtonElement>, point: LinkPoint) => {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const moved = Math.abs(drag.x2 - drag.x1) + Math.abs(drag.y2 - drag.y1) > 8;
    setDrag(null);
    onDrag(null);
    if (moved) onDrop(drag);
    else setOpen((o) => (o === point.id ? null : point.id));
  };
  const cancel = () => {
    if (!drag) return;
    setDrag(null);
    onDrag(null);
  };

  return (
    <>
      {points.map((point, index) => {
        const edge = edges.find((e) => e.fromStepKey === step.key && pointOfEdge([point], e) === 0);
        const target = edge ? steps.find((s) => s.key === edge.toStepKey) : undefined;
        const label = fmt(t.link, { label: point.label });
        const tone = DOT_TONE[point.condition];
        const isAnswer = point.condition === "accepted_offer" || point.condition === "declined_offer";
        const named = isAnswer || showLabels || !target;
        return (
          <div
            key={point.id}
            data-flow-item=""
            className={cn("absolute", open === point.id ? "z-30" : "z-[4]")}
            style={{ left: step.x + cardWidth - 7, top: step.y + pointY(index) - 7 }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && open === point.id) {
                e.stopPropagation();
                setOpen(null);
              }
            }}
          >
            <button
              type="button"
              aria-label={label}
              title={target ? `${point.label} — ${fmt(t.linked, { name: target.name })}` : label}
              aria-expanded={open === point.id}
              onPointerDown={(e) => start(e, point, index)}
              onPointerMove={move}
              onPointerUp={(e) => end(e, point)}
              onPointerCancel={cancel}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen((o) => (o === point.id ? null : point.id));
                }
              }}
              data-linked={target ? "" : undefined}
              // The dot is small; the pressable area around it is wider than it is tall, so five stacked dots never overlap.
              className={cn(
                "zimos-flow-dot relative block size-3.5 cursor-crosshair touch-none rounded-full border-2 before:absolute before:-inset-x-4 before:-inset-y-1 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                tone.dot,
                target ? "bg-current" : "bg-paper-raised"
              )}
            />
            {named && (
              <span
                data-slot="flow-dot-label"
                className={cn("pointer-events-none absolute start-5 top-1/2 max-w-24 -translate-y-1/2 truncate rounded-full px-1.5 text-[10.5px] font-medium leading-4 whitespace-nowrap", tone.chip)}
              >
                <bdi>{point.label}</bdi>
              </span>
            )}
            {open === point.id && (
              <>
                <button type="button" aria-label={t.close} tabIndex={-1} className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(null)} />
                <div className="absolute start-6 top-0 z-30" style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
                  <div dir={dir} data-slot="flow-menu" className="zimos-flow-menu w-56 overflow-hidden rounded-2xl bg-paper-raised text-sm text-ink shadow-[var(--shadow-pop)] ring-1 ring-line">
                    <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-soft">
                      <bdi>{fmt(t.linkTo, { label: point.label })}</bdi>
                    </p>
                    <ul className="max-h-56 overflow-y-auto overscroll-contain p-1">
                      {steps
                        .filter((s) => s.key !== step.key)
                        .map((s) => (
                          <li key={s.key}>
                            <button
                              type="button"
                              className="flex min-h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-start hover:bg-paper-sunken focus-visible:bg-paper-sunken focus-visible:outline-none pointer-coarse:min-h-11"
                              onClick={() => {
                                setOpen(null);
                                onPick(point, s.key);
                              }}
                            >
                              <bdi className="truncate">{s.name}</bdi>
                            </button>
                          </li>
                        ))}
                      <li>
                        <button
                          type="button"
                          className="flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-start font-medium text-primary hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none pointer-coarse:min-h-11"
                          onClick={() => {
                            setOpen(null);
                            onPick(point, null);
                          }}
                        >
                          <IconPlus className="size-4 shrink-0" aria-hidden />
                          {t.newStep}
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
