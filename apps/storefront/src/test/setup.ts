import { vi } from "vitest";
import { registerDictionary, type Locale } from "@/lib/i18n";
import { ALL_DICTIONARIES } from "@/lib/i18nAll";

// Every language at hand, as on the server; a browser fetches its own as a chunk (lib/dictionaryChunks.tsx).
for (const [locale, dictionary] of Object.entries(ALL_DICTIONARIES)) registerDictionary(locale as Locale, dictionary);

// react-dom/server's renderToStaticMarkup cannot wait for a chunk either, and with every language here there is none to wait for.
vi.mock("@/lib/dictionaryChunks", async (original) => ({
  ...(await original<typeof import("@/lib/dictionaryChunks")>()),
  DictionaryChunk: () => null,
}));

/**
 * The imported templates' interactive parts are split into chunks with
 * next/dynamic (components/page-renderer/lazy.tsx). Next's own server render
 * draws them in full; react-dom/server's renderToStaticMarkup, which these
 * tests render with, cannot wait for a chunk and draws nothing in their place.
 * So the tests get the parts themselves — the markup a shopper's page has.
 */
vi.mock("@/components/page-renderer/lazy", async () => {
  const [slider, grid, quotes, countdown, newsletter, contact, stack, journey, reels, ...others] = await Promise.all([
    import("@/components/page-renderer/xs/XsSlider"),
    import("@/components/page-renderer/xs/XsProductGrid"),
    import("@/components/page-renderer/xs/XsQuotes"),
    import("@/components/page-renderer/xs/XsCountdown"),
    import("@/components/page-renderer/xs/XsNewsletterForm"),
    import("@/components/page-renderer/xs/XsContactForm"),
    import("@/components/page-renderer/xs/XsStack"),
    import("@/components/page-renderer/xs/XsJourney"),
    import("@/components/page-renderer/xs/XsReels"),
    import("@/components/product/ProductLanding"),
    import("@/components/product/ProductReviews"),
    import("@/components/ShoppableImageView"),
    import("@/components/funnel/FunnelCodForm"),
    import("@/components/page-renderer/CartSummary"),
    import("@/components/page-renderer/GallerySlideshow"),
    import("@/components/page-renderer/StoryGallery"),
    import("@/components/page-renderer/PageForm"),
    import("@/components/page-renderer/builderClient"),
    import("@/components/page-renderer/builderExtrasClient"),
    import("@/components/page-renderer/builderMoreClient"),
    import("@/components/page-renderer/showcase/HeroSlider"),
    import("@/components/page-renderer/showcase/NeedTabs"),
    import("@/components/page-renderer/showcase/ProductTabs"),
    import("@/components/page-renderer/showcase/RailTrack"),
    import("@/components/page-renderer/showcase/ReelsTrack"),
    import("@/components/page-renderer/showcase/ShelfRail"),
  ]);
  return {
    ...Object.assign({}, ...others),
    XsSlider: slider.XsSlider,
    XsProductGrid: grid.XsProductGrid,
    XsQuotes: quotes.XsQuotes,
    XsCountdown: countdown.XsCountdown,
    XsNewsletterForm: newsletter.XsNewsletterForm,
    XsContactForm: contact.XsContactForm,
    XsStack: stack.XsStack,
    XsJourney: journey.XsJourney,
    XsReels: reels.XsReels,
  };
});

/** The same for the immersive part a template's band draws: the clothing rail (`xs_rail`). */
vi.mock("@/components/immersive/lazy", async (importOriginal) => {
  const [actual, rail] = await Promise.all([importOriginal<typeof import("@/components/immersive/lazy")>(), import("@/components/immersive/ClothingRail")]);
  return { ...actual, ClothingRail: rail.ClothingRail };
});
