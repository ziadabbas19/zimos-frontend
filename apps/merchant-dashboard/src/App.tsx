import { lazy } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { AppearanceSync } from "@/components/AppearanceSync";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { LazyRoute } from "@/routes/LazyRoute";
import { RouteCommitSignal } from "@/lib/viewTransition";
import { UnsavedGuardProvider } from "@/lib/useUnsavedGuard";
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
import { REWARDS_HOME } from "@/pages/loyalty/RewardsTabs";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ChooseUsernamePage } from "@/pages/ChooseUsernamePage";
import { ChoosePlanPage } from "@/pages/ChoosePlanPage";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { ConfirmEmailDialog } from "@/components/ConfirmEmailDialog";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { WorkspacePickerPage } from "@/pages/WorkspacePickerPage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EditorLayout } from "@/components/EditorLayout";
import { DashboardHomePage } from "@/pages/DashboardHomePage";
import { CatalogProductsPage } from "@/pages/catalog/CatalogProductsPage";
import { CollectionsPage } from "@/pages/catalog/CollectionsPage";
import { ProductEditPage } from "@/pages/catalog/ProductEditPage";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { OrderDetailPage } from "@/pages/orders/OrderDetailPage";
import { ManualOrderPage } from "@/pages/orders/ManualOrderPage";
import { ShipmentBatchPage } from "@/pages/orders/ShipmentBatchPage";
import { ExportFilePage } from "@/pages/exports/ExportFilePage";
import { OrderBoardPage } from "@/pages/orders/OrderBoardPage";
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { LostOrdersPage } from "@/pages/abandoned/LostOrdersPage";
import { FraudPage } from "@/pages/fraud/FraudPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { ContactsPage } from "@/pages/customers/ContactsPage";
import { FormSubmissionsPage } from "@/pages/customers/FormSubmissionsPage";
import { DigitalProductsPage } from "@/pages/digital/DigitalProductsPage";
import { ServicesPage } from "@/pages/services/ServicesPage";
import { ShoppableImagesPage } from "@/pages/shoppable/ShoppableImagesPage";
import { CoursesPage } from "@/pages/courses/CoursesPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { OffersPage } from "@/pages/offers/OffersPage";
import { BundlesPage } from "@/pages/offers/BundlesPage";
import { OrderBumpsPage, UpsellsPage } from "@/pages/offers/OrderBumpsPage";
import { CrossSellPage } from "@/pages/offers/CrossSellPage";
import { ExitDownsellPage } from "@/pages/offers/ExitDownsellPage";
import { OrderRulesPage } from "@/pages/offers/OrderRulesPage";
import { NewsletterPage, ReferralLinksPage, SocialProofPage } from "@/pages/offers/EngagementPages";
import { ProductFeedPage } from "@/pages/offers/ProductFeedPage";
import { ShippingTaxPage } from "@/pages/shipping/ShippingTaxPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { WebsitePage } from "@/pages/website/WebsitePage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SubscriptionPage } from "@/pages/subscription/SubscriptionPage";
import { SupportPage, SupportTicketPage } from "@/pages/support/SupportPage";
import { SuggestionsPage } from "@/pages/help/SuggestionsPage";

// Analytics screens and the two editors are code-split: their charts, block
// library and preview plumbing load only when a merchant opens them, not
// with every dashboard page.
// The funnel list shares the funnel starters (and so the block library's
// element table) with the funnel editor, so it is split off with it.
const AiStudioPage = lazy(() => import("@/pages/ai/AiStudioPage").then((m) => ({ default: m.AiStudioPage })));
const WaBotPage = lazy(() => import("@/pages/inbox/WaBotPage").then((m) => ({ default: m.WaBotPage })));
const StoreReportPage = lazy(() => import("@/pages/analytics/storeReports/StoreReportPage").then((m) => ({ default: m.StoreReportPage })));
const LoyaltyProgramPage = lazy(() => import("@/pages/loyalty/LoyaltyProgramPage").then((m) => ({ default: m.LoyaltyProgramPage })));
const VipTiersPage = lazy(() => import("@/pages/vipTiers/VipTiersPage").then((m) => ({ default: m.VipTiersPage })));
const ReferAFriendPage = lazy(() => import("@/pages/customerReferrals/ReferAFriendPage").then((m) => ({ default: m.ReferAFriendPage })));
const StoreCreditPage = lazy(() => import("@/pages/storeCredit/StoreCreditPage").then((m) => ({ default: m.StoreCreditPage })));
const GiftCardsPage = lazy(() => import("@/pages/giftCards/GiftCardsPage").then((m) => ({ default: m.GiftCardsPage })));
const GiftCardDetailPage = lazy(() => import("@/pages/giftCards/GiftCardDetailPage").then((m) => ({ default: m.GiftCardDetailPage })));
const BlogPostsPage = lazy(() => import("@/pages/blog/BlogPostsPage").then((m) => ({ default: m.BlogPostsPage })));
const BlogPostEditorPage = lazy(() => import("@/pages/blog/BlogPostEditorPage").then((m) => ({ default: m.BlogPostEditorPage })));
const BlogCategoriesPage = lazy(() => import("@/pages/blog/BlogCategoriesPage").then((m) => ({ default: m.BlogCategoriesPage })));
const SizeChartsPage = lazy(() => import("@/pages/sizeCharts/SizeChartsPage").then((m) => ({ default: m.SizeChartsPage })));
const SizeChartEditorPage = lazy(() => import("@/pages/sizeCharts/SizeChartEditorPage").then((m) => ({ default: m.SizeChartEditorPage })));
const QuestionsPage = lazy(() => import("@/pages/questions/QuestionsPage").then((m) => ({ default: m.QuestionsPage })));
const ProductLinkRedirect = lazy(() => import("@/pages/questions/ProductQuestionsSection").then((m) => ({ default: m.ProductLinkRedirect })));
const SpecKeysPage = lazy(() => import("@/pages/productSpecs/SpecKeysPage").then((m) => ({ default: m.SpecKeysPage })));
const ActivityLogPage = lazy(() => import("@/pages/activity/ActivityLogPage").then((m) => ({ default: m.ActivityLogPage })));
const FunnelsPage = lazy(() => import("@/pages/funnels/FunnelsPage").then((m) => ({ default: m.FunnelsPage })));
const FunnelEditorPage = lazy(() =>
  import("@/pages/funnels/FunnelEditorPage").then((m) => ({ default: m.FunnelEditorPage }))
);
const WebsiteEditorPage = lazy(() =>
  import("@/pages/website/editor/WebsiteEditorPage").then((m) => ({ default: m.WebsiteEditorPage }))
);
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() =>
  import("@/pages/analytics/reports/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const WebAnalyticsPage = lazy(() =>
  import("@/pages/analytics/WebAnalyticsPage").then((m) => ({ default: m.WebAnalyticsPage }))
);
const RealtimePage = lazy(() => import("@/pages/analytics/RealtimePage").then((m) => ({ default: m.RealtimePage })));
const FunnelAnalyticsPage = lazy(() =>
  import("@/pages/analytics/FunnelAnalyticsPage").then((m) => ({ default: m.FunnelAnalyticsPage }))
);
const AttributionPage = lazy(() =>
  import("@/pages/analytics/AttributionPage").then((m) => ({ default: m.AttributionPage }))
);
const SettlementsPage = lazy(() =>
  import("@/pages/settlements/SettlementsPage").then((m) => ({ default: m.SettlementsPage }))
);
const InboxPage = lazy(() => import("@/pages/inbox/InboxPage").then((m) => ({ default: m.InboxPage })));
const AutomationsPage = lazy(() =>
  import("@/pages/automations/AutomationsPage").then((m) => ({ default: m.AutomationsPage }))
);
const MarketingPage = lazy(() => import("@/pages/marketing/MarketingPage").then((m) => ({ default: m.MarketingPage })));
const ProfitPage = lazy(() => import("@/pages/profit/RealProfitPage").then((m) => ({ default: m.RealProfitPage })));
const ProfitCostsPage = lazy(() =>
  import("@/pages/profit/ProfitCostsPage").then((m) => ({ default: m.ProfitCostsPage }))
);
const AdsPage = lazy(() => import("@/pages/ads/AdsPage").then((m) => ({ default: m.AdsPage })));
const StoreDesignPage = lazy(() =>
  import("@/pages/storeDesign/StoreDesignPage").then((m) => ({ default: m.StoreDesignPage }))
);
const MediaLibraryPage = lazy(() =>
  import("@/pages/media/MediaLibraryPage").then((m) => ({ default: m.MediaLibraryPage }))
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Tells a running view transition that the next page is in the DOM (lib/viewTransition.ts). */}
      <RouteCommitSignal />
      <LocaleProvider>
        <AuthProvider>
          {/* The signed-in account's look, followed from one device to another (lib/appearanceSync). */}
          <AppearanceSync />
          <WorkspaceProvider>
            <ToastProvider>
              {/* Asks before a link, a reload or a closed tab drops unsaved changes (lib/useUnsavedGuard). */}
              <UnsavedGuardProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/choose-username" element={<ChooseUsernamePage />} />
                  <Route path="/choose-plan" element={<ChoosePlanPage />} />
                  <Route path="/workspaces" element={<WorkspacePickerPage />} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<DashboardHomePage />} />

                      <Route path="/orders" element={<OrdersListPage />} />
                      <Route path="/orders/new" element={<ManualOrderPage />} />
                      <Route path="/orders/board" element={<OrderBoardPage />} />
                      <Route path="/orders/shipment-batches/:batchId" element={<ShipmentBatchPage />} />
                      <Route path="/exports/:exportId" element={<ExportFilePage />} />
                      <Route path="/orders/:orderId" element={<OrderDetailPage />} />

                      <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                      <Route path="/fraud" element={<FraudPage />} />
                      <Route path="/returns" element={<ReturnsPage />} />
                      <Route path="/abandoned-carts" element={<LostOrdersPage />} />

                      <Route path="/catalog" element={<CatalogProductsPage />} />
                      <Route path="/catalog/collections" element={<CollectionsPage />} />
                      <Route path="/catalog/new" element={<ProductEditPage />} />
                      <Route path="/catalog/:productId" element={<ProductEditPage />} />

                      <Route path="/reviews" element={<ReviewsPage />} />
                      {/* Size charts, shoppers' questions and the specifications list (lib/features): off, these addresses go home. */}
                      <Route path="/size-charts" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/size-charts/new" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/size-charts/:chartId" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/questions" element={PRODUCT_QUESTIONS_ENABLED ? <LazyRoute><QuestionsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/products/:productId" element={PRODUCT_QUESTIONS_ENABLED ? <LazyRoute><ProductLinkRedirect /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/catalog/specifications" element={PRODUCT_SPECS_ENABLED ? <LazyRoute><SpecKeysPage /></LazyRoute> : <Navigate to="/catalog" replace />} />
                      <Route path="/customers" element={<ContactsPage />} />
                      <Route path="/form-submissions" element={<FormSubmissionsPage />} />
                      <Route path="/digital" element={<DigitalProductsPage />} />
                      <Route path="/services" element={<ServicesPage />} />
                      <Route path="/shoppable-images" element={<ShoppableImagesPage />} />
                      <Route path="/courses" element={<CoursesPage />} />
                      <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                      <Route path="/discounts" element={<DiscountsPage />} />
                      {/* Gift cards and the store blog (lib/features): off, these addresses go home. */}
                      {/* Loyalty & rewards: each programme only while it is switched on; an address that is off opens the first that is on. */}
                      <Route path="/loyalty" element={LOYALTY_ENABLED ? <LazyRoute><LoyaltyProgramPage /></LazyRoute> : <Navigate to={REWARDS_HOME ?? "/"} replace />} />
                      <Route path="/loyalty/vip" element={VIP_TIERS_ENABLED ? <LazyRoute><VipTiersPage /></LazyRoute> : <Navigate to={REWARDS_HOME ?? "/"} replace />} />
                      <Route path="/loyalty/referrals" element={CUSTOMER_REFERRALS_ENABLED ? <LazyRoute><ReferAFriendPage /></LazyRoute> : <Navigate to={REWARDS_HOME ?? "/"} replace />} />
                      <Route path="/store-credit" element={STORE_CREDIT_ENABLED ? <LazyRoute><StoreCreditPage /></LazyRoute> : <Navigate to={REWARDS_HOME ?? "/"} replace />} />
                      <Route path="/gift-cards" element={GIFT_CARDS_ENABLED ? <LazyRoute><GiftCardsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/gift-cards/:giftCardId" element={GIFT_CARDS_ENABLED ? <LazyRoute><GiftCardDetailPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/blog" element={BLOG_ENABLED ? <LazyRoute><BlogPostsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/blog/new" element={BLOG_ENABLED ? <LazyRoute><BlogPostEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/blog/categories" element={BLOG_ENABLED ? <LazyRoute><BlogCategoriesPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/blog/:postId" element={BLOG_ENABLED ? <LazyRoute><BlogPostEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/offers" element={<OffersPage />} />
                      <Route path="/offers/bundles" element={<BundlesPage />} />
                      <Route path="/offers/order-bumps" element={<OrderBumpsPage />} />
                      <Route path="/offers/cross-sell" element={<CrossSellPage />} />
                      <Route path="/offers/upsells" element={<UpsellsPage />} />
                      <Route path="/offers/exit-popup" element={<ExitDownsellPage />} />
                      <Route path="/offers/order-rules" element={<OrderRulesPage />} />
                      <Route path="/offers/social-proof" element={<SocialProofPage />} />
                      <Route path="/offers/newsletter" element={<NewsletterPage />} />
                      <Route path="/offers/referrals" element={<ReferralLinksPage />} />
                      <Route path="/offers/feed" element={<ProductFeedPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><ReportsPage /></LazyRoute>} />
                      {/* The store reports (tax, stock value, slow stock, order times…): only while switched on (lib/features). */}
                      <Route
                        path="/analytics/reports/:report?"
                        element={STORE_REPORTS_ENABLED ? <LazyRoute><StoreReportPage /></LazyRoute> : <Navigate to="/analytics" replace />}
                      />
                      <Route path="/analytics/summary" element={<LazyRoute><AnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/web" element={<LazyRoute><WebAnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/attribution" element={<LazyRoute><AttributionPage /></LazyRoute>} />
                      <Route path="/analytics/realtime" element={<LazyRoute><RealtimePage /></LazyRoute>} />
                      <Route
                        path="/analytics/funnels/:funnelId"
                        element={<LazyRoute><FunnelAnalyticsPage /></LazyRoute>}
                      />
                      <Route path="/subscription" element={<SubscriptionPage />} />
                      <Route path="/settlements" element={<LazyRoute><SettlementsPage /></LazyRoute>} />
                      <Route path="/inbox" element={<LazyRoute><InboxPage /></LazyRoute>} />
                      <Route path="/automations" element={<LazyRoute><AutomationsPage /></LazyRoute>} />
                      <Route path="/marketing" element={<LazyRoute><MarketingPage /></LazyRoute>} />
                      <Route path="/profit" element={<LazyRoute><ProfitPage /></LazyRoute>} />
                      <Route path="/profit/costs" element={<LazyRoute><ProfitCostsPage /></LazyRoute>} />
                      <Route path="/ads" element={<LazyRoute><AdsPage /></LazyRoute>} />
                      <Route path="/media" element={<LazyRoute><MediaLibraryPage /></LazyRoute>} />
                      {/* AI features (lib/features): off, these addresses go home. */}
                      <Route path="/ai" element={AI_ENABLED ? <LazyRoute><AiStudioPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/inbox/bot" element={AI_ENABLED ? <LazyRoute><WaBotPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/store-settings" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/store-settings/:tab" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/activity" element={<LazyRoute><ActivityLogPage /></LazyRoute>} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="/support/:ticketId" element={<SupportTicketPage />} />
                      <Route path="/suggestions" element={<SuggestionsPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* Full-screen editors: their own bar instead of the sidebar,
                        still under the access banner (EditorLayout). */}
                    <Route element={<EditorLayout />}>
                      <Route path="/website/:websiteId/edit" element={<LazyRoute><WebsiteEditorPage /></LazyRoute>} />
                      <Route path="/funnels/:funnelId" element={<LazyRoute><FunnelEditorPage /></LazyRoute>} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
              </UnsavedGuardProvider>
              {/* A draft store's subscribe dialog, opened from anywhere (lib/goLive). */}
              <GoLiveDialog />
              {/* The email-confirmation code, above it when both are open (lib/emailConfirm). */}
              <ConfirmEmailDialog />
            </ToastProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
