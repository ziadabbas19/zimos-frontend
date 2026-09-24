import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import {
  ApiError,
  funnelRuntimeGetStep,
  type FunnelRuntimeState,
  type PageTree,
  type StorefrontProduct,
} from "@store-builder/api-client";
import { FunnelProgress } from "@/components/funnel/FunnelProgress";
import { FUNNEL_ACTIONS_ID, FunnelOrders, FunnelStepActions } from "@/components/funnel/FunnelStep";
import { FunnelUnavailable } from "@/components/funnel/FunnelUnavailable";
import { StepTransition } from "@/components/funnel/StepTransition";
import { PageRenderer } from "@/components/page-renderer";
import { funnelErrorKind, type FunnelErrorKind } from "@/lib/funnelErrors";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { storeHref } from "@/lib/storeHref";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, getStorefrontProduct } from "@/lib/storeMeta";
import { getStoreBasePath } from "@/lib/storeRoute";

type Params = Promise<{ workspaceId: string; ref: string; sessionId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Loaded = { ok: true; data: FunnelRuntimeState } | { ok: false; kind: FunnelErrorKind };

/** Deduped so generateMetadata and the page share one step lookup. */
const loadStep = cache(async (workspaceId: string, funnelId: string, sessionId: string): Promise<Loaded> => {
  const client = await createServerStorefrontApiClient();
  try {
    return { ok: true, data: await funnelRuntimeGetStep(client, workspaceId, funnelId, sessionId) };
  } catch (err) {
    // An API answer (4xx/5xx) becomes a view; anything else is a real failure.
    if (!(err instanceof ApiError)) throw err;
    return { ok: false, kind: funnelErrorKind(err) };
  }
});

function seoString(seo: Record<string, unknown> | undefined, key: string) {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** The step's own SEO from the published snapshot; the funnel layout keeps it noindex. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, ref, sessionId } = await params;
  if (!UUID.test(ref) || !UUID.test(sessionId)) return {};
  const result = await loadStep(workspaceId, ref, sessionId);
  if (!result.ok || !result.data.step) return {};
  const { step } = result.data;
  const title = seoString(step.seo, "title") ?? step.name;
  const description = seoString(step.seo, "description");
  const ogImage = seoString(step.seo, "ogImage");
  return {
    title,
    description,
    openGraph: {
      title: seoString(step.seo, "ogTitle") ?? title,
      description: seoString(step.seo, "ogDescription") ?? description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/**
 * The product a checkout step sells: the first `product_card` the merchant
 * placed in the step's page, found the way ProductCardElement finds it —
 * `productId` is an id or a slug, and an empty one means the first product the
 * catalogue returns. Null when the step has no product card.
 */
async function checkoutProduct(workspaceId: string, tree: PageTree | null): Promise<StorefrontProduct | null> {
  for (const section of tree?.sections ?? []) {
    for (const row of section.rows ?? []) {
      for (const column of row.columns ?? []) {
        for (const el of column.elements ?? []) {
          if (el.type !== "product_card") continue;
          const raw = (el.props as Record<string, unknown> | undefined)?.productId;
          const ref = typeof raw === "string" ? raw.trim() : "";
          if (ref) {
            const product = await getStorefrontProduct(workspaceId, ref);
            if (product) return product;
            continue;
          }
          try {
            const client = await createServerStorefrontApiClient();
            const { products } = await client.listStorefrontProducts(workspaceId, { limit: 1 });
            if (products[0]) return products[0];
          } catch {
            /* no catalogue — try the next card */
          }
        }
      }
    }
  }
  return null;
}

/**
 * One step of a running funnel session: /f/<funnelId>/<sessionId>. The URL is
 * the session's, not the step's — the server reads which step the session is
 * on, so a reload resumes exactly there and an advance just refreshes in place.
 *
 * The step's page is the merchant's page tree, rendered with the store's own
 * PageRenderer; what the shopper does on the step — continue, order,
 * accept/decline — is the client island underneath (components/funnel/
 * FunnelStep). In funnel mode the renderer's commerce links point at that
 * island rather than the product page.
 *
 * A finished journey (`done`) still carries the step it ended on — the
 * merchant's thank-you page — and that page is rendered with the confirmation
 * under it. Only `done` with no step (a republish removed it) falls back to a
 * generic "all set" view.
 */
export default async function FunnelStepPage({ params }: { params: Params }) {
  const { workspaceId, ref, sessionId } = await params;
  const basePath = await getStoreBasePath(workspaceId);
  const entry = storeHref(basePath, `/f/${encodeURIComponent(ref)}`);
  // Only the entry resolves a subdomain; a malformed session starts over.
  if (!UUID.test(ref) || !UUID.test(sessionId)) redirect(entry);

  const [store, result] = await Promise.all([getStoreMeta(workspaceId), loadStep(workspaceId, ref, sessionId)]);
  if (!store) notFound();

  if (!result.ok) {
    // The backend's 404s don't say what is missing (session, funnel or step).
    // The entry sorts it out: it resumes or restarts a session, or shows "not
    // available" when the funnel itself is gone.
    if (result.kind === "notFound") redirect(entry);
    return <FunnelUnavailable kind={result.kind === "paused" ? "unavailable" : "error"} />;
  }

  const { data } = result;
  const { session } = data;
  if (!data.step) {
    return (
      <main className="flex-1 pt-6">
        <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={session.orderId} standalone />
      </main>
    );
  }

  const { step } = data;
  const done = !!data.done;
  const locale = await getStoreLocale(store);
  const tree = step.tree ?? null;
  const product = !done && step.stepType === "checkout" ? await checkoutProduct(workspaceId, tree) : null;
  // A new step (or the same step reached again, or the journey ending on it)
  // starts with fresh state and its own entrance.
  const stepKey = `${step.key}:${session.path.length}:${done ? "done" : "open"}`;
  // Store-relative, like a merchant link: StoreLink puts this store's prefix on it.
  const nextHref = `/f/${ref}/${sessionId}#${FUNNEL_ACTIONS_ID}`;

  return (
    <main className="flex-1">
      {!done && <FunnelProgress completed={session.path.length} />}
      <StepTransition key={stepKey}>
        <PageRenderer
          tree={tree}
          workspaceId={workspaceId}
          currency={store.currency}
          locale={locale}
          funnel={{ nextHref }}
        />
        {done ? (
          <FunnelOrders workspaceId={workspaceId} sessionId={sessionId} orderId={session.orderId} />
        ) : (
          <FunnelStepActions
            key={stepKey}
            workspaceId={workspaceId}
            funnelId={ref}
            sessionId={sessionId}
            step={{ key: step.key, name: step.name, stepType: step.stepType }}
            offer={data.offer ?? null}
            product={product}
            sessionOrderId={session.orderId}
          />
        )}
      </StepTransition>
    </main>
  );
}
