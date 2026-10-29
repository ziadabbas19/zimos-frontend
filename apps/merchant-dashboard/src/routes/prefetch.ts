/**
 * One prefetch loader per code-split page, keyed by the route prefix it
 * serves (lib/prefetch.ts). The import() strings are the same ones App.tsx
 * uses, so Vite serves one chunk for both. Imported once from main.tsx.
 *
 * A page behind a feature switch (lib/features) is registered only while the
 * switch is on: off, its code is never asked for.
 *
 * On a page load (this module is evaluated before App.tsx) the code of the
 * page asked for, and of the dashboard's frame when signed in, is fetched at
 * once, alongside the bootstrap, instead of once the account is read. Then,
 * when signed in, the pages that came with the main bundle before it was
 * split (WARM_UP) are fetched while the browser is idle.
 */
import { apiClient } from "@/lib/apiClient";
import {
  AI_ENABLED,
  BLOG_ENABLED,
  CUSTOMER_REFERRALS_ENABLED,
  GIFT_CARDS_ENABLED,
  LOYALTY_ENABLED,
  PRODUCT_QUESTIONS_ENABLED,
  PRODUCT_SPECS_ENABLED,
  SIZE_CHARTS_ENABLED,
  STORE_CREDIT_ENABLED,
  STORE_REPORTS_ENABLED,
  VIP_TIERS_ENABLED,
} from "@/lib/features";
import { prefetchRoute, registerPrefetch, warmUpWhenIdle } from "@/lib/prefetch";

/** The dashboard's frame and the editors' (App.tsx loads them lazily through these). */
export const loadDashboardLayout = () => import("@/components/DashboardLayout");
export const loadEditorLayout = () => import("@/components/EditorLayout");

registerPrefetch("/login", () => import("@/pages/LoginPage"));
registerPrefetch("/register", () => import("@/pages/RegisterPage"));
registerPrefetch("/auth/callback", () => import("@/pages/AuthCallbackPage"));
registerPrefetch("/forgot-password", () => import("@/pages/ForgotPasswordPage"));
registerPrefetch("/reset-password", () => import("@/pages/ResetPasswordPage"));
registerPrefetch("/verify-email", () => import("@/pages/VerifyEmailPage"));
registerPrefetch("/invites", () => import("@/pages/InviteAcceptPage"));
registerPrefetch("/choose-username", () => import("@/pages/ChooseUsernamePage"));
registerPrefetch("/choose-plan", () => import("@/pages/ChoosePlanPage"));
registerPrefetch("/workspaces", () => import("@/pages/WorkspacePickerPage"));

registerPrefetch("/", () => import("@/pages/DashboardHomePage"));
registerPrefetch("/orders", () => import("@/pages/orders/OrdersListPage"));
registerPrefetch("/orders/new", () => import("@/pages/orders/ManualOrderPage"));
registerPrefetch("/orders/board", () => import("@/pages/orders/OrderBoardPage"));
registerPrefetch("/confirmation-queue", () => import("@/pages/confirmation/ConfirmationQueuePage"));
registerPrefetch("/fraud", () => import("@/pages/fraud/FraudPage"));
registerPrefetch("/returns", () => import("@/pages/returns/ReturnsPage"));
registerPrefetch("/abandoned-carts", () => import("@/pages/abandoned/LostOrdersPage"));
registerPrefetch("/catalog", () => import("@/pages/catalog/CatalogProductsPage"));
registerPrefetch("/catalog/collections", () => import("@/pages/catalog/CollectionsPage"));
registerPrefetch("/catalog/new", () => import("@/pages/catalog/ProductEditPage"));
registerPrefetch("/reviews", () => import("@/pages/reviews/ReviewsPage"));
registerPrefetch("/customers", () => import("@/pages/customers/ContactsPage"));
registerPrefetch("/form-submissions", () => import("@/pages/customers/FormSubmissionsPage"));
registerPrefetch("/digital", () => import("@/pages/digital/DigitalProductsPage"));
registerPrefetch("/services", () => import("@/pages/services/ServicesPage"));
registerPrefetch("/shoppable-images", () => import("@/pages/shoppable/ShoppableImagesPage"));
registerPrefetch("/courses", () => import("@/pages/courses/CoursesPage"));
registerPrefetch("/discounts", () => import("@/pages/discounts/DiscountsPage"));
registerPrefetch("/offers", () => import("@/pages/offers/OffersPage"));
registerPrefetch("/offers/bundles", () => import("@/pages/offers/BundlesPage"));
registerPrefetch("/offers/order-bumps", () => import("@/pages/offers/OrderBumpsPage"));
registerPrefetch("/offers/upsells", () => import("@/pages/offers/OrderBumpsPage"));
registerPrefetch("/offers/cross-sell", () => import("@/pages/offers/CrossSellPage"));
registerPrefetch("/offers/exit-popup", () => import("@/pages/offers/ExitDownsellPage"));
registerPrefetch("/offers/order-rules", () => import("@/pages/offers/OrderRulesPage"));
registerPrefetch("/offers/social-proof", () => import("@/pages/offers/EngagementPages"));
registerPrefetch("/offers/newsletter", () => import("@/pages/offers/EngagementPages"));
registerPrefetch("/offers/referrals", () => import("@/pages/offers/EngagementPages"));
registerPrefetch("/offers/feed", () => import("@/pages/offers/ProductFeedPage"));
registerPrefetch("/shipping", () => import("@/pages/shipping/ShippingTaxPage"));
registerPrefetch("/payments", () => import("@/pages/payments/PaymentsPage"));
registerPrefetch("/website", () => import("@/pages/website/WebsitePage"));
registerPrefetch("/subscription", () => import("@/pages/subscription/SubscriptionPage"));
registerPrefetch("/settings", () => import("@/pages/settings/SettingsPage"));
registerPrefetch("/support", () => import("@/pages/support/SupportPage"));
registerPrefetch("/suggestions", () => import("@/pages/help/SuggestionsPage"));

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
if (PRODUCT_QUESTIONS_ENABLED) registerPrefetch("/questions", () => import("@/pages/questions/QuestionsPage"));
if (PRODUCT_SPECS_ENABLED) registerPrefetch("/catalog/specifications", () => import("@/pages/productSpecs/SpecKeysPage"));
if (SIZE_CHARTS_ENABLED) registerPrefetch("/size-charts", () => import("@/pages/sizeCharts/SizeChartsPage"));
if (STORE_CREDIT_ENABLED) registerPrefetch("/store-credit", () => import("@/pages/storeCredit/StoreCreditPage"));
if (STORE_REPORTS_ENABLED) registerPrefetch("/analytics/reports", () => import("@/pages/analytics/storeReports/StoreReportPage"));
if (VIP_TIERS_ENABLED) registerPrefetch("/loyalty/vip", () => import("@/pages/vipTiers/VipTiersPage"));

/**
 * The frame and the pages that came with the main bundle before every page
 * was split (App.tsx), fetched while idle once a signed-in page has loaded.
 * The editors and the screens split before stay as they were: fetched only
 * when opened, or on hover.
 */
export const WARM_UP: Array<() => Promise<unknown>> = [
  loadDashboardLayout,
  loadEditorLayout,
  () => import("@/pages/DashboardHomePage"),
  () => import("@/pages/orders/OrdersListPage"),
  () => import("@/pages/orders/OrderDetailPage"),
  () => import("@/pages/catalog/CatalogProductsPage"),
  () => import("@/pages/catalog/ProductEditPage"),
  () => import("@/pages/confirmation/ConfirmationQueuePage"),
  () => import("@/pages/customers/ContactsPage"),
  () => import("@/pages/customers/CustomerDetailPage"),
  () => import("@/pages/settings/SettingsPage"),
  () => import("@/pages/subscription/SubscriptionPage"),
  () => import("@/pages/orders/ManualOrderPage"),
  () => import("@/pages/orders/OrderBoardPage"),
  () => import("@/pages/orders/ShipmentBatchPage"),
  () => import("@/pages/exports/ExportFilePage"),
  () => import("@/pages/returns/ReturnsPage"),
  () => import("@/pages/abandoned/LostOrdersPage"),
  () => import("@/pages/fraud/FraudPage"),
  () => import("@/pages/reviews/ReviewsPage"),
  () => import("@/pages/catalog/CollectionsPage"),
  () => import("@/pages/customers/FormSubmissionsPage"),
  () => import("@/pages/digital/DigitalProductsPage"),
  () => import("@/pages/services/ServicesPage"),
  () => import("@/pages/shoppable/ShoppableImagesPage"),
  () => import("@/pages/courses/CoursesPage"),
  () => import("@/pages/discounts/DiscountsPage"),
  () => import("@/pages/offers/OffersPage"),
  () => import("@/pages/offers/BundlesPage"),
  () => import("@/pages/offers/OrderBumpsPage"),
  () => import("@/pages/offers/CrossSellPage"),
  () => import("@/pages/offers/ExitDownsellPage"),
  () => import("@/pages/offers/OrderRulesPage"),
  () => import("@/pages/offers/EngagementPages"),
  () => import("@/pages/offers/ProductFeedPage"),
  () => import("@/pages/shipping/ShippingTaxPage"),
  () => import("@/pages/payments/PaymentsPage"),
  () => import("@/pages/website/WebsitePage"),
  () => import("@/pages/support/SupportPage"),
  () => import("@/pages/help/SuggestionsPage"),
  () => import("@/pages/WorkspacePickerPage"),
  () => import("@/pages/NotFoundPage"),
];

// The first page of this load: its code and, signed in, the frame's, now.
if (typeof window !== "undefined") {
  const signedIn = apiClient.isAuthenticated();
  if (signedIn) loadDashboardLayout().catch(() => undefined);
  prefetchRoute(window.location.pathname, { exact: true });
  if (signedIn) warmUpWhenIdle(WARM_UP);
}
