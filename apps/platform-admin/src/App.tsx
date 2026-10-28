import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { SiteTrafficPage } from "@/pages/SiteTrafficPage";
import { StoreTrafficPage } from "@/pages/StoreTrafficPage";
import { STORE_TRAFFIC_ENABLED } from "@/lib/features";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequirePermission } from "@/routes/RequirePermission";
import { ToastProvider } from "@/components/Toast";
import { AdminLayout } from "@/components/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { WorkspaceDetailPage } from "@/pages/WorkspaceDetailPage";
import { UsersPage } from "@/pages/UsersPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { PlansPage } from "@/pages/PlansPage";
import { PaymentProofsPage } from "@/pages/PaymentProofsPage";
import { WalletRefundsPage } from "@/pages/WalletRefundsPage";
import { PaymentProofPage } from "@/pages/PaymentProofPage";
import { PaymentMethodsPage } from "@/pages/PaymentMethodsPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { AppsPage } from "@/pages/AppsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { CarrierAreasPage } from "@/pages/CarrierAreasPage";
import { ThemesPage } from "@/pages/ThemesPage";
import { FraudSignalsPage } from "@/pages/FraudSignalsPage";
import { BlocklistPage } from "@/pages/BlocklistPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { SuggestionsPage } from "@/pages/SuggestionsPage";
import { TicketDetailPage } from "@/pages/TicketDetailPage";
import { AnnouncementsPage } from "@/pages/AnnouncementsPage";
import { ServiceListingsPage } from "@/pages/ServiceListingsPage";
import { FeatureFlagsPage } from "@/pages/FeatureFlagsPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { AgentDetailPage } from "@/pages/AgentDetailPage";
import { MyReferralsPage } from "@/pages/MyReferralsPage";
import { ReferralCodesPage } from "@/pages/ReferralCodesPage";
import { ReferralCodeDetailPage } from "@/pages/ReferralCodeDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlatformSettingsPage } from "@/pages/PlatformSettingsPage";
import { P } from "@/lib/permissions";

/** A console page that needs `permission` (the view key its endpoints check). */
function gated(permission: string, element: ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>;
}

export default function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route
                    path="/"
                    element={
                      <RequirePermission permission={P.OVERVIEW_VIEW} redirect>
                        <OverviewPage />
                      </RequirePermission>
                    }
                  />
                  <Route path="/workspaces" element={gated(P.WORKSPACES_VIEW, <WorkspacesPage />)} />
                  <Route path="/workspaces/:id" element={gated(P.WORKSPACES_VIEW, <WorkspaceDetailPage />)} />
                  <Route path="/users" element={gated(P.WORKSPACES_VIEW, <UsersPage />)} />
                  <Route path="/users/:id" element={gated(P.WORKSPACES_VIEW, <UserDetailPage />)} />
                  <Route path="/subscriptions" element={gated(P.SUBSCRIPTIONS_VIEW, <SubscriptionsPage />)} />
                  <Route path="/notifications" element={gated(P.OVERVIEW_VIEW, <NotificationsPage />)} />
          <Route path="/site-traffic" element={gated(P.OVERVIEW_VIEW, <SiteTrafficPage />)} />
                  {STORE_TRAFFIC_ENABLED && <Route path="/store-traffic" element={gated(P.WORKSPACES_VIEW, <StoreTrafficPage />)} />}
                  <Route path="/plans" element={gated(P.PLANS_VIEW, <PlansPage />)} />
                  <Route path="/payment-proofs" element={gated(P.PAYMENTS_RECORD, <PaymentProofsPage />)} />
                  <Route path="/wallet-refunds" element={gated(P.PAYMENTS_RECORD, <WalletRefundsPage />)} />
                  <Route path="/payment-proofs/:id" element={gated(P.PAYMENTS_RECORD, <PaymentProofPage />)} />
                  <Route path="/payment-methods" element={gated(P.PAYMENTS_RECORD, <PaymentMethodsPage />)} />
                  <Route path="/agents" element={gated(P.AGENTS_VIEW, <AgentsPage />)} />
                  <Route path="/agents/:id" element={gated(P.AGENTS_VIEW, <AgentDetailPage />)} />
                  <Route path="/referral-codes" element={gated(P.AGENTS_VIEW, <ReferralCodesPage />)} />
                  <Route path="/referral-codes/:id" element={gated(P.AGENTS_VIEW, <ReferralCodeDetailPage />)} />
                  <Route path="/my-referrals" element={gated(P.REFERRALS_VIEW_OWN, <MyReferralsPage />)} />
                  <Route path="/templates" element={gated(P.TEMPLATES_VIEW, <TemplatesPage />)} />
                  <Route path="/themes" element={gated(P.TEMPLATES_VIEW, <ThemesPage />)} />
                  <Route path="/suppliers" element={gated(P.TEMPLATES_VIEW, <SuppliersPage />)} />
                  <Route path="/apps" element={gated(P.TEMPLATES_VIEW, <AppsPage />)} />
                  <Route path="/carriers" element={gated(P.PROVIDERS_VIEW, <ProvidersPage kind="carrier" />)} />
                  <Route path="/carriers/:code/areas" element={gated(P.PROVIDERS_VIEW, <CarrierAreasPage />)} />
                  <Route path="/payment-gateways" element={gated(P.PROVIDERS_VIEW, <ProvidersPage kind="payment" />)} />
                  <Route path="/whatsapp-numbers" element={gated(P.PROVIDERS_VIEW, <ProvidersPage kind="whatsapp" />)} />
                  <Route path="/fraud-signals" element={gated(P.RISK_VIEW, <FraudSignalsPage />)} />
                  <Route path="/blocklist" element={gated(P.RISK_VIEW, <BlocklistPage />)} />
                  <Route path="/tickets" element={gated(P.SUPPORT_VIEW, <TicketsPage />)} />
                  <Route path="/suggestions" element={gated(P.SUPPORT_VIEW, <SuggestionsPage />)} />
                  <Route path="/tickets/:id" element={gated(P.SUPPORT_VIEW, <TicketDetailPage />)} />
                  <Route path="/announcements" element={gated(P.ANNOUNCEMENTS_VIEW, <AnnouncementsPage />)} />
                  <Route path="/service-listings" element={gated(P.SERVICE_LISTINGS_VIEW, <ServiceListingsPage />)} />
                  <Route path="/feature-flags" element={gated(P.FEATURE_FLAGS_VIEW, <FeatureFlagsPage />)} />
                  <Route path="/audit-log" element={gated(P.AUDIT_LOG_VIEW, <AuditLogPage />)} />
                  <Route path="/system-health" element={gated(P.SYSTEM_VIEW, <SystemHealthPage />)} />
                  <Route path="/admin-users" element={gated(P.ADMINS_VIEW, <AdminUsersPage />)} />
                  <Route path="/platform-settings" element={gated(P.PLATFORM_SETTINGS_VIEW, <PlatformSettingsPage />)} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </LocaleProvider>
  );
}
