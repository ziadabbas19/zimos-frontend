import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger, buttonVariants } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { DetailRow } from "@/components/Drawer";
import { Mono, Panel } from "@/components/Panel";
import { PricingBadge, Status, StatusBadge } from "@/components/StatusBadge";
import { WorkspaceStatus } from "@/components/workspace";
import { SubscriptionCharges } from "@/components/charges";
import { StoreAccessPanel } from "@/components/storeAccess";
import { FeatureOverridesPanel, ManualSubscriptionPanel, StoreAuditPanel } from "@/components/storeBilling";
import { StoreWalletPanel } from "@/components/storeWallet";
import { WorkspaceReferralsPanel } from "@/components/storeReferrals";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import * as adminApi from "@/lib/adminApi";
import { formatDate, formatMinorMoney, formatNumber, formatRelative } from "@/lib/format";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "subscription", label: "Subscription" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function isTab(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v);
}

export function WorkspaceDetailPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabKey = isTab(tabParam) ? tabParam : "overview";
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspaceRow(id), [id]);
  const { can } = useAuth();
  // Bumped by a manual subscription or feature change, so the cards that read
  // the same records (charges, features, audit log) load them again.
  const [planVersion, setPlanVersion] = useState(0);
  const [featureVersion, setFeatureVersion] = useState(0);

  if (loading || error) {
    return (
      <div>
        <PageHeader title="Workspace" back={{ to: "/workspaces", label: "Workspaces" }} />
        <DataState loading={loading} error={error} onRetry={() => void refresh()}>
          {null}
        </DataState>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Workspace not found" back={{ to: "/workspaces", label: "Workspaces" }} />
        <EmptyBlock
          message={`No workspace with id “${id}” is in the current workspace list.`}
          action={
            <Link to="/workspaces" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to workspaces
            </Link>
          }
        />
      </div>
    );
  }

  const { workspace: ws, subscription: sub } = data;

  return (
    <div>
      <PageHeader
        title={ws.name}
        titleBadge={<WorkspaceStatus row={data} />}
        description={ws.slug}
        back={{ to: "/workspaces", label: "Workspaces" }}
      />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) }, { replace: true })}>
        <div className="scroll-thin overflow-x-auto border-b border-line">
          <TabsList variant="line" className="h-10">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="pt-5">
          <div className="mb-4">
            <StoreAccessPanel workspaceId={ws.id} onChanged={() => void refresh({ silent: true })} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Workspace">
              <dl>
                <DetailRow label="Name">{ws.name}</DetailRow>
                <DetailRow label="Address">
                  <Mono>{ws.slug}</Mono>
                </DetailRow>
                <DetailRow label="Workspace ID">
                  <Mono>{ws.id}</Mono>
                </DetailRow>
                <DetailRow label="Status">
                  <Status value={ws.status} />
                </DetailRow>
                <DetailRow label="Currency">{ws.defaultCurrency}</DetailRow>
                <DetailRow label="Created">
                  {formatDate(ws.createdAt)}
                  <span className="ms-2 text-xs text-ink-soft">{formatRelative(ws.createdAt)}</span>
                </DetailRow>
              </dl>
            </Panel>

            <Panel title="Activity">
              <dl>
                <DetailRow label="Orders placed">
                  <span className="tabular">{formatNumber(ws.orderCount)}</span>
                </DetailRow>
              </dl>
              <p className="mt-3 text-xs text-ink-soft">
                A lifetime count. Revenue, a 30-day window and delivery rates need workspace metrics
                on <code className="font-mono">GET /admin/workspaces</code>, which returns only this
                total.
              </p>
            </Panel>
          </div>

          <p className="mt-4 text-xs text-ink-soft">
            Team members, domains, locale and theme settings, and the activity trail each need an
            admin endpoint that doesn't exist yet, so they aren't shown here.
          </p>
        </TabsContent>

        <TabsContent value="subscription" className="pt-5">
          {sub && can(P.SUBSCRIPTIONS_VIEW) && (
            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ManualSubscriptionPanel
                workspaceId={ws.id}
                canManage={can(P.SUBSCRIPTIONS_MANAGE)}
                onChanged={() => {
                  setPlanVersion((v) => v + 1);
                  void refresh({ silent: true });
                }}
              />
              <FeatureOverridesPanel
                key={planVersion}
                workspaceId={ws.id}
                canManage={can(P.SUBSCRIPTIONS_MANAGE)}
                onChanged={() => setFeatureVersion((v) => v + 1)}
              />
            </div>
          )}
          {!sub ? (
            <EmptyBlock message="This workspace has never had a subscription." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Plan">
                <dl>
                  <DetailRow label="Plan">{sub.planName ?? "—"}</DetailRow>
                  <DetailRow label="Plan code">
                    {sub.planCode ? <Mono>{sub.planCode}</Mono> : "—"}
                  </DetailRow>
                  <DetailRow label="Billing cycle">
                    <span className="capitalize">{sub.billingCycle}</span>
                  </DetailRow>
                  <DetailRow label="MRR">
                    <span className="tabular">{formatMinorMoney(sub.mrr, sub.currency)}</span>
                    <PricingBadge kind={sub.pricingKind} />
                  </DetailRow>
                  <DetailRow label="Provider">{sub.externalProvider ?? "—"}</DetailRow>
                </dl>
              </Panel>

              <Panel title="Billing period">
                <dl>
                  <DetailRow label="Status">
                    <Status value={sub.status} />
                  </DetailRow>
                  <DetailRow label="Trial ends">
                    {sub.trialEndsAt ? (
                      <>
                        {formatDate(sub.trialEndsAt)}
                        <span className="ms-2 text-xs text-ink-soft">
                          {formatRelative(sub.trialEndsAt)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  {ws.draft ? (
                    // A draft's stored period is a placeholder (the trial it would
                    // have had without REQUIRE_SUBSCRIPTION_TO_GO_LIVE); nothing runs yet.
                    <DetailRow label="Period">
                      <span className="text-ink-soft">Not started — the store is a draft</span>
                    </DetailRow>
                  ) : (
                    <>
                      <DetailRow label="Period start">{formatDate(sub.currentPeriodStart)}</DetailRow>
                      <DetailRow label="Period end">{formatDate(sub.currentPeriodEnd)}</DetailRow>
                    </>
                  )}
                  <DetailRow label="Grace until">{formatDate(sub.graceUntil)}</DetailRow>
                  <DetailRow label="Cancels at period end">
                    {sub.cancelAtPeriodEnd ? (
                      <StatusBadge tone="warning">Yes</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">No</StatusBadge>
                    )}
                  </DetailRow>
                </dl>
              </Panel>
            </div>
          )}

          {sub && can(P.SUBSCRIPTIONS_VIEW) && <SubscriptionCharges key={planVersion} workspaceId={ws.id} />}

          {can(P.SUBSCRIPTIONS_VIEW) && <StoreWalletPanel workspaceId={ws.id} />}

          {can(P.AUDIT_LOG_VIEW) && (
            <div className="mt-4">
              <StoreAuditPanel key={`${planVersion}-${featureVersion}`} workspaceId={ws.id} />
            </div>
          )}

          <p className="mt-4 text-xs text-ink-soft">
            Charges are created here, or when the merchant pays online (Fawaterak, while online
            payment is switched on); a payment that arrived another way is recorded here by hand.
            Activating, changing the plan, extending or ending the subscription by hand never
            creates a charge or an agent commission.
          </p>

          {can(P.AGENTS_VIEW) && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-lg font-medium text-ink">Referral codes and agent</h2>
              <WorkspaceReferralsPanel workspaceId={id} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
