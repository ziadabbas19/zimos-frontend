/**
 * What the funnel editor's zones share: the step-type table, the colours of
 * steps and connectors, the publish pre-check and the offer catalog. Anything
 * two zones need lives here, so no zone imports another for a helper.
 */
import { IconAnnounce, IconArrowDownRight, IconArrowOut, IconBlog, IconCard, IconCelebrate, IconCheck, IconClick, IconClose, IconFileAdd, IconLayout, IconUserAdd, type IconComponent } from "@/components/icons";
import { FUNNEL_OFFER_STEP_TYPES, type FunnelProblem, type FunnelStatus, type Offer, type Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import type { Locale } from "@/i18n/LocaleContext";
import type { UiEdgeCondition, UiFunnel, UiStepType } from "../funnelAdapter";
import { collectFunnelProblems } from "../funnelFlow";
import { flowSteps } from "../genericPageRules";

// ------------------------------------------------------------------ meta --

export interface StepTypeMeta {
  icon: IconComponent;
  /** Whether an offer is mandatory (backend OFFER_STEP_TYPES). */
  needsOffer: boolean;
}

export const STEP_TYPES: Record<UiStepType, StepTypeMeta> = {
  landing: { icon: IconLayout, needsOffer: false },
  sales: { icon: IconAnnounce, needsOffer: false },
  opt_in: { icon: IconUserAdd, needsOffer: false },
  checkout: { icon: IconCard, needsOffer: false },
  upsell: { icon: IconArrowOut, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("upsell") },
  downsell: { icon: IconArrowDownRight, needsOffer: FUNNEL_OFFER_STEP_TYPES.includes("downsell") },
  thank_you: { icon: IconCelebrate, needsOffer: false },
  custom: { icon: IconFileAdd, needsOffer: false },
  article: { icon: IconBlog, needsOffer: false },
};

export const STEP_TYPE_ORDER: UiStepType[] = ["article", "landing", "sales", "opt_in", "checkout", "upsell", "downsell", "thank_you", "custom"];

export const CONDITION_ORDER: UiEdgeCondition[] = ["always", "completed_checkout", "accepted_offer", "declined_offer", "clicked_through"];

export const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

/** Type chip colours on the flow map: pages in brand blue, checkout amber, offers green/amber, thank-you neutral. */
export const STEP_TONE: Record<UiStepType, string> = {
  landing: "bg-primary-soft text-primary-dark dark:text-primary",
  sales: "bg-primary-soft text-primary-dark dark:text-primary",
  opt_in: "bg-primary-soft text-primary-dark dark:text-primary",
  custom: "bg-primary-soft text-primary-dark dark:text-primary",
  checkout: "bg-accent-soft text-accent-dark",
  upsell: "bg-success-soft text-success",
  downsell: "bg-accent-soft text-accent-dark",
  thank_you: "bg-paper text-ink-soft ring-1 ring-line",
  article: "bg-primary-soft text-primary-dark dark:text-primary",
};

/**
 * Connector look per condition. "Yes" (accepted) is a solid green line, "no"
 * (declined) a dashed red one, checkout-completed brand blue, "always" grey —
 * so the two answers out of an offer step never look alike.
 */
export const EDGE_TONE: Record<UiEdgeCondition, { stroke: string; dash?: string; pill: string; icon: IconComponent | null }> = {
  always: { stroke: "var(--color-ink-soft)", pill: "border-line bg-paper-raised text-ink-soft", icon: null },
  completed_checkout: { stroke: "var(--color-primary)", pill: "border-primary/40 bg-primary-soft text-primary-dark dark:text-primary", icon: IconCard },
  accepted_offer: { stroke: "var(--color-success)", pill: "border-success/40 bg-success-soft text-success", icon: IconCheck },
  declined_offer: { stroke: "var(--color-danger)", dash: "6 5", pill: "border-danger/40 bg-danger-soft text-danger", icon: IconClose },
  // One button's own path (a link point on the card).
  clicked_through: { stroke: "var(--color-ink)", pill: "border-line-strong bg-paper-raised text-ink", icon: IconClick },
};

export function StepIcon({ type, className }: { type: UiStepType; className?: string }) {
  const Glyph = STEP_TYPES[type].icon;
  return <Glyph className={className} aria-hidden />;
}

/** Entry = the only step with no incoming edge (backend resolveEntry). */
export function entryKeysOf(funnel: UiFunnel): string[] {
  const targeted = new Set(funnel.edges.map((e) => e.toStepKey));
  // Generic pages (genericPageRules.ts) are off the path: never the start.
  return flowSteps(funnel.steps, funnel.edges).filter((s) => !targeted.has(s.key)).map((s) => s.key);
}

// ------------------------------------------------------------ validation --

/**
 * Pre-check mirroring backend funnelGraph.validateGraph (with the publish-time
 * content check). The step-keyed version lives in funnelFlow.collectFunnelProblems
 * so problems can sit next to their step; server problems are authoritative on publish.
 */
export function validateFunnel(funnel: UiFunnel, locale: Locale = "en"): string[] {
  return collectFunnelProblems(funnel, locale).map((p) => p.message);
}

/** Server and client problems, one entry per distinct message. */
export function mergeProblems(a: FunnelProblem[], b: FunnelProblem[]): FunnelProblem[] {
  const seen = new Set(a.map((p) => p.message));
  return [...a, ...b.filter((p) => !seen.has(p.message))];
}

// ---------------------------------------------------------- offer catalog --

export interface CatalogEntry {
  product: Product;
  /** Active offers only — the backend rejects inactive ones. */
  offers: Offer[];
}

export async function loadOfferCatalog(workspaceId: string): Promise<CatalogEntry[]> {
  const products: Product[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await apiClient.listProducts(workspaceId, { limit: 100, cursor });
    products.push(...res.products);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  const out: CatalogEntry[] = [];
  for (const product of products) {
    const offers = product.offers ?? (await apiClient.listOffers(workspaceId, product.id));
    out.push({ product, offers: offers.filter((o) => o.status === "active") });
  }
  return out;
}

/** What the flow map shows for a step's offer: the offer's name and the product it sells. */
export interface OfferInfo {
  offerName: string;
  productId: string;
  productName: string;
}

export function indexOffers(catalog: CatalogEntry[] | null): Map<string, OfferInfo> {
  const index = new Map<string, OfferInfo>();
  for (const entry of catalog ?? []) {
    for (const o of entry.offers) index.set(o.id, { offerName: o.name, productId: entry.product.id, productName: entry.product.name });
  }
  return index;
}

// ------------------------------------------------------------------ roles --

/**
 * Who may publish, pause, resume and roll back a funnel: the `funnels.publish`
 * permission (backend core/security/permissions.js). Of the system roles the
 * owner ("*") and the workspace manager hold it; the ones below do not — the
 * editor role can build a funnel but not put it live. The dashboard only sees
 * the role key, so a custom role reads as allowed: the server still decides,
 * and its 403 comes back as the usual "no permission" message. Same approach
 * as lib/analyticsAccess.ts.
 */
export const NO_FUNNEL_PUBLISH_ROLES: ReadonlySet<string> = new Set(["editor", "accountant", "order_operator", "confirmation_agent", "fulfillment"]);

/** False only for a known system role without funnels.publish. */
export function canPublishFunnels(role: string | null | undefined): boolean {
  return !NO_FUNNEL_PUBLISH_ROLES.has(role ?? "");
}
