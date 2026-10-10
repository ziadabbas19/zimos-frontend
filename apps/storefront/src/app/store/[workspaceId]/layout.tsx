import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackToTop } from "@/components/BackToTop";
import { StoreAppInstall } from "@/components/StoreAppInstall";
import { CartDrawer } from "@/components/CartDrawer";
import { ExitDownsell } from "@/components/offers/StoreOffers";
import { CouponFromLink } from "@/components/offers/CouponBits";
import { NewsletterSignup, SocialProofPopup } from "@/components/offers/Engagement";
import { HideInFunnel } from "@/components/HideInFunnel";
import { MobileCategoryStrip } from "@/components/MobileCategoryStrip";
import { PaymentsPreviewBanner } from "@/components/PaymentsPreviewBanner";
import { HolidayBanner } from "@/components/holiday/HolidayBanner";
import { InviteBanner } from "@/components/rewards/InviteBanner";
import { CUSTOMER_REFERRALS_ENABLED } from "@/lib/features";
import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { StoreAnalytics } from "@/components/StoreAnalytics";
import { BotGuard } from "@/components/BotGuard";
import { OtpGate } from "@/components/OtpGate";
import { TrackingPixels } from "@/components/TrackingPixels";
import { purchaseTimingOf, storePixelsOf } from "@/lib/adPixels";
import {
  resolveCheckoutForm,
  resolveCheckoutSettings,
  resolveThankYouPage,
  storefrontDesignMeta,
  storefrontGeneralMeta,
  storefrontStoreApp,
  storefrontHolidayOf,
} from "@store-builder/api-client";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { StoreRouteProvider } from "@/components/StoreRoute";
import { canonicalOrigin } from "@/lib/domains";
import { dirFor, getDictionary, intlLocaleFor, arOrEn } from "@/lib/i18n";
import { DocumentLocale, StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { StoreShellProvider } from "@/lib/StoreShellContext";
import { getStoreLocale, storePhone } from "@/lib/storeLocale";
import { brandStyle, getStoreCollections, getStoreState, type UnavailableStore } from "@/lib/storeMeta";
import { storeThemeOf } from "@/lib/brandTheme";
import { StoreUnavailable } from "@/components/StoreUnavailable";
import { THEME_FONT_CSS } from "@/app/themeFonts";
import { ThemeChrome } from "@/components/shell/ThemeChrome";
import { StoreNavFrame } from "@/components/shell/StoreNavFrame";

/** An unavailable store has no themeSettings; its own default language still counts. */
function localeSource(store: UnavailableStore) {
  const source = { themeSettings: {}, defaultLocale: store.defaultLocale ?? undefined };
  return source;
}
import { getStoreBasePath } from "@/lib/storeRoute";
import { storeIcons } from "@/lib/storeIcons";

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
  const state = await getStoreState(workspaceId);
  if (state.kind === "unavailable") {
    const t = getDictionary(await getStoreLocale(localeSource(state.store)));
    return { title: { absolute: state.store.name ? `${state.store.name} — ${t.unavailable.metaTitle}` : t.unavailable.metaTitle }, robots: { index: false } };
  }
  const store = state.kind === "ok" ? state.store : null;
  if (!store) return {};

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  // Settings → SEO and general: the title template, description, share
  // image, favicon and Google verification the merchant set, over the defaults.
  const { seo, general } = storefrontGeneralMeta(store);
  const description = seo.description || store.tagline || t.meta.storeDescription(store.name);
  const ogImage = seo.ogImageUrl || store.logoUrl;
  // The tab icon: the merchant's favicon, else the store logo, else the default (lib/storeIcons).
  const icons = storeIcons({ faviconUrl: general.faviconUrl, logoUrl: store.logoUrl });

  return {
    metadataBase: new URL(canonicalOrigin(store)),
    title: { default: store.name, template: seo.titleTemplate || `%s — ${store.name}` },
    description,
    ...(icons ? { icons } : {}),
    ...(seo.googleSiteVerification ? { verification: { google: seo.googleSiteVerification } } : {}),
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      locale: intlLocaleFor(locale).replace("-", "_"),
      ...(ogImage ? { images: [{ url: ogImage, alt: store.name }] } : {}),
    },
  };
}

/**
 * Wraps every page of one store. It establishes:
 *  - the merchant's brand colours as CSS custom properties, so the whole
 *    subtree (header, buttons, links, badges) picks them up through the
 *    semantic tokens — see the `.brand-theme` block in globals.css;
 *  - the store theme, when the merchant picked one: `data-store-theme` on the
 *    wrapper switches on that theme's palette, type, shapes and hero layout
 *    (globals.css "Store themes"), and the small stylesheet beside it holds
 *    the themes' self-hosted font stacks (app/themeFonts.ts; the editor's
 *    preview page renders it too, for switching). Without a theme the store
 *    renders exactly as it did before themes existed;
 *  - the store's link prefix, resolved once for the client components below it,
 *    since only a server component can tell how the request arrived;
 *  - the store language: `lang`/`dir` on this wrapper, mirrored onto <html> by
 *    <DocumentLocale> because the root layout can't know which store a request
 *    is for;
 *  - the shared header/footer, so every page of the store — including one the
 *    merchant built in the website editor — sits under the same branding.
 *    Funnel pages (`/f/…`) are the exception: they draw their own masthead,
 *    so HideInFunnel leaves these two out there;
 *  - the side navigation, for a store that chose it (StoreNavFrame): from
 *    `xl` a column beside everything below. Any other store, and every store
 *    while lib/features has it off, gets exactly what this layout drew before;
 *  - the store's own analytics (StoreAnalytics): one page_view per navigation
 *    for every page of the store, funnel pages included — the funnel layout
 *    nests inside this one, so it deliberately doesn't mount it again. An
 *    unavailable store renders none of this, so it is never tracked.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [state, basePath] = await Promise.all([
    getStoreState(workspaceId),
    getStoreBasePath(workspaceId),
  ]);
  // Suspended, or unpaid past its grace day: every page of the store is the
  // "currently unavailable" page, and none of the store's own content.
  if (state.kind === "unavailable") {
    const locale = await getStoreLocale(localeSource(state.store));
    return <StoreUnavailable store={state.store} locale={locale} />;
  }
  if (state.kind !== "ok") notFound();
  const store = state.store;

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const collections = await getStoreCollections(workspaceId);
  const info: StoreInfo = {
    workspaceId,
    id: store.id,
    slug: store.slug,
    name: store.name,
    currency: store.currency,
    // Where the symbol goes and whether decimals show (dashboard → currencies; lib/moneyFormat).
    currencyFormat: (store as { currencyFormat?: StoreInfo["currencyFormat"] }).currencyFormat ?? null,
    logoUrl: store.logoUrl,
    phone: storePhone(store),
    // Offered languages: French joins the language switch when it is one (lib/i18n switchLocales).
    languages: (store as { languages?: string[] }).languages ?? [],
    // Re-resolved rather than trusted: an older API without `checkout` must
    // still give the forms the defaults.
    checkout: { ...resolveCheckoutSettings(store.checkout), form: resolveCheckoutForm(store.checkout) } as ReturnType<typeof resolveCheckoutSettings>,
    thankYou: resolveThankYouPage((store as { thankYou?: unknown }).thankYou),
    legal: storefrontDesignMeta(store).legal,
    orderBump: store.orderBump ?? null,
    // The order form's country (lib/storeCountry).
    country: storefrontGeneralMeta(store).general.country,
    // Self delivery: served governorates (and more as the API grows it); absent from older APIs.
    delivery: (store as { delivery?: StoreInfo["delivery"] }).delivery ?? null,
    // A store on holiday, as the API names it (lib/storeHoliday reads it only while the feature is on).
    holiday: storefrontHolidayOf(store),
  };
  // GET /store/:workspaceId doesn't name a websiteId yet; read it defensively
  // so events carry it as soon as the API sends one.
  const websiteId = (store as { websiteId?: unknown }).websiteId;
  const theme = storeThemeOf(store.themeSettings);
  // The merchant's ad pixels (dashboard → Marketing), loaded only when one is set.
  const pixels = storePixelsOf(store);
  const { floatingWhatsapp } = storefrontGeneralMeta(store);

  return (
    <StoreRouteProvider basePath={basePath}>
      <StoreContextProvider locale={locale} store={info}>
        {/* Holds the editor preview's unsaved header/footer settings; empty,
            and so invisible, on every page a shopper sees. */}
        <StoreShellProvider>
          {/* Reads the search params, hence the Suspense boundary. */}
          <Suspense fallback={null}>
            <StoreAnalytics workspaceId={workspaceId} websiteId={typeof websiteId === "string" ? websiteId : undefined} />
            <BotGuard workspaceId={workspaceId} />
            <OtpGate />
          </Suspense>
          {pixels.length > 0 && (
            // Reads the search params to send page views on navigation.
            <Suspense fallback={null}>
              <TrackingPixels pixels={pixels} purchaseTiming={purchaseTimingOf(store)} />
            </Suspense>
          )}
          {/* suppressHydrationWarning: the editor's preview page puts its
              unsaved theme on this element before hydrating (brandTheme.ts
              previewBootScript); a live store never changes it. */}
          <div
            lang={intlLocaleFor(locale)}
            dir={dirFor(locale)}
            className="brand-theme flex min-h-full flex-1 flex-col bg-paper font-sans text-ink"
            style={brandStyle(store.themeSettings)}
            data-store-theme={theme ?? undefined}
            suppressHydrationWarning
          >
            {theme && <style dangerouslySetInnerHTML={{ __html: THEME_FONT_CSS }} />}
            <DocumentLocale locale={locale} />
            <StoreNavFrame store={store} locale={locale} collections={collections}>
              <PaymentsPreviewBanner workspaceId={workspaceId} />
              {/* The band across the top while the store is on holiday; on funnel pages too (HOLIDAY_MODE_ENABLED). */}
              <HolidayBanner />
              {/* A friend's invite from a `?ref=` link, above the store (lib/features); funnel pages keep their own path. */}
              {CUSTOMER_REFERRALS_ENABLED && (
                <HideInFunnel>
                  <InviteBanner />
                </HideInFunnel>
              )}
              <HideInFunnel>
                <StoreHeader store={store} locale={locale} />
                <MobileCategoryStrip collections={collections} t={t} />
              </HideInFunnel>
              <div className="flex flex-1 flex-col">{children}</div>
              <HideInFunnel>
                {/* The merchant's sign-up form: a band above the footer, or a popup (Offers → Newsletter). */}
                <NewsletterSignup workspaceId={store.id} />
                <StoreFooter store={store} locale={locale} year={new Date().getFullYear()} />
                {/* The slide-over cart: opened by "add to cart" and the header's
                    cart icon. Funnel pages have no cart, so it steps aside with
                    the rest of the store's chrome. */}
                <CartDrawer />
                {/* The merchant's exit popup, once per visitor (Offers → Exit popup). */}
                <ExitDownsell workspaceId={store.id} />
                {/* Sales notifications from real orders (Offers → Sales notifications). */}
                <SocialProofPopup workspaceId={store.id} />
                {floatingWhatsapp && <FloatingWhatsapp phone={floatingWhatsapp.phone} message={floatingWhatsapp.message} />}
              </HideInFunnel>
              {/* Remembers a ?coupon=CODE link so a checkout applies it — the store's or a funnel's. */}
              <CouponFromLink workspaceId={workspaceId} />
              <BackToTop label={t.common.backToTop} />
              {/* The store as an app for shoppers (Settings → Store app). */}
              <StoreAppInstall app={storefrontStoreApp(store)} locale={arOrEn(locale)} />
              {/* The phone toolbar and floating buttons a store can switch on (themeSettings). */}
              <ThemeChrome store={store} />
            </StoreNavFrame>
          </div>
        </StoreShellProvider>
      </StoreContextProvider>
    </StoreRouteProvider>
  );
}
