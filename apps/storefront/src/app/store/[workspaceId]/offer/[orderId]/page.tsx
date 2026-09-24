import { redirect } from "next/navigation";
import { storeHref } from "@/lib/storeHref";
import { getStoreBasePath } from "@/lib/storeRoute";

type Params = Promise<{ workspaceId: string; orderId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The post-purchase upsell is parked (see `UpsellOfferView.tsx`): an order now
 * goes straight to its thank-you page, and old or bookmarked /offer links
 * follow it there, keeping the order number.
 */
export default async function OfferRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ workspaceId, orderId }, search] = await Promise.all([params, searchParams]);
  const basePath = await getStoreBasePath(workspaceId);
  const number = typeof search.number === "string" ? search.number : null;
  const query = number ? `?${new URLSearchParams({ number }).toString()}` : "";
  redirect(storeHref(basePath, `/orders/${encodeURIComponent(orderId)}${query}`));
}
