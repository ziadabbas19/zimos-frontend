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
import { loadDashboardLayout, loadEditorLayout } from "@/routes/prefetch";
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
  VISITORS_ENABLED,
} from "@/lib/features";
import { REWARDS_HOME } from "@/pages/loyalty/RewardsTabs";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { ConfirmEmailDialog } from "@/components/ConfirmEmailDialog";

// Every page is code-split: the first load brings the frame and the page
// asked for, nothing else. The pages that used to come with the main bundle
// are fetched while the browser is idle after that (routes/prefetch.ts), so
// moving to them still shows no loader; the editors and analytics, split
// before, still load only when opened or hovered.
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallbackPage").then((m) => ({ default: m.AuthCallbackPage })));
const ChooseUsernamePage = lazy(() => import("@/pages/ChooseUsernamePage").then((m) => ({ default: m.ChooseUsernamePage })));
const ChoosePlanPage = lazy(() => import("@/pages/ChoosePlanPage").then((m) => ({ default: m.ChoosePlanPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })));
const InviteAcceptPage = lazy(() => import("@/pages/InviteAcceptPage").then((m) => ({ default: m.InviteAcceptPage })));
const WorkspacePickerPage = lazy(() => import("@/pages/WorkspacePickerPage").then((m) => ({ default: m.WorkspacePickerPage })));
const DashboardLayout = lazy(() => loadDashboardLayout().then((m) => ({ default: m.DashboardLayout })));
const EditorLayout = lazy(() => loadEditorLayout().then((m) => ({ default: m.EditorLayout })));
const DashboardHomePage = lazy(() => import("@/pages/DashboardHomePage").then((m) => ({ default: m.DashboardHomePage })));
const CatalogProductsPage = lazy(() => import("@/pages/catalog/CatalogProductsPage").then((m) => ({ default: m.CatalogProductsPage })));
const CollectionsPage = lazy(() => import("@/pages/catalog/CollectionsPage").then((m) => ({ default: m.CollectionsPage })));
const ProductEditPage = lazy(() => import("@/pages/catalog/ProductEditPage").then((m) => ({ default: m.ProductEditPage })));
const OrdersListPage = lazy(() => import("@/pages/orders/OrdersListPage").then((m) => ({ default: m.OrdersListPage })));
const OrderDetailPage = lazy(() => import("@/pages/orders/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const ManualOrderPage = lazy(() => import("@/pages/orders/ManualOrderPage").then((m) => ({ default: m.ManualOrderPage })));
const ShipmentBatchPage = lazy(() => import("@/pages/orders/ShipmentBatchPage").then((m) => ({ default: m.ShipmentBatchPage })));
const ExportFilePage = lazy(() => import("@/pages/exports/ExportFilePage").then((m) => ({ default: m.ExportFilePage })));
const OrderBoardPage = lazy(() => import("@/pages/orders/OrderBoardPage").then((m) => ({ default: m.OrderBoardPage })));
const ConfirmationQueuePage = lazy(() => import("@/pages/confirmation/ConfirmationQueuePage").then((m) => ({ default: m.ConfirmationQueuePage })));
const ReturnsPage = lazy(() => import("@/pages/returns/ReturnsPage").then((m) => ({ default: m.ReturnsPage })));
const LostOrdersPage = lazy(() => import("@/pages/abandoned/LostOrdersPage").then((m) => ({ default: m.LostOrdersPage })));
const FraudPage = lazy(() => import("@/pages/fraud/FraudPage").then((m) => ({ default: m.FraudPage })));
const ReviewsPage = lazy(() => import("@/pages/reviews/ReviewsPage").then((m) => ({ default: m.ReviewsPage })));
const ContactsPage = lazy(() => import("@/pages/customers/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const FormSubmissionsPage = lazy(() => import("@/pages/customers/FormSubmissionsPage").then((m) => ({ default: m.FormSubmissionsPage })));
const DigitalProductsPage = lazy(() => import("@/pages/digital/DigitalProductsPage").then((m) => ({ default: m.DigitalProductsPage })));
const ServicesPage = lazy(() => import("@/pages/services/ServicesPage").then((m) => ({ default: m.ServicesPage })));
const ShoppableImagesPage = lazy(() => import("@/pages/shoppable/ShoppableImagesPage").then((m) => ({ default: m.ShoppableImagesPage })));
const CoursesPage = lazy(() => import("@/pages/courses/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const CustomerDetailPage = lazy(() => import("@/pages/customers/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })));
const DiscountsPage = lazy(() => import("@/pages/discounts/DiscountsPage").then((m) => ({ default: m.DiscountsPage })));
const OffersPage = lazy(() => import("@/pages/offers/OffersPage").then((m) => ({ default: m.OffersPage })));
const BundlesPage = lazy(() => import("@/pages/offers/BundlesPage").then((m) => ({ default: m.BundlesPage })));
const OrderBumpsPage = lazy(() => import("@/pages/offers/OrderBumpsPage").then((m) => ({ default: m.OrderBumpsPage })));
const UpsellsPage = lazy(() => import("@/pages/offers/OrderBumpsPage").then((m) => ({ default: m.UpsellsPage })));
const CrossSellPage = lazy(() => import("@/pages/offers/CrossSellPage").then((m) => ({ default: m.CrossSellPage })));
const ExitDownsellPage = lazy(() => import("@/pages/offers/ExitDownsellPage").then((m) => ({ default: m.ExitDownsellPage })));
const OrderRulesPage = lazy(() => import("@/pages/offers/OrderRulesPage").then((m) => ({ default: m.OrderRulesPage })));
const NewsletterPage = lazy(() => import("@/pages/offers/EngagementPages").then((m) => ({ default: m.NewsletterPage })));
const ReferralLinksPage = lazy(() => import("@/pages/offers/EngagementPages").then((m) => ({ default: m.ReferralLinksPage })));
const SocialProofPage = lazy(() => import("@/pages/offers/EngagementPages").then((m) => ({ default: m.SocialProofPage })));
const ProductFeedPage = lazy(() => import("@/pages/offers/ProductFeedPage").then((m) => ({ default: m.ProductFeedPage })));
const ShippingTaxPage = lazy(() => import("@/pages/shipping/ShippingTaxPage").then((m) => ({ default: m.ShippingTaxPage })));
const PaymentsPage = lazy(() => import("@/pages/payments/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const WebsitePage = lazy(() => import("@/pages/website/WebsitePage").then((m) => ({ default: m.WebsitePage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const SubscriptionPage = lazy(() => import("@/pages/subscription/SubscriptionPage").then((m) => ({ default: m.SubscriptionPage })));
const SupportPage = lazy(() => import("@/pages/support/SupportPage").then((m) => ({ default: m.SupportPage })));
const SupportTicketPage = lazy(() => import("@/pages/support/SupportPage").then((m) => ({ default: m.SupportTicketPage })));
const SuggestionsPage = lazy(() => import("@/pages/help/SuggestionsPage").then((m) => ({ default: m.SuggestionsPage })));

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
const VisitorsPage = lazy(() => import("@/pages/analytics/visitors/VisitorsPage").then((m) => ({ default: m.VisitorsPage })));
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
                <Route path="/login" element={<LazyRoute screen><LoginPage /></LazyRoute>} />
                <Route path="/register" element={<LazyRoute screen><RegisterPage /></LazyRoute>} />
                <Route path="/auth/callback" element={<LazyRoute screen><AuthCallbackPage /></LazyRoute>} />
                <Route path="/forgot-password" element={<LazyRoute screen><ForgotPasswordPage /></LazyRoute>} />
                <Route path="/reset-password" element={<LazyRoute screen><ResetPasswordPage /></LazyRoute>} />
                <Route path="/verify-email" element={<LazyRoute screen><VerifyEmailPage /></LazyRoute>} />
                {/* The link in a team invite email; read signed out, accepted signed in. */}
                <Route path="/invites" element={<LazyRoute screen><InviteAcceptPage /></LazyRoute>} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/choose-username" element={<LazyRoute screen><ChooseUsernamePage /></LazyRoute>} />
                  <Route path="/choose-plan" element={<LazyRoute screen><ChoosePlanPage /></LazyRoute>} />
                  <Route path="/workspaces" element={<LazyRoute screen><WorkspacePickerPage /></LazyRoute>} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<LazyRoute screen><DashboardLayout /></LazyRoute>}>
                      <Route path="/" element={<LazyRoute><DashboardHomePage /></LazyRoute>} />

                      <Route path="/orders" element={<LazyRoute><OrdersListPage /></LazyRoute>} />
                      <Route path="/orders/new" element={<LazyRoute><ManualOrderPage /></LazyRoute>} />
                      <Route path="/orders/board" element={<LazyRoute><OrderBoardPage /></LazyRoute>} />
                      <Route path="/orders/shipment-batches/:batchId" element={<LazyRoute><ShipmentBatchPage /></LazyRoute>} />
                      <Route path="/exports/:exportId" element={<LazyRoute><ExportFilePage /></LazyRoute>} />
                      <Route path="/orders/:orderId" element={<LazyRoute><OrderDetailPage /></LazyRoute>} />

                      <Route path="/confirmation-queue" element={<LazyRoute><ConfirmationQueuePage /></LazyRoute>} />
                      <Route path="/fraud" element={<LazyRoute><FraudPage /></LazyRoute>} />
                      <Route path="/returns" element={<LazyRoute><ReturnsPage /></LazyRoute>} />
                      <Route path="/abandoned-carts" element={<LazyRoute><LostOrdersPage /></LazyRoute>} />

                      <Route path="/catalog" element={<LazyRoute><CatalogProductsPage /></LazyRoute>} />
                      <Route path="/catalog/collections" element={<LazyRoute><CollectionsPage /></LazyRoute>} />
                      <Route path="/catalog/new" element={<LazyRoute><ProductEditPage /></LazyRoute>} />
                      <Route path="/catalog/:productId" element={<LazyRoute><ProductEditPage /></LazyRoute>} />

                      <Route path="/reviews" element={<LazyRoute><ReviewsPage /></LazyRoute>} />
                      {/* Size charts, shoppers' questions and the specifications list (lib/features): off, these addresses go home. */}
                      <Route path="/size-charts" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/size-charts/new" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/size-charts/:chartId" element={SIZE_CHARTS_ENABLED ? <LazyRoute><SizeChartEditorPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/questions" element={PRODUCT_QUESTIONS_ENABLED ? <LazyRoute><QuestionsPage /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/products/:productId" element={PRODUCT_QUESTIONS_ENABLED ? <LazyRoute><ProductLinkRedirect /></LazyRoute> : <Navigate to="/" replace />} />
                      <Route path="/catalog/specifications" element={PRODUCT_SPECS_ENABLED ? <LazyRoute><SpecKeysPage /></LazyRoute> : <Navigate to="/catalog" replace />} />
                      <Route path="/customers" element={<LazyRoute><ContactsPage /></LazyRoute>} />
                      <Route path="/form-submissions" element={<LazyRoute><FormSubmissionsPage /></LazyRoute>} />
                      <Route path="/digital" element={<LazyRoute><DigitalProductsPage /></LazyRoute>} />
                      <Route path="/services" element={<LazyRoute><ServicesPage /></LazyRoute>} />
                      <Route path="/shoppable-images" element={<LazyRoute><ShoppableImagesPage /></LazyRoute>} />
                      <Route path="/courses" element={<LazyRoute><CoursesPage /></LazyRoute>} />
                      <Route path="/customers/:customerId" element={<LazyRoute><CustomerDetailPage /></LazyRoute>} />
                      <Route path="/discounts" element={<LazyRoute><DiscountsPage /></LazyRoute>} />
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
                      <Route path="/offers" element={<LazyRoute><OffersPage /></LazyRoute>} />
                      <Route path="/offers/bundles" element={<LazyRoute><BundlesPage /></LazyRoute>} />
                      <Route path="/offers/order-bumps" element={<LazyRoute><OrderBumpsPage /></LazyRoute>} />
                      <Route path="/offers/cross-sell" element={<LazyRoute><CrossSellPage /></LazyRoute>} />
                      <Route path="/offers/upsells" element={<LazyRoute><UpsellsPage /></LazyRoute>} />
                      <Route path="/offers/exit-popup" element={<LazyRoute><ExitDownsellPage /></LazyRoute>} />
                      <Route path="/offers/order-rules" element={<LazyRoute><OrderRulesPage /></LazyRoute>} />
                      <Route path="/offers/social-proof" element={<LazyRoute><SocialProofPage /></LazyRoute>} />
                      <Route path="/offers/newsletter" element={<LazyRoute><NewsletterPage /></LazyRoute>} />
                      <Route path="/offers/referrals" element={<LazyRoute><ReferralLinksPage /></LazyRoute>} />
                      <Route path="/offers/feed" element={<LazyRoute><ProductFeedPage /></LazyRoute>} />
                      <Route path="/shipping" element={<LazyRoute><ShippingTaxPage /></LazyRoute>} />
                      <Route path="/payments" element={<LazyRoute><PaymentsPage /></LazyRoute>} />
                      <Route path="/website" element={<LazyRoute><WebsitePage /></LazyRoute>} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><ReportsPage /></LazyRoute>} />
                      {/* The store reports (tax, stock value, slow stock, order times…): only while switched on (lib/features). */}
                      <Route
                        path="/analytics/reports/:report?"
                        element={STORE_REPORTS_ENABLED ? <LazyRoute><StoreReportPage /></LazyRoute> : <Navigate to="/analytics" replace />}
                      />
                      <Route path="/analytics/summary" element={<LazyRoute><AnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/web" element={<LazyRoute><WebAnalyticsPage /></LazyRoute>} />
                      {VISITORS_ENABLED && <Route path="/analytics/visitors" element={<LazyRoute><VisitorsPage /></LazyRoute>} />}
                      <Route path="/analytics/attribution" element={<LazyRoute><AttributionPage /></LazyRoute>} />
                      <Route path="/analytics/realtime" element={<LazyRoute><RealtimePage /></LazyRoute>} />
                      <Route
                        path="/analytics/funnels/:funnelId"
                        element={<LazyRoute><FunnelAnalyticsPage /></LazyRoute>}
                      />
                      <Route path="/subscription" element={<LazyRoute><SubscriptionPage /></LazyRoute>} />
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
                      <Route path="/settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
                      <Route path="/activity" element={<LazyRoute><ActivityLogPage /></LazyRoute>} />
                      <Route path="/support" element={<LazyRoute><SupportPage /></LazyRoute>} />
                      <Route path="/support/:ticketId" element={<LazyRoute><SupportTicketPage /></LazyRoute>} />
                      <Route path="/suggestions" element={<LazyRoute><SuggestionsPage /></LazyRoute>} />
                      <Route path="*" element={<LazyRoute><NotFoundPage /></LazyRoute>} />
                    </Route>

                    {/* Full-screen editors: their own bar instead of the sidebar,
                        still under the access banner (EditorLayout). */}
                    <Route element={<LazyRoute screen><EditorLayout /></LazyRoute>}>
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
