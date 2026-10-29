/**
 * One prefetch loader per code-split page, keyed by the route prefix it
 * serves (lib/prefetch.ts). The import() strings are the same ones App.tsx
 * uses, so Vite serves one chunk for both. Imported once from main.tsx.
 *
 * A page behind a feature switch (lib/features) is registered only while the
 * switch is on: off, its code is never asked for.
 */
import {
  AI_ENABLED,
  BLOG_ENABLED,
  CUSTOMER_REFERRALS_ENABLED,
  GIFT_CARDS_ENABLED,
  LOYALTY_ENABLED,
  PRODUCT_COMBOS_ENABLED,
  PRODUCT_QUESTIONS_ENABLED,
  PRODUCT_SPECS_ENABLED,
  SIZE_CHARTS_ENABLED,
  STORE_CREDIT_ENABLED,
  STORE_REPORTS_ENABLED,
  VIP_TIERS_ENABLED,
} from "@/lib/features";
import { registerPrefetch } from "@/lib/prefetch";

registerPrefetch("/activity", () => import("@/pages/activity/ActivityLogPage"));
registerPrefetch("/ads", () => import("@/pages/ads/AdsPage"));
registerPrefetch("/analytics", () => import("@/pages/analytics/reports/ReportsPage"));
registerPrefetch("/analytics/attribution", () => import("@/pages/analytics/AttributionPage"));
registerPrefetch("/analytics/realtime", () => import("@/pages/analytics/RealtimePage"));
registerPrefetch("/analytics/summary", () => import("@/pages/analytics/AnalyticsPage"));
registerPrefetch("/analytics/web", () => import("@/pages/analytics/WebAnalyticsPage"));
registerPrefetch("/automations", () => import("@/pages/automations/AutomationsPage"));
registerPrefetch("/funnels", () => import("@/pages/funnels/FunnelsPage"));
registerPrefetch("/inbox", () => import("@/pages/inbox/InboxPage"));
registerPrefetch("/marketing", () => import("@/pages/marketing/MarketingPage"));
registerPrefetch("/media", () => import("@/pages/media/MediaLibraryPage"));
registerPrefetch("/profit", () => import("@/pages/profit/RealProfitPage"));
registerPrefetch("/profit/costs", () => import("@/pages/profit/ProfitCostsPage"));
registerPrefetch("/settlements", () => import("@/pages/settlements/SettlementsPage"));
registerPrefetch("/store-settings", () => import("@/pages/storeDesign/StoreDesignPage"));

if (AI_ENABLED) registerPrefetch("/ai", () => import("@/pages/ai/AiStudioPage"));
if (AI_ENABLED) registerPrefetch("/inbox/bot", () => import("@/pages/inbox/WaBotPage"));
if (BLOG_ENABLED) registerPrefetch("/blog", () => import("@/pages/blog/BlogPostsPage"));
if (BLOG_ENABLED) registerPrefetch("/blog/categories", () => import("@/pages/blog/BlogCategoriesPage"));
if (CUSTOMER_REFERRALS_ENABLED) registerPrefetch("/loyalty/referrals", () => import("@/pages/customerReferrals/ReferAFriendPage"));
if (GIFT_CARDS_ENABLED) registerPrefetch("/gift-cards", () => import("@/pages/giftCards/GiftCardsPage"));
if (LOYALTY_ENABLED) registerPrefetch("/loyalty", () => import("@/pages/loyalty/LoyaltyProgramPage"));
if (PRODUCT_COMBOS_ENABLED) registerPrefetch("/offers/combos", () => import("@/pages/offers/CombosPage"));
if (PRODUCT_QUESTIONS_ENABLED) registerPrefetch("/questions", () => import("@/pages/questions/QuestionsPage"));
if (PRODUCT_SPECS_ENABLED) registerPrefetch("/catalog/specifications", () => import("@/pages/productSpecs/SpecKeysPage"));
if (SIZE_CHARTS_ENABLED) registerPrefetch("/size-charts", () => import("@/pages/sizeCharts/SizeChartsPage"));
if (STORE_CREDIT_ENABLED) registerPrefetch("/store-credit", () => import("@/pages/storeCredit/StoreCreditPage"));
if (STORE_REPORTS_ENABLED) registerPrefetch("/analytics/reports", () => import("@/pages/analytics/storeReports/StoreReportPage"));
if (VIP_TIERS_ENABLED) registerPrefetch("/loyalty/vip", () => import("@/pages/vipTiers/VipTiersPage"));
