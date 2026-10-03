import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { LazyRoute } from "@/routes/LazyRoute";
import { LoginPage } from "@/pages/LoginPage";
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
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { AbandonedCartsPage } from "@/pages/abandoned/AbandonedCartsPage";
import { FraudPage } from "@/pages/fraud/FraudPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { ShippingTaxPage } from "@/pages/shipping/ShippingTaxPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { WebsitePage } from "@/pages/website/WebsitePage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SubscriptionPage } from "@/pages/subscription/SubscriptionPage";
import { SupportPage, SupportTicketPage } from "@/pages/support/SupportPage";

// Analytics screens and the two editors are code-split: their charts, block
// library and preview plumbing load only when a merchant opens them, not
// with every dashboard page.
// The funnel list shares the funnel starters (and so the block library's
// element table) with the funnel editor, so it is split off with it.
const FunnelsPage = lazy(() => import("@/pages/funnels/FunnelsPage").then((m) => ({ default: m.FunnelsPage })));
const FunnelEditorPage = lazy(() =>
  import("@/pages/funnels/FunnelEditorPage").then((m) => ({ default: m.FunnelEditorPage }))
);
const WebsiteEditorPage = lazy(() =>
  import("@/pages/website/editor/WebsiteEditorPage").then((m) => ({ default: m.WebsiteEditorPage }))
);
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const WebAnalyticsPage = lazy(() =>
  import("@/pages/analytics/WebAnalyticsPage").then((m) => ({ default: m.WebAnalyticsPage }))
);
const RealtimePage = lazy(() => import("@/pages/analytics/RealtimePage").then((m) => ({ default: m.RealtimePage })));
const UtmReportPage = lazy(() => import("@/pages/analytics/UtmReportPage").then((m) => ({ default: m.UtmReportPage })));
const FunnelAnalyticsPage = lazy(() =>
  import("@/pages/analytics/FunnelAnalyticsPage").then((m) => ({ default: m.FunnelAnalyticsPage }))
);

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <ToastProvider>
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
                      <Route path="/orders/:orderId" element={<OrderDetailPage />} />

                      <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                      <Route path="/fraud" element={<FraudPage />} />
                      <Route path="/returns" element={<ReturnsPage />} />
                      <Route path="/abandoned-carts" element={<AbandonedCartsPage />} />

                      <Route path="/catalog" element={<CatalogProductsPage />} />
                      <Route path="/catalog/collections" element={<CollectionsPage />} />
                      <Route path="/catalog/new" element={<ProductEditPage />} />
                      <Route path="/catalog/:productId" element={<ProductEditPage />} />

                      <Route path="/reviews" element={<ReviewsPage />} />
                      <Route path="/customers" element={<CustomersPage />} />
                      <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                      <Route path="/discounts" element={<DiscountsPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><AnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/web" element={<LazyRoute><WebAnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/realtime" element={<LazyRoute><RealtimePage /></LazyRoute>} />
                      <Route path="/analytics/utm" element={<LazyRoute><UtmReportPage /></LazyRoute>} />
                      <Route
                        path="/analytics/funnels/:funnelId"
                        element={<LazyRoute><FunnelAnalyticsPage /></LazyRoute>}
                      />
                      <Route path="/subscription" element={<SubscriptionPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="/support/:ticketId" element={<SupportTicketPage />} />
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
