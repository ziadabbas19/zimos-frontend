import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HideInFunnel } from "@/components/HideInFunnel";
import { PaymentsPreviewBanner } from "@/components/PaymentsPreviewBanner";
import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { resolveCheckoutSettings } from "@store-builder/api-client";
import { StoreRouteProvider } from "@/components/StoreRoute";
import { storeOrigin } from "@/lib/domains";
import { dirFor, getDictionary, intlLocaleFor } from "@/lib/i18n";
import { DocumentLocale, StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { getStoreLocale, storePhone } from "@/lib/storeLocale";
import { brandStyle, getStoreMeta } from "@/lib/storeMeta";
import { getStoreBasePath } from "@/lib/storeRoute";

/**
 * Names the store for search engines and for anything that unfurls a link.
 *
 * `metadataBase` is the store's own subdomain rather than whatever host served
 * this request, because that subdomain is the store's real address: a page
 * reached through `/store/<workspaceId>` is the same page, and the relative
 * canonical each route sets resolves against this into the one public URL for
 * it either way.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const description = store.tagline || t.meta.storeDescription(store.name);

  return {
    metadataBase: new URL(storeOrigin(store.slug)),
    title: { default: store.name, template: `%s — ${store.name}` },
    description,
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      locale: intlLocaleFor(locale).replace("-", "_"),
      ...(store.logoUrl ? { images: [{ url: store.logoUrl, alt: store.name }] } : {}),
    },
  };
}

/**
 * Wraps every page of one store. It establishes:
 *  - the merchant's brand colours as CSS custom properties, so the whole
 *    subtree (header, buttons, links, badges) picks them up through the
 *    semantic tokens — see the `.brand-theme` block in globals.css;
 *  - the store's link prefix, resolved once for the client components below it,
 *    since only a server component can tell how the request arrived;
 *  - the store language: `lang`/`dir` on this wrapper, mirrored onto <html> by
 *    <DocumentLocale> because the root layout can't know which store a request
 *    is for;
 *  - the shared header/footer, so every page of the store — including one the
 *    merchant built in the website editor — sits under the same branding.
 *    Funnel pages (`/f/…`) are the exception: they draw their own masthead,
 *    so HideInFunnel leaves these two out there.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [store, basePath] = await Promise.all([
    getStoreMeta(workspaceId),
    getStoreBasePath(workspaceId),
  ]);
  if (!store) notFound();

  const locale = await getStoreLocale(store);
  const info: StoreInfo = {
    workspaceId,
    id: store.id,
    slug: store.slug,
    name: store.name,
    currency: store.currency,
    logoUrl: store.logoUrl,
    phone: storePhone(store),
    // Re-resolved rather than trusted: an older API without `checkout` must
    // still give the forms the defaults.
    checkout: resolveCheckoutSettings(store.checkout),
  };

  return (
    <StoreRouteProvider basePath={basePath}>
      <StoreContextProvider locale={locale} store={info}>
        <div
          lang={intlLocaleFor(locale)}
          dir={dirFor(locale)}
          className="brand-theme flex min-h-full flex-1 flex-col bg-paper font-sans text-ink"
          style={brandStyle(store.themeSettings)}
        >
          <DocumentLocale locale={locale} />
          <PaymentsPreviewBanner workspaceId={workspaceId} />
          <HideInFunnel>
            <StoreHeader store={store} locale={locale} />
          </HideInFunnel>
          <div className="flex flex-1 flex-col">{children}</div>
          <HideInFunnel>
            <StoreFooter store={store} locale={locale} />
          </HideInFunnel>
        </div>
      </StoreContextProvider>
    </StoreRouteProvider>
  );
}
