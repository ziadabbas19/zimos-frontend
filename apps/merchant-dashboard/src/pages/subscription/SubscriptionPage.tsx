import { useId, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useStoreFromLink } from "@/lib/useStoreFromLink";
import { useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { SubscriptionSummary } from "./billingParts";
import { BILLING_ROLES, hintOf } from "./billingText";
import { PlansTab } from "./PlansTab";
import { UsageTab } from "./UsageTab";
import { InvoicesTab } from "./InvoicesTab";
import { SUBSCRIPTION_STRINGS } from "./subscriptionStrings";

type Tab = "plans" | "usage" | "invoices";

/**
 * The Subscription section (owner and accountant: billing.manage): the
 * subscription in brief, then Plans, Usage and Invoices. ?tab= picks one;
 * ?tab=invoices&pay=1 also opens the Pay dialog (the Plans tab's "Pay now");
 * coming back from Fawaterak (?payment=…&workspace=…) opens Invoices.
 */
export function SubscriptionPage() {
  const t = useT(SUBSCRIPTION_STRINGS);
  const { currentWorkspace } = useWorkspace();
  useStoreFromLink();
  if (!BILLING_ROLES.has(currentWorkspace?.role ?? "")) {
    return (
      <div className="max-w-5xl">
        <PageHeader title={t.title} />
        <Alert>{t.noAccess}</Alert>
      </div>
    );
  }
  return <SubscriptionView key={currentWorkspace?.id} />;
}

function SubscriptionView() {
  const t = useT(SUBSCRIPTION_STRINGS);
  const workspaceId = useWorkspaceId();
  const billing = useAsync(() => apiClient.getWorkspaceBilling(workspaceId), [workspaceId]);
  const plans = useAsync(() => apiClient.getSubscriptionPlans(workspaceId), [workspaceId]);
  const [params, setParams] = useSearchParams();
  // Read once, so the payment message stays after the URL is cleaned.
  const [returned] = useState(() =>
    params.get("workspace") === workspaceId && params.get("payment")
      ? { paymentId: params.get("payment")!, hint: hintOf(params.get("result")) }
      : null
  );

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "plans", label: t.plansTab },
    ...(billing.data?.limits ? [{ value: "usage" as const, label: t.usageTab }] : []),
    { value: "invoices", label: t.invoicesTab },
  ];
  const asked = params.get("tab");
  const tab: Tab = returned && !asked ? "invoices" : tabs.some((x) => x.value === asked) ? (asked as Tab) : "plans";

  function show(next: Tab) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query, { replace: true });
  }

  function clearReturn() {
    const query = new URLSearchParams(params);
    query.delete("payment");
    query.delete("workspace");
    query.delete("result");
    query.set("tab", "invoices");
    setParams(query, { replace: true });
  }

  // ?pay=1 is dropped once handled, so a reload doesn't open the dialog again.
  const payRequested = tab === "invoices" && params.get("pay") === "1";
  function clearPayRequest() {
    const query = new URLSearchParams(params);
    query.delete("pay");
    setParams(query, { replace: true });
  }

  const refreshAll = () => {
    void billing.refresh({ silent: true });
    void plans.refresh({ silent: true });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <section className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
        <DataState loading={billing.loading && !billing.data} error={billing.error} onRetry={() => void billing.refresh()}>
          {billing.data && <SubscriptionSummary billing={billing.data} />}
        </DataState>
      </section>

      <TabBar tabs={tabs} value={tab} onChange={show} label={t.tabsLabel} />

      <div role="tabpanel" id={`subscription-${tab}`} aria-labelledby={`subscription-tab-${tab}`}>
        {tab === "plans" && (
          <DataState loading={plans.loading && !plans.data} error={plans.error} onRetry={() => void plans.refresh()}>
            {plans.data && (
              <PlansTab
                view={plans.data}
                billing={billing.data}
                onPlansChange={(next) => plans.setData(next)}
                onBillingChange={(next) => billing.setData(next)}
                onChanged={refreshAll}
              />
            )}
          </DataState>
        )}
        {tab === "usage" && billing.data?.limits && <UsageTab limits={billing.data.limits} />}
        {tab === "invoices" && (
          <InvoicesTab
            billing={billing.data}
            returned={returned}
            onReturnDone={clearReturn}
            onPaid={refreshAll}
            payRequested={payRequested}
            onPayRequestDone={clearPayRequest}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tabs, with arrow keys between them (the WAI-ARIA tabs pattern). They
 * scroll sideways on a narrow screen with no scrollbar shown, and never up
 * and down: the hairline under them is an inset shadow the active tab's
 * underline paints over, so nothing hangs below the row to overflow it.
 */
function TabBar({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: Tab; label: string }>;
  value: Tab;
  onChange: (next: Tab) => void;
  label: string;
}) {
  const baseId = useId();
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = (e.key === "ArrowRight") !== rtl;
    const index = tabs.findIndex((x) => x.value === value);
    const next = tabs[(index + (forward ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.value);
    document.getElementById(`subscription-tab-${next.value}`)?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      id={baseId}
    >
      {tabs.map((x) => (
        <button
          key={x.value}
          id={`subscription-tab-${x.value}`}
          type="button"
          role="tab"
          aria-selected={value === x.value}
          aria-controls={`subscription-${x.value}`}
          tabIndex={value === x.value ? 0 : -1}
          onClick={() => onChange(x.value)}
          onKeyDown={onKeyDown}
          className={cn(
            "min-h-11 shrink-0 cursor-pointer border-b-2 px-4 text-sm font-medium transition-colors",
            value === x.value ? "border-primary text-ink" : "border-transparent text-ink-soft hover:text-ink"
          )}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}
