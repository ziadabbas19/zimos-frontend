import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useLayoutEffect,
} from "react";
import { IconDelete, IconEdit, IconExpand, IconFlow, IconInfo, IconMagic, IconMinus, IconPlus } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import type { FunnelProblem } from "@store-builder/api-client";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/EmptyState";
import { TriggerPopover as Popover } from "@/components/TriggerPopover";
import { Sheet } from "@/components/Sheet";
import type { ContextMenuItem } from "@/components/ContextMenu";
import {
  STARTER_TEMPLATE_IDS,
  starterPlan,
  type StarterTemplateId,
  type UiEdge,
  type UiEdgeCondition,
  type UiFunnel,
  type UiStep,
  type UiStepType,
} from "../funnelAdapter";
import { CONDITION_LABELS, EDITOR_STRINGS, STARTER_TEMPLATE_TEXT } from "../FunnelEditorPage.strings";
import { FLOW_CARD_H, FLOW_CARD_W } from "../funnelFlow";
import { StepChain } from "../StepChain";
import { MAX_ZOOM, MIN_ZOOM, useFlowZoom, useStepStats } from "../FlowMapTools";
import { LinkPoints, linkPointsOf, pointOfEdge, pointY, useLinkLabels, type LinkDrag, type LinkPoint } from "../FlowLinkPoints";
import { CARD_PAGE_BOX, StepCard } from "../canvas/StepCard";
import { SplitTestChip } from "../canvas/SplitTestChip";
import { ARROW_LOOK, StepTypeMenu } from "../canvas/StepTypeMenu";
import { ARROW_LABELS, MAP_STRINGS, pct } from "../canvas/strings";
import { useStepSplitTests } from "../canvas/useFunnelNumbers";
import { CONDITION_ORDER, type OfferInfo } from "./funnelMeta";

// ---------------------------------------------------------------- canvas --

const CARD_W = FLOW_CARD_W;
const CARD_H = FLOW_CARD_H;
/** The starter the empty map's one main button applies: a product page, the order form, thank you. */
const FIRST_STARTER: StarterTemplateId = "cod-single";

/** The step-type menu open on the map, and what picking from it does. */
export type CanvasMenu =
  | { kind: "after"; key: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number }
  // A link point dropped on empty map, or "A new step…": the new step it leads to.
  | { kind: "link"; fromKey: string; point: LinkPoint; x: number; y: number };

export interface LegendLineProps {
  /** The connector condition whose line style is sampled. */
  condition: UiEdgeCondition;
}

/** A short sample of each connector style, so "yes" and "no" read without a tooltip. */
export function LegendLine({ condition }: LegendLineProps) {
  const look = ARROW_LOOK[condition];
  return (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" stroke={look.stroke} strokeWidth="2" strokeDasharray={look.dash} />
    </svg>
  );
}

export interface TemplatePickerProps {
  /** A starter template was picked for the empty funnel. */
  onApply: (id: StarterTemplateId) => void;
}

/** What an empty map shows: what the map is for, one button that starts it, and the other five starters. */
export function TemplatePicker({ onApply }: TemplatePickerProps) {
  const t = useT(MAP_STRINGS);
  const { locale, dir } = useLocale();
  const chains = useMemo(() => new Map(STARTER_TEMPLATE_IDS.map((id) => [id, starterPlan(id, locale).steps.map((s) => s.type)])), [locale]);
  return (
    <div dir={dir} className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <EmptyState
        icon={<IconFlow />}
        title={t.emptyTitle}
        description={t.emptyBody}
        className="px-4 py-8"
        action={
          <Button size="lg" onClick={() => onApply(FIRST_STARTER)}>
            {t.emptyPrimary}
          </Button>
        }
      />
      <h3 className="mt-6 px-1 text-xs font-semibold text-ink-soft">{t.emptyOthers}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {STARTER_TEMPLATE_IDS.map((id) => {
          const text = STARTER_TEMPLATE_TEXT[locale][id];
          return (
            <li key={id} className="flex">
              <button
                type="button"
                onClick={() => onApply(id)}
                data-first={id === FIRST_STARTER ? "" : undefined}
                className="zimos-flow-starter flex min-h-11 w-full cursor-pointer flex-col rounded-2xl bg-paper-raised p-3.5 text-start ring-1 ring-line transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-ink">{text.name}</span>
                  {id === FIRST_STARTER && <span data-slot="flow-best" className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-dark dark:text-primary">{t.emptyBest}</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-ink-soft">{text.description}</span>
                <StepChain types={chains.get(id) ?? []} className="mt-3" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 px-1 text-xs text-ink-soft">{t.orBlank}</p>
    </div>
  );
}

/** A round button of the map's floating bars: 36px, 44px under a thumb. */
function ToolButton({
  label,
  hint,
  showLabel = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  /** Write the label beside the icon when the map is wide enough. */
  showLabel?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={hint ?? label} disabled={disabled} onClick={onClick} className={TOOL_CLASS}>
      {children}
      {showLabel && <span className="hidden pe-1 @2xl:inline">{label}</span>}
    </button>
  );
}

const TOOL_CLASS =
  "zimos-flow-tool flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium text-ink transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none pointer-coarse:h-11 pointer-coarse:min-w-11";

const PLUS_CLASS =
  "zimos-flow-plus relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft before:absolute before:-inset-2.5 before:content-[''] hover:bg-primary-soft hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary dark:hover:text-primary pointer-coarse:size-7 pointer-coarse:before:-inset-2";

const LEGEND: Array<{ condition: UiEdgeCondition; text: "legendYes" | "legendNo" | "legendOrder" | "legendNext" | "legendButton" }> = [
  { condition: "accepted_offer", text: "legendYes" },
  { condition: "declined_offer", text: "legendNo" },
  { condition: "completed_checkout", text: "legendOrder" },
  { condition: "always", text: "legendNext" },
  { condition: "clicked_through", text: "legendButton" },
];

/** The steps in the order a visitor meets them: from the start along the arrows (yes before no), the rest after. */
function flowOrder(steps: UiStep[], edges: UiEdge[], entryKey: string | null): UiStep[] {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const targeted = new Set(edges.map((e) => e.toStepKey));
  const seen = new Set<string>();
  const out: UiStep[] = [];
  const queue: string[] = entryKey ? [entryKey] : steps.filter((s) => !targeted.has(s.key)).map((s) => s.key);
  while (queue.length > 0) {
    const key = queue.shift() as string;
    const step = byKey.get(key);
    if (!step || seen.has(key)) continue;
    seen.add(key);
    out.push(step);
    const next = edges.filter((e) => e.fromStepKey === key).sort((a, b) => b.priority - a.priority);
    for (const e of next) queue.push(e.toStepKey);
  }
  for (const s of steps) if (!seen.has(s.key)) out.push(s);
  return out;
}

const escapeKey = (key: string) => (typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(key) : key.replace(/"/g, ""));

export interface FlowCanvasProps {
  /** The funnel to draw — the page passes it with the path's steps only (generic pages left out). */
  funnel: UiFunnel;
  /** The key of the one step visitors start on; null when there is not exactly one. */
  entryKey: string | null;
  /** The selected step's key, or null. */
  selectedKey: string | null;
  /** What stops each step from publishing, by step key (red border and count on the card). */
  problemsByStep: Map<string, FunnelProblem[]>;
  /** Offer id to the offer's and its product's names, for the offer line on a card. */
  offerIndex: Map<string, OfferInfo>;
  /** False while the offer catalog is still loading (an unknown offer shows "…" instead of an error). */
  catalogLoaded: boolean;
  /** A card was pressed or chosen with the keyboard. */
  onSelect: (key: string) => void;
  /** A card was dragged to a new place on the map (called once, when it is let go). */
  onMove: (key: string, x: number, y: number) => void;
  /** A type picked from a card's "+": add that step after the card's step. */
  onAddAfter: (fromKey: string, type: UiStepType) => void;
  /** A type picked from a connector's "+": put that step in the middle of the connector. */
  onInsert: (edgeId: string, type: UiStepType) => void;
  /** A card was double-clicked (or Enter, or «افتح الصفحة»): open its page in the page editor. */
  onOpenPage: (key: string) => void;
  /** "Tidy" was pressed: lay the steps out again. */
  onTidy: () => void;
  /** A starter template was picked on the empty map. */
  onApplyTemplate: (id: StarterTemplateId) => void;
  /** A link point was connected to an existing step. */
  onLink: (fromKey: string, toKey: string, point: LinkPoint) => void;
  /** A link point was dropped on empty map and a type picked: a new step it leads to. */
  onLinkNew: (fromKey: string, point: LinkPoint, type: UiStepType) => void;
  /**
   * Delete on a card (the Delete key, or its menu): the page asks to confirm.
   * Optional — without it, Delete selects the step, which opens its panel
   * where «احذف الخطوة» is.
   */
  onDeleteStep?: (step: UiStep) => void;
}

/** The flow map: the step cards, the arrows that carry the numbers, the link points and the floating tools. */
export function FlowCanvas(props: FlowCanvasProps) {
  const { funnel, entryKey, selectedKey, problemsByStep, offerIndex, catalogLoaded, onInsert, onAddAfter, onOpenPage, onTidy, onApplyTemplate, onLink, onLinkNew } = props;
  // The page hands new closures on every render; the cards keep theirs and read the latest through this.
  const latest = useRef(props);
  latest.current = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const t = useT(MAP_STRINGS);
  const { locale, dir } = useLocale();
  const [open, setOpen] = useState<{ menu: CanvasMenu; left: number; top: number; sheet: boolean } | null>(null);
  const [linkDrag, setLinkDrag] = useState<LinkDrag | null>(null);
  /** Where the card under the hand is, between the press and the release (the funnel itself changes once, on release). */
  const [dragPos, setDragPos] = useState<{ key: string; x: number; y: number } | null>(null);
  const pointLabels = useLinkLabels();

  const steps = useMemo(
    () => (dragPos ? funnel.steps.map((s) => (s.key === dragPos.key ? { ...s, x: dragPos.x, y: dragPos.y } : s)) : funnel.steps),
    [funnel.steps, dragPos]
  );
  const byKey = useMemo(() => new Map(steps.map((s) => [s.key, s])), [steps]);
  const ordered = useMemo(() => flowOrder(steps, funnel.edges, entryKey), [steps, funnel.edges, entryKey]);
  const width = Math.max(900, ...steps.map((s) => s.x + CARD_W + 120));
  const height = Math.max(520, ...steps.map((s) => s.y + CARD_H + 120));
  const bounds = useMemo(
    () =>
      steps.length === 0
        ? { minX: 0, minY: 0, maxX: 900, maxY: 520 }
        : {
            minX: Math.min(...steps.map((s) => s.x)),
            // The "start" flag and the test chip sit on the card's top edge; a dot's name beside its end edge.
            minY: Math.min(...steps.map((s) => s.y)) - 14,
            maxX: Math.max(...steps.map((s) => s.x)) + CARD_W + 32,
            maxY: Math.max(...steps.map((s) => s.y)) + CARD_H,
          },
    [steps]
  );

  // Zoom and pan (FlowMapTools), each step's numbers, and the split tests running on the steps.
  const map = useFlowZoom(containerRef, bounds, steps.length > 0 ? funnel.id || "new" : null);
  const { toMap, isPinching, reveal } = map;
  const zoomNow = useRef(map.zoom);
  zoomNow.current = map.zoom;
  const stats = useStepStats(funnel.id || null);
  const tests = useStepSplitTests(funnel.id || null);

  /**
   * What sits on an arrow keeps a readable size when the map is zoomed out:
   * the pill grows back by up to 1.67 (so at the phone's 60% it is life-size
   * and its "+" is a full 44px target).
   */
  const pillScale = Math.min(1.67, Math.max(1, 1 / map.zoom));

  // Connectors between the same two steps (an offer's "yes" and "no" both
  // going to thank-you) fan out, so neither line nor label hides the other.
  const connectors = useMemo(() => {
    const groups = new Map<string, UiEdge[]>();
    const inbound = new Map<string, number>();
    const firstOut = new Map<string, string>();
    const answers = new Set<string>();
    for (const e of funnel.edges) {
      const k = `${e.fromStepKey}>${e.toStepKey}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
      inbound.set(e.toStepKey, (inbound.get(e.toStepKey) ?? 0) + 1);
      if (!firstOut.has(e.fromStepKey)) firstOut.set(e.fromStepKey, e.id);
      if (e.condition === "accepted_offer" || e.condition === "declined_offer") answers.add(e.fromStepKey);
    }
    return funnel.edges.flatMap((e) => {
      const from = byKey.get(e.fromStepKey);
      const to = byKey.get(e.toStepKey);
      if (!from || !to) return [];
      const group = groups.get(`${e.fromStepKey}>${e.toStepKey}`) ?? [e];
      const off = (group.indexOf(e) - (group.length - 1) / 2) * 76 * pillScale;
      // From the link point it belongs to, when the card has one for it.
      const points = linkPointsOf(from, pointLabels);
      const at = pointOfEdge(points, e);
      const x1 = from.x + CARD_W;
      const y1 = at >= 0 ? from.y + pointY(at) : from.y + CARD_H / 2;
      const x2 = to.x;
      const y2 = to.y + CARD_H / 2;
      const bend = Math.max(48, Math.abs(x2 - x1) / 2);

      // What the numbers can honestly say. The API counts visitors per step, not per arrow: the share
      // that reached the target is exact only when this arrow is the target's one way in. An offer's
      // yes / no split is not counted at all today, so those arrows carry no number.
      const a = stats.byKey.get(e.fromStepKey);
      const b = stats.byKey.get(e.toStepKey);
      const isAnswer = e.condition === "accepted_offer" || e.condition === "declined_offer";
      const share = !isAnswer && a && b && a.visits > 0 && b.visits <= a.visits && inbound.get(e.toStepKey) === 1 ? b.visits / a.visits : null;
      // Who stopped on the source step: said once per step, on its first arrow, and not beside a yes / no.
      const left = a && a.dropRate !== null && a.dropRate > 0 && firstOut.get(e.fromStepKey) === e.id && !answers.has(e.fromStepKey) ? a.dropRate : null;
      return [
        {
          edge: e,
          from,
          to,
          d: `M ${x1} ${y1} C ${x1 + bend} ${y1 + off}, ${x2 - bend} ${y2 + off}, ${x2} ${y2}`,
          pointLabel: at >= 0 && e.condition === "clicked_through" ? points[at].label : null,
          // Midpoint of the cubic at t = 0.5.
          mx: (x1 + x2) / 2,
          my: (y1 + y2) / 2 + 0.75 * off,
          share,
          left,
        },
      ];
    });
  }, [funnel.edges, byKey, pointLabels, stats.byKey, pillScale]);

  // --- the step-type menu ---------------------------------------------------

  /** Open the step-type menu for a place on the map: a small pane at that spot, a sheet on a phone-wide map. */
  const openMenu = useCallback((menu: CanvasMenu) => {
    const el = containerRef.current;
    const z = zoomNow.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const left = menu.x * z - (el?.scrollLeft ?? 0);
    const top = menu.y * z - (el?.scrollTop ?? 0);
    setOpen({
      menu,
      sheet: w > 0 && w < 480,
      left: Math.max(8, w > 0 ? Math.min(left, w - 232) : left),
      top: Math.max(8, h > 0 ? Math.min(top, h - 400) : top),
    });
  }, []);

  function pick(type: UiStepType) {
    if (!open) return;
    const menu = open.menu;
    if (menu.kind === "after") onAddAfter(menu.key, type);
    else if (menu.kind === "link") onLinkNew(menu.fromKey, menu.point, type);
    else onInsert(menu.id, type);
    setOpen(null);
  }

  // A link point let go of: on a card, that step; on the empty map, a new one.
  function dropLink(drag: LinkDrag) {
    const target = steps.find((s) => s.key !== drag.fromKey && drag.x2 >= s.x && drag.x2 <= s.x + CARD_W && drag.y2 >= s.y && drag.y2 <= s.y + CARD_H);
    if (target) onLink(drag.fromKey, target.key, drag.point);
    else openMenu({ kind: "link", fromKey: drag.fromKey, point: drag.point, x: drag.x2, y: drag.y2 });
  }

  // --- a card under the hand --------------------------------------------------

  const drag = useRef<{ key: string; id: number; dx: number; dy: number; cx: number; cy: number; touch: boolean; moved: boolean; x: number; y: number; el: HTMLElement; rx: number; ry: number; sent: number } | null>(null);
  const dragFrame = useRef(0);
  /** A drag ends with a click on the card it moved; that click must not select it. */
  const justDragged = useRef(false);

  // React has just drawn the dragged card at dragPos: the translate now only covers what the pointer moved since.
  useLayoutEffect(() => {
    const d = drag.current;
    if (!d || !dragPos || dragPos.key !== d.key) return;
    d.rx = dragPos.x;
    d.ry = dragPos.y;
    d.el.style.translate = `${d.x - d.rx}px ${d.y - d.ry}px`;
  }, [dragPos]);

  const onCardPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, step: UiStep) => {
      if (e.button !== 0) return;
      justDragged.current = false;
      const p = toMap(e);
      drag.current = { key: step.key, id: e.pointerId, dx: p.x - step.x, dy: p.y - step.y, cx: e.clientX, cy: e.clientY, touch: e.pointerType === "touch", moved: false, x: step.x, y: step.y, el: e.currentTarget, rx: step.x, ry: step.y, sent: 0 };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Without capture the drag still follows the pointer while it stays over the card.
      }
    },
    [toMap]
  );

  const onCardPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      // A second finger came down: this is a pinch, the card goes back.
      if (isPinching()) {
        d.el.style.translate = "";
        d.el.style.transition = "";
        drag.current = null;
        if (dragFrame.current) cancelAnimationFrame(dragFrame.current);
        dragFrame.current = 0;
        setDragPos(null);
        return;
      }
      // A press that barely moves is a press (and, held, the card's menu) — not a drag.
      if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < (d.touch ? 8 : 4)) return;
      d.moved = true;
      const p = toMap(e);
      d.x = Math.max(0, Math.round(p.x - d.dx));
      d.y = Math.max(0, Math.round(p.y - d.dy));
      // One position per frame, and only on the map: the funnel changes once, when the card is let go.
      if (dragFrame.current) return;
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = 0;
        const now = drag.current;
        if (!now?.moved) return;
        // The card itself follows the pointer on the compositor (a translate from where React last drew it);
        // React — and with it the arrows — catches up about twenty times a second, which keeps a slow phone smooth.
        now.el.style.transition = "none";
        now.el.style.translate = `${now.x - now.rx}px ${now.y - now.ry}px`;
        const t = performance.now();
        if (t - now.sent >= 48) {
          now.sent = t;
          setDragPos({ key: now.key, x: now.x, y: now.y });
        }
      });
    },
    [toMap, isPinching]
  );

  const onCardPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Nothing was captured.
    }
    if (dragFrame.current) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    d.el.style.translate = "";
    d.el.style.transition = "";
    if (d.moved) {
      justDragged.current = true;
      if (e.type !== "pointercancel") latest.current.onMove(d.key, d.x, d.y);
    }
    setDragPos(null);
  }, []);

  const onCardClick = useCallback((key: string) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    latest.current.onSelect(key);
  }, []);

  const openPage = useCallback((key: string) => latest.current.onOpenPage(key), []);

  const requestDelete = useCallback((step: UiStep) => {
    const { onDeleteStep, onSelect } = latest.current;
    if (onDeleteStep) onDeleteStep(step);
    else onSelect(step.key);
  }, []);

  // --- the keyboard -----------------------------------------------------------

  const graph = useRef({ steps, edges: funnel.edges, byKey });
  graph.current = { steps, edges: funnel.edges, byKey };

  const onCardKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>, step: UiStep) => {
      if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
      const { steps: all, edges, byKey: index } = graph.current;
      /** The closest card on one side, for when no arrow leads that way. */
      const nearest = (side: (s: UiStep) => boolean) =>
        all
          .filter((s) => s.key !== step.key && side(s))
          .sort((p, q) => Math.abs(p.x - step.x) + Math.abs(p.y - step.y) - (Math.abs(q.x - step.x) + Math.abs(q.y - step.y)))[0]?.key;
      let next: string | undefined;
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          latest.current.onOpenPage(step.key);
          return;
        case " ":
          e.preventDefault();
          latest.current.onSelect(step.key);
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          requestDelete(step);
          return;
        // The map always runs left to right, in Arabic too: right is "the next step".
        case "ArrowRight":
          next =
            edges
              .filter((edge) => edge.fromStepKey === step.key && index.has(edge.toStepKey))
              .sort((a, b) => b.priority - a.priority)[0]?.toStepKey ?? nearest((s) => s.x > step.x + CARD_W / 2);
          break;
        case "ArrowLeft":
          next = edges.find((edge) => edge.toStepKey === step.key && index.has(edge.fromStepKey))?.fromStepKey ?? nearest((s) => s.x < step.x - CARD_W / 2);
          break;
        case "ArrowDown":
          next = nearest((s) => s.y > step.y + CARD_H / 2);
          break;
        case "ArrowUp":
          next = nearest((s) => s.y < step.y - CARD_H / 2);
          break;
        default:
          return;
      }
      e.preventDefault();
      const target = next ? index.get(next) : undefined;
      if (!target) return;
      latest.current.onSelect(target.key);
      reveal({ x: target.x, y: target.y, width: CARD_W, height: CARD_H });
      containerRef.current?.querySelector<HTMLElement>(`[data-step-key="${escapeKey(target.key)}"]`)?.focus({ preventScroll: true });
    },
    [requestDelete, reveal]
  );

  /** Anywhere on the map: "+" and "-" zoom, "0" fits. Never while typing or picking in a field. */
  function onMapKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
    if (e.key === "+" || e.key === "=") map.zoomIn();
    else if (e.key === "-" || e.key === "_") map.zoomOut();
    else if (e.key === "0") map.fit();
    else return;
    e.preventDefault();
  }

  // --- each card's menu (right-click, long press, Shift+F10) -------------------

  const menus = useMemo(() => {
    const out = new Map<string, ContextMenuItem[]>();
    for (const s of funnel.steps) {
      out.set(s.key, [
        { id: "open", label: t.menuOpen, icon: IconEdit, onSelect: () => latest.current.onOpenPage(s.key) },
        { id: "add", label: t.menuAdd, icon: IconPlus, onSelect: () => openMenu({ kind: "after", key: s.key, x: s.x + CARD_W + 16, y: s.y + CARD_H - 32 }) },
        { id: "delete", label: t.menuDelete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: () => requestDelete(s) },
      ]);
    }
    return out;
  }, [funnel.steps, t, openMenu, requestDelete]);

  const isEmpty = funnel.steps.length === 0;

  return (
    <main
      aria-label={EDITOR_STRINGS[locale].canvasLabel}
      onKeyDown={onMapKeyDown}
      className="zimos-flow @container relative flex min-h-[420px] min-w-0 flex-1 shrink-0 flex-col bg-paper lg:min-h-0 lg:shrink"
    >
      {isEmpty ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TemplatePicker onApply={onApplyTemplate} />
        </div>
      ) : (
        <div
          ref={containerRef}
          dir="ltr"
          data-flow-ground=""
          data-panning={map.panning ? "" : undefined}
          className={cn("zimos-flow-map relative min-h-0 flex-1 touch-none overflow-auto overscroll-contain select-none", map.panning ? "cursor-grabbing" : "cursor-grab")}
          {...map.handlers}
        >
          <div
            data-flow-ground=""
            className="zimos-flow-ground relative min-h-full min-w-full"
            style={{
              width: width * map.zoom,
              height: height * map.zoom,
              backgroundImage: "radial-gradient(var(--color-line-strong) 1px, transparent 1px)",
              backgroundSize: `${20 * map.zoom}px ${20 * map.zoom}px`,
            }}
          >
            <div data-flow-ground="" className="absolute start-0 top-0" style={{ width, height, transform: `scale(${map.zoom})`, transformOrigin: "0 0" }}>
              <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
                <defs>
                  {CONDITION_ORDER.map((cond) => (
                    <marker key={cond} id={`funnel-arrow-${cond}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW_LOOK[cond].stroke} />
                    </marker>
                  ))}
                </defs>
                {connectors.map(({ edge: e, d }) => {
                  const active = e.fromStepKey === selectedKey || e.toStepKey === selectedKey;
                  const look = ARROW_LOOK[e.condition];
                  return (
                    <path
                      key={e.id}
                      d={d}
                      fill="none"
                      stroke={look.stroke}
                      strokeLinecap="round"
                      strokeDasharray={look.dash}
                      strokeOpacity={active ? 1 : 0.75}
                      strokeWidth={(active ? 2.75 : 2) * pillScale}
                      markerEnd={`url(#funnel-arrow-${e.condition})`}
                    />
                  );
                })}
                {linkDrag && (
                  <path
                    d={`M ${linkDrag.x1} ${linkDrag.y1} C ${linkDrag.x1 + 60} ${linkDrag.y1}, ${linkDrag.x2 - 60} ${linkDrag.y2}, ${linkDrag.x2} ${linkDrag.y2}`}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2 * pillScale}
                    strokeDasharray="5 4"
                  />
                )}
              </svg>

              {/* The cards first, in the order a visitor meets them: that is the order Tab walks. */}
              {ordered.map((s) => {
                const isSelected = s.key === selectedKey;
                const isDragging = dragPos?.key === s.key;
                const test = tests.get(s.key);
                const addLabel = fmt(t.addAfter, { name: s.name });
                return (
                  <Fragment key={s.key}>
                    <StepCard
                      step={s}
                      x={s.x}
                      y={s.y}
                      selected={isSelected}
                      entry={s.key === entryKey}
                      dragging={isDragging}
                      problems={problemsByStep.get(s.key)?.length ?? 0}
                      offer={s.offerId ? offerIndex.get(s.offerId) : undefined}
                      catalogLoaded={catalogLoaded}
                      stats={stats.byKey.get(s.key)}
                      menu={menus.get(s.key) ?? NO_ITEMS}
                      onPointerDown={onCardPointerDown}
                      onPointerMove={onCardPointerMove}
                      onPointerUp={onCardPointerUp}
                      onPress={onCardClick}
                      onOpen={openPage}
                      onKeyDown={onCardKeyDown}
                    />
                    {isSelected && !isDragging && (
                      <button
                        type="button"
                        data-flow-item=""
                        onClick={() => onOpenPage(s.key)}
                        aria-label={fmt(t.openPageOf, { name: s.name })}
                        style={{ left: s.x + CARD_PAGE_BOX.x, top: s.y + CARD_PAGE_BOX.y, width: CARD_PAGE_BOX.width, height: CARD_PAGE_BOX.height }}
                        className="zimos-flow-open absolute z-[3] flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-paper-raised/90 text-xs font-semibold text-primary-dark ring-1 ring-primary/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-primary"
                      >
                        <IconEdit className="size-3.5 shrink-0" aria-hidden />
                        <span dir={dir}>{t.openPage}</span>
                      </button>
                    )}
                    {test && !isDragging && (
                      <div className="pointer-events-none absolute z-[4] flex justify-end pe-3" style={{ left: s.x, top: s.y - 11, width: CARD_W }}>
                        <span dir={dir} className="flex">
                          <SplitTestChip test={test} stepName={s.name} />
                        </span>
                      </div>
                    )}
                    {!isDragging && (
                      <button
                        type="button"
                        data-flow-item=""
                        onClick={() => openMenu({ kind: "after", key: s.key, x: s.x + CARD_W + 16, y: s.y + CARD_H - 32 })}
                        aria-label={addLabel}
                        title={addLabel}
                        style={{ left: s.x + CARD_W - 12, top: s.y + CARD_H - 32 }}
                        className={cn(PLUS_CLASS, "absolute z-[4] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line")}
                      >
                        <IconPlus className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </Fragment>
                );
              })}

              {connectors.map(({ edge: e, from, to, mx, my, pointLabel, share, left }) => {
                const look = ARROW_LOOK[e.condition];
                const Glyph = look.icon;
                const active = e.fromStepKey === selectedKey || e.toStepKey === selectedKey;
                const insertLabel = fmt(t.insertHere, { from: from.name, to: to.name });
                return (
                  <div
                    key={`pill-${e.id}`}
                    data-flow-item=""
                    className="absolute z-[3]"
                    style={{ left: mx, top: my, transform: `translate(-50%, -50%) scale(${pillScale})` }}
                  >
                    <div
                      dir={dir}
                      data-slot="flow-pill"
                      data-condition={e.condition}
                      data-active={active ? "" : undefined}
                      className={cn(
                        "zimos-flow-pill flex min-w-12 cursor-default flex-col items-center rounded-2xl bg-paper-raised px-2 pt-1 pb-1 text-center shadow-[var(--shadow-card)]",
                        active ? "ring-2" : "ring-1",
                        look.ring
                      )}
                    >
                      <span className={cn("flex max-w-24 items-center gap-1 text-[11px] leading-4 font-semibold", look.text)} title={CONDITION_LABELS[locale][e.condition]}>
                        {Glyph && <Glyph className="size-3 shrink-0" aria-hidden />}
                        <bdi className="truncate whitespace-nowrap">{pointLabel ?? ARROW_LABELS[locale][e.condition]}</bdi>
                      </span>
                      {share !== null && (
                        <span className="text-sm leading-5 font-bold tabular-nums text-ink" title={fmt(t.arrived, { pct: pct(share), from: from.name, to: to.name })}>
                          <bdi>{pct(share)}</bdi>
                        </span>
                      )}
                      {left !== null && <span className="text-[10.5px] leading-4 whitespace-nowrap text-ink-soft">{fmt(t.left, { pct: pct(left) })}</span>}
                      <button
                        type="button"
                        onClick={() => openMenu({ kind: "edge", id: e.id, x: mx - 104, y: my + 14 })}
                        aria-label={insertLabel}
                        title={insertLabel}
                        className={cn(PLUS_CLASS, "mt-0.5 bg-paper-sunken")}
                      >
                        <IconPlus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}

              {steps.map((s) => (
                <LinkPoints
                  key={`points-${s.key}`}
                  step={s}
                  steps={steps}
                  edges={funnel.edges}
                  cardWidth={CARD_W}
                  toMap={toMap}
                  onDrag={setLinkDrag}
                  onDrop={dropLink}
                  onPick={(point, toKey) => (toKey ? onLink(s.key, toKey, point) : openMenu({ kind: "link", fromKey: s.key, point, x: s.x + CARD_W + 24, y: s.y + 40 }))}
                  showLabels={s.key === selectedKey}
                  zoom={map.zoom}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* Top corner: the period the numbers are for (only when they can be read) and what the lines mean. */}
          <div dir={dir} data-slot="flow-bar" className="zimos-flow-bar absolute start-3 top-3 z-10 flex items-center gap-1 rounded-full bg-paper-raised p-1 shadow-[var(--shadow-raised)] ring-1 ring-line">
            {stats.available && stats.picker}
            <Popover
              label={t.legend}
              side="bottom"
              align="start"
              trigger={
                <button type="button" aria-label={t.legend} title={t.legend} className={TOOL_CLASS}>
                  <IconInfo className="size-[18px]" aria-hidden />
                </button>
              }
            >
              <ul className="space-y-2 text-xs text-ink">
                {LEGEND.map(({ condition, text }) => (
                  <li key={condition} className="flex items-center gap-2">
                    <LegendLine condition={condition} />
                    {t[text]}
                  </li>
                ))}
              </ul>
              <p className="mt-3 hidden max-w-60 text-[11px] leading-4 text-ink-soft pointer-fine:block">{t.mapHelp}</p>
            </Popover>
          </div>

          {/* Bottom corner: zoom, fit and tidy. */}
          <div dir={dir} data-slot="flow-bar" className="zimos-flow-bar absolute end-3 bottom-3 z-10 flex items-center gap-0.5 rounded-full bg-paper-raised p-1 shadow-[var(--shadow-raised)] ring-1 ring-line">
            <ToolButton label={t.zoomOut} onClick={map.zoomOut} disabled={map.zoom <= MIN_ZOOM}>
              <IconMinus className="size-4" aria-hidden />
            </ToolButton>
            <span className="w-11 text-center text-xs font-medium tabular-nums text-ink" aria-live="polite" aria-label={fmt(t.zoomNow, { pct: pct(map.zoom) })}>
              <bdi>{pct(map.zoom)}</bdi>
            </span>
            <ToolButton label={t.zoomIn} onClick={map.zoomIn} disabled={map.zoom >= MAX_ZOOM}>
              <IconPlus className="size-4" aria-hidden />
            </ToolButton>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
            <ToolButton label={t.fit} onClick={() => map.fit()} showLabel>
              <IconExpand className="size-4" aria-hidden />
            </ToolButton>
            <ToolButton label={t.tidy} hint={t.tidyHint} onClick={onTidy} disabled={funnel.steps.length < 2} showLabel>
              <IconMagic className="size-4" aria-hidden />
            </ToolButton>
          </div>
        </>
      )}

      {/* "Add which step?" — a small pane at the spot on a wide map, a sheet from the bottom on a phone. */}
      {open && !open.sheet && (
        <>
          <button type="button" aria-label={t.close} tabIndex={-1} className="absolute inset-0 z-20 cursor-default" onClick={() => setOpen(null)} />
          <div
            dir={dir}
            role="dialog"
            aria-label={t.pickType}
            data-slot="flow-menu"
            className="zimos-flow-menu absolute z-30 flex max-h-[min(24rem,calc(100%-1rem))] w-56 flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-[var(--shadow-pop)] ring-1 ring-line"
            style={{ left: open.left, top: open.top }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(null);
              }
            }}
          >
            <p className="border-b border-line px-3 py-2 text-xs font-semibold text-ink-soft">{t.pickType}</p>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <StepTypeMenu onPick={pick} autoFocus />
            </div>
          </div>
        </>
      )}
      <Sheet open={open !== null && open.sheet} onOpenChange={(next) => !next && setOpen(null)} title={t.pickType} size="sm">
        <StepTypeMenu onPick={pick} />
      </Sheet>
    </main>
  );
}

const NO_ITEMS: readonly ContextMenuItem[] = [];
