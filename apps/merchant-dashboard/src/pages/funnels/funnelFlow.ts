/**
 * Pure operations on the editor's funnel graph: tidy layout, adding a step
 * after another or into a connection, removing a step without breaking a
 * straight line, starting from a template, and the pre-publish problem list.
 *
 * Nothing here talks to the API. Everything returns a new UiFunnel, so the
 * editor stays a plain "draft vs baseline" diff that saveFunnelDiff pushes.
 *
 * ORDER: the backend has no step order — what runs next is decided only by
 * edges (funnelRouting.pickNextEdge: priority DESC, then snapshot order). The
 * list order and card positions are editor metadata in `seo.zimosCanvas`.
 */
import { FUNNEL_OFFER_STEP_TYPES, type FunnelProblem } from "@store-builder/api-client";
import { fmt, type Locale } from "@/i18n/LocaleContext";
import { STEP_DEFAULT_NAMES, STEP_TYPE_LABELS, VALIDATION_STRINGS } from "./FunnelEditorPage.strings";
import { tempId, uniqueStepKey, type StarterPlan, type UiEdge, type UiEdgeCondition, type UiFunnel, type UiStep, type UiStepType } from "./funnelAdapter";
import { pageElementCount, stepPageTree } from "./funnelPages";
import { flowSteps, isGenericStep } from "./genericPageRules";
import { duplicateSection } from "@/pages/website/editor/canvasTools";

// ---------------------------------------------------------------- layout --

/** Canvas card size and grid. Cards are laid out left to right in flow order. */
export const FLOW_CARD_W = 224;
// Room for the page thumbnail and the step's numbers (FlowMapTools).
export const FLOW_CARD_H = 172;
const GAP_X = 340;
const GAP_Y = 176;
const ORIGIN_X = 40;
const ORIGIN_Y = 64;

type EdgeLike = Pick<UiEdge, "fromStepKey" | "toStepKey" | "condition" | "priority">;

export function isOfferType(type: UiStepType): boolean {
  return FUNNEL_OFFER_STEP_TYPES.includes(type);
}

/** Entry = the steps no edge points at (backend resolveEntry). A publishable funnel has exactly one. */
export function entryKeysOf(stepKeys: string[], edges: EdgeLike[]): string[] {
  const targeted = new Set(edges.map((e) => e.toStepKey));
  return stepKeys.filter((k) => !targeted.has(k));
}

/** "Yes" paths above "no" paths; otherwise the order the runtime tries them in. */
function branchRank(e: EdgeLike): number {
  return e.condition === "declined_offer" ? 1 : 0;
}

/**
 * Column = distance from the entry, row = branch. The first path out of a
 * step stays on its row; every further path (a "no" branch) drops to the next
 * free row in the next column. Steps the entry can't reach go in a row of
 * their own below, so they are easy to spot.
 */
export function layoutFlow(stepKeys: string[], edges: EdgeLike[]): Map<string, { x: number; y: number }> {
  const known = new Set(stepKeys);
  const out = new Map<string, EdgeLike[]>();
  for (const e of edges) {
    if (!known.has(e.fromStepKey) || !known.has(e.toStepKey)) continue;
    const list = out.get(e.fromStepKey) ?? [];
    list.push(e);
    out.set(e.fromStepKey, list);
  }
  for (const list of out.values()) list.sort((a, b) => branchRank(a) - branchRank(b) || b.priority - a.priority);

  const cell = new Map<string, { col: number; row: number }>();
  const used = new Map<number, Set<number>>();
  const take = (col: number, row: number) => {
    const rows = used.get(col) ?? new Set<number>();
    let r = row;
    while (rows.has(r)) r++;
    rows.add(r);
    used.set(col, rows);
    return r;
  };

  const entries = entryKeysOf(stepKeys, edges);
  let maxRow = -1;
  for (const entry of entries) {
    const row = take(0, maxRow + 1);
    cell.set(entry, { col: 0, row });
    const queue = [entry];
    while (queue.length > 0) {
      const cur = queue.shift() as string;
      const at = cell.get(cur) as { col: number; row: number };
      maxRow = Math.max(maxRow, at.row);
      for (const e of out.get(cur) ?? []) {
        if (cell.has(e.toStepKey)) continue;
        const pos = { col: at.col + 1, row: take(at.col + 1, at.row) };
        cell.set(e.toStepKey, pos);
        maxRow = Math.max(maxRow, pos.row);
        queue.push(e.toStepKey);
      }
    }
  }
  // Unreachable steps (or a funnel with no entry at all): one row below.
  let col = 0;
  const strayRow = maxRow + 1;
  for (const key of stepKeys) {
    if (cell.has(key)) continue;
    cell.set(key, { col: col++, row: strayRow });
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [key, { col: c, row }] of cell) positions.set(key, { x: ORIGIN_X + c * GAP_X, y: ORIGIN_Y + row * GAP_Y });
  return positions;
}

/** Lays the cards out in flow order and sorts the step list the same way. */
export function tidyFunnel(f: UiFunnel): UiFunnel {
  const positions = layoutFlow(
    f.steps.map((s) => s.key),
    f.edges
  );
  const steps = f.steps
    .map((s) => ({ ...s, ...(positions.get(s.key) ?? { x: s.x, y: s.y }) }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  return { ...f, steps };
}

function overlaps(steps: UiStep[], x: number, y: number): boolean {
  return steps.some((s) => Math.abs(s.x - x) < FLOW_CARD_W && Math.abs(s.y - y) < FLOW_CARD_H);
}

function freeSpot(steps: UiStep[], x: number, y: number): { x: number; y: number } {
  let ny = y;
  while (overlaps(steps, x, ny)) ny += GAP_Y;
  return { x, y: ny };
}

// ----------------------------------------------------------- editing ops --

/**
 * The condition a new path out of `from` should carry: a checkout moves on
 * once the order is placed; an offer step gets its "yes" path first, then its
 * "no" path; anything else just continues.
 */
export function nextCondition(from: UiStep, edges: UiEdge[]): UiEdgeCondition {
  if (from.type === "checkout") return "completed_checkout";
  if (isOfferType(from.type)) {
    const conds = new Set(edges.filter((e) => e.fromStepKey === from.key).map((e) => e.condition));
    if (!conds.has("accepted_offer")) return "accepted_offer";
    if (!conds.has("declined_offer")) return "declined_offer";
  }
  return "always";
}

function edge(fromStepKey: string, toStepKey: string, condition: UiEdgeCondition, priority = 0): UiEdge {
  return { id: tempId(), serverId: null, fromStepKey, toStepKey, condition, priority };
}

/**
 * Paths out of a freshly inserted step towards `to`. An offer step gets both a
 * "yes" and a "no" path, so neither answer strands the customer.
 */
function pathsOut(step: UiStep, to: string): UiEdge[] {
  if (isOfferType(step.type)) return [edge(step.key, to, "accepted_offer", 1), edge(step.key, to, "declined_offer")];
  return [edge(step.key, to, step.type === "checkout" ? "completed_checkout" : "always")];
}

export function newStep(type: UiStepType, locale: Locale, takenKeys: Iterable<string>, at: { x: number; y: number }): UiStep {
  return {
    id: null,
    key: uniqueStepKey(type.replace(/_/g, "-"), takenKeys),
    name: STEP_DEFAULT_NAMES[locale][type],
    type,
    offerId: null,
    bumpOfferId: null,
    experimentId: null,
    seo: {},
    tree: stepPageTree(type, locale),
    x: at.x,
    y: at.y,
  };
}

/** A new step to the right of `fromKey`, connected from it. */
export function addStepAfter(f: UiFunnel, fromKey: string, type: UiStepType, locale: Locale, takenKeys: Iterable<string>): { funnel: UiFunnel; key: string } {
  const from = f.steps.find((s) => s.key === fromKey);
  if (!from) return { funnel: f, key: fromKey };
  const step = newStep(type, locale, takenKeys, freeSpot(f.steps, from.x + GAP_X, from.y));
  const index = f.steps.findIndex((s) => s.key === fromKey);
  const steps = [...f.steps.slice(0, index + 1), step, ...f.steps.slice(index + 1)];
  return { funnel: { ...f, steps, edges: [...f.edges, edge(from.key, step.key, nextCondition(from, f.edges))] }, key: step.key };
}

/**
 * A copy of a step, placed after it. The copy carries the same type, offer,
 * order bump and search settings, and the same page with a new id on every
 * section and element (two steps must not share ids: a path can follow one
 * button of one page). It is not yet saved (`id: null`), and a running split
 * test stays with the original.
 *
 * On the path, the copy arrives the way "add step after" brings a new one:
 * connected from the original by the condition that step's next path carries.
 * A generic page (a custom step no path touches) stays off the path, and its
 * copy takes an address of its own.
 */
export function duplicateStep(f: UiFunnel, key: string, name: string, takenKeys: Iterable<string>): { funnel: UiFunnel; key: string } | null {
  const source = f.steps.find((s) => s.key === key);
  if (!source) return null;
  const generic = isGenericStep(source, f.edges);
  const copy: UiStep = {
    ...source,
    id: null,
    key: uniqueStepKey(generic ? source.key : source.type.replace(/_/g, "-"), takenKeys),
    name,
    experimentId: null,
    seo: JSON.parse(JSON.stringify(source.seo ?? {})) as Record<string, unknown>,
    tree: { ...source.tree, sections: source.tree.sections.map(duplicateSection) },
    ...freeSpot(f.steps, source.x + GAP_X, source.y),
  };
  const index = f.steps.findIndex((s) => s.key === key);
  const steps = [...f.steps.slice(0, index + 1), copy, ...f.steps.slice(index + 1)];
  const edges = generic ? f.edges : [...f.edges, edge(source.key, copy.key, nextCondition(source, f.edges))];
  return { funnel: { ...f, steps, edges }, key: copy.key };
}

/**
 * Splits the connection A → B into A → new → B. The A → new path keeps the
 * original edge (same id, same condition, same priority) so a saved edge is
 * updated in place rather than deleted and recreated. Cards from B's column
 * onwards shift right to make room.
 */
export function insertStepOnEdge(f: UiFunnel, edgeId: string, type: UiStepType, locale: Locale, takenKeys: Iterable<string>): { funnel: UiFunnel; key: string } | null {
  const target = f.edges.find((e) => e.id === edgeId);
  const from = target && f.steps.find((s) => s.key === target.fromStepKey);
  const to = target && f.steps.find((s) => s.key === target.toStepKey);
  if (!target || !from || !to) return null;

  const shiftFrom = to.x;
  const moved = to.x > from.x ? f.steps.map((s) => (s.x >= shiftFrom ? { ...s, x: s.x + GAP_X } : s)) : f.steps;
  const step = newStep(type, locale, takenKeys, { x: to.x > from.x ? shiftFrom : from.x + GAP_X, y: to.y });
  const index = moved.findIndex((s) => s.key === to.key);
  const steps = [...moved.slice(0, index), step, ...moved.slice(index)];
  const edges = [...f.edges.map((e) => (e.id === edgeId ? { ...e, toStepKey: step.key } : e)), ...pathsOut(step, to.key)];
  return { funnel: { ...f, steps, edges }, key: step.key };
}

/**
 * Removes a step and every connection touching it. When the step sat in a
 * straight line — one way in, and every way out going to the same next step —
 * the step before is joined to the step after, reusing the incoming edge, so
 * deleting the middle of a chain doesn't leave the rest unreachable.
 */
export function removeStep(f: UiFunnel, key: string): UiFunnel {
  const incoming = f.edges.filter((e) => e.toStepKey === key && e.fromStepKey !== key);
  const targets = new Set(f.edges.filter((e) => e.fromStepKey === key && e.toStepKey !== key).map((e) => e.toStepKey));
  const heal = incoming.length === 1 && targets.size === 1 ? { edgeId: incoming[0].id, to: [...targets][0] } : null;
  const canHeal = heal !== null && heal.to !== incoming[0].fromStepKey;

  const edges = f.edges
    .filter((e) => (canHeal && e.id === heal.edgeId) || (e.fromStepKey !== key && e.toStepKey !== key))
    .map((e) => (canHeal && e.id === heal.edgeId ? { ...e, toStepKey: heal.to } : e));
  return { ...f, steps: f.steps.filter((s) => s.key !== key), edges };
}

/** Fills an empty funnel from a starter. Keys are re-slugged against `takenKeys`. */
export function applyStarterPlan(f: UiFunnel, plan: StarterPlan, takenKeys: Iterable<string>): UiFunnel {
  const taken = new Set(takenKeys);
  const keyMap = new Map<string, string>();
  const steps: UiStep[] = plan.steps.map((s) => {
    const key = uniqueStepKey(s.key, taken);
    taken.add(key);
    keyMap.set(s.key, key);
    return {
      id: null,
      key,
      name: s.name,
      type: s.type,
      offerId: null,
      bumpOfferId: null,
      experimentId: null,
      seo: {},
      tree: s.tree,
      x: s.x,
      y: s.y,
    };
  });
  const edges = plan.edges.map((e) => edge(keyMap.get(e.from) ?? e.from, keyMap.get(e.to) ?? e.to, e.condition, e.priority));
  return { ...f, steps: [...f.steps, ...steps], edges: [...f.edges, ...edges] };
}

// --------------------------------------------------------------- problems --

/**
 * Pre-check mirroring backend funnelGraph.validateGraph with requireContent
 * (what publish runs). Each problem names its step when it has one, in the
 * same `{ field, message, stepKey? }` shape the server's 422 uses, so both
 * can be shown next to the step they belong to. Server problems stay
 * authoritative on publish.
 */
export function collectFunnelProblems(funnel: UiFunnel, locale: Locale = "en"): FunnelProblem[] {
  const v = VALIDATION_STRINGS[locale];
  const typeLabels = STEP_TYPE_LABELS[locale];
  const problems: FunnelProblem[] = [];
  const keys = new Set(funnel.steps.map((s) => s.key));
  const nameOf = (key: string) => funnel.steps.find((s) => s.key === key)?.name ?? key;

  for (const s of funnel.steps) {
    if (isOfferType(s.type) && !s.offerId) {
      problems.push({ field: `steps.${s.key}.offerId`, stepKey: s.key, message: fmt(v.needsOffer, { name: s.name, type: typeLabels[s.type] }) });
    }
    if (pageElementCount(s.tree) === 0) {
      problems.push({ field: `steps.${s.key}.data.sections`, stepKey: s.key, message: fmt(v.emptyPage, { name: s.name }) });
    }
  }
  funnel.edges.forEach((e, i) => {
    if (!keys.has(e.fromStepKey) || !keys.has(e.toStepKey)) {
      problems.push({ field: `edges[${i}]`, message: fmt(v.danglingEdge, { from: e.fromStepKey, to: e.toStepKey }) });
    }
  });

  if (funnel.steps.length === 0) {
    problems.push({ field: "steps", message: v.noSteps });
    return problems;
  }
  // Generic pages (genericPageRules.ts) are off the path: neither the start nor "unreachable".
  const entries = entryKeysOf(
    flowSteps(funnel.steps, funnel.edges).map((s) => s.key),
    funnel.edges
  );
  if (entries.length === 0) {
    problems.push({ field: "steps", message: v.noEntry });
    return problems;
  }
  if (entries.length > 1) {
    problems.push({ field: "steps", message: fmt(v.manyEntries, { n: entries.length, names: entries.map(nameOf).join(", ") }) });
    return problems;
  }

  const seen = new Set<string>([entries[0]]);
  const queue = [entries[0]];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const e of funnel.edges) {
      if (e.fromStepKey === cur && keys.has(e.toStepKey) && !seen.has(e.toStepKey)) {
        seen.add(e.toStepKey);
        queue.push(e.toStepKey);
      }
    }
  }
  for (const s of funnel.steps) {
    if (!seen.has(s.key) && !isGenericStep(s, funnel.edges)) problems.push({ field: `steps.${s.key}`, stepKey: s.key, message: fmt(v.unreachable, { name: s.name }) });
  }
  return problems;
}

/**
 * Which step a problem is about. The server sets `stepKey` only on page
 * content problems; the graph ones name it in `field` ("steps.<key>.offerId"),
 * and keys can't contain "." so the first path segment is the whole key.
 */
export function problemStepKey(problem: FunnelProblem): string | null {
  if (problem.stepKey) return problem.stepKey;
  const match = /^steps\.([^.[\]]+)/.exec(problem.field ?? "");
  return match ? match[1] : null;
}

/** Problems split into per-step lists (for steps that exist) and the rest. */
export function groupProblems(problems: FunnelProblem[], stepKeys: Iterable<string>): { byStep: Map<string, FunnelProblem[]>; general: FunnelProblem[] } {
  const known = new Set(stepKeys);
  const byStep = new Map<string, FunnelProblem[]>();
  const general: FunnelProblem[] = [];
  for (const p of problems) {
    const key = problemStepKey(p);
    if (key && known.has(key)) byStep.set(key, [...(byStep.get(key) ?? []), p]);
    else general.push(p);
  }
  return { byStep, general };
}
