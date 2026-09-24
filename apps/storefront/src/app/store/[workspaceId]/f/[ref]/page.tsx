import type { Metadata } from "next";
import { FunnelStart } from "@/components/funnel/FunnelStart";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string; ref: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Ad-click and campaign parameters worth keeping on the session.
const ATTRIBUTION_KEY = /^(utm_[a-z_]+|fbclid|gclid|ttclid|sccid|ref)$/;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.funnel.metaTitle };
}

/**
 * A funnel's public address: /f/<ref>, where `ref` is the funnel's id or its
 * subdomain — the link a merchant shares or puts behind an ad.
 *
 * There is no public "read a funnel" endpoint: the only way in is to start a
 * session, and that needs the visitor id kept in the browser. So this page
 * only hands the campaign parameters to <FunnelStart>, which starts (or
 * resumes) the session and moves on to ./[sessionId], where steps render.
 */
export default async function FunnelEntryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ workspaceId, ref }, query] = await Promise.all([params, searchParams]);

  const attribution: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (ATTRIBUTION_KEY.test(key) && typeof first === "string" && first) {
      attribution[key] = first.slice(0, 200);
    }
  }

  return <FunnelStart workspaceId={workspaceId} funnelRef={ref} attribution={attribution} />;
}
