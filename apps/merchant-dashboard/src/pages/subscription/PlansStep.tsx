import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { PlansTab } from "./PlansTab";

const STRINGS = {
  en: {
    title: "Choose your plan",
    body: "This is what each plan includes. Pick one now, or explore your dashboard first and subscribe any time from My Plan.",
    explore: "Explore first, decide later",
  },
  ar: {
    title: "اختر خطتك",
    body: "هذا ما تشمله كل خطة. اختر خطة الآن، أو استكشف لوحة التحكم أولا واشترك في أي وقت من صفحة خطتي.",
    explore: "استكشف أولا وقرر لاحقا",
  },
} satisfies Messages;

/**
 * The plans, right after a store is made: the same cards, prices, discount
 * code field and actions as My Plan (PlansTab, the server's plans for this
 * store), without trial wording. Choosing leads into the usual subscribe and
 * pay flow; "Explore first" goes to the dashboard and blocks nothing.
 */
export function PlansStep({ onExplore }: { onExplore: () => void }) {
  const t = useT(STRINGS);
  const headingId = useId();
  const workspaceId = useWorkspaceId();
  const billing = useAsync(() => apiClient.getWorkspaceBilling(workspaceId), [workspaceId]);
  const plans = useAsync(() => apiClient.getSubscriptionPlans(workspaceId), [workspaceId]);

  const refreshAll = () => {
    void billing.refresh({ silent: true });
    void plans.refresh({ silent: true });
  };

  const explore = (
    <Button type="button" variant="outline" className="min-h-11" onClick={onExplore}>
      {t.explore}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Button>
  );

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id={headingId} className="font-display text-2xl font-medium text-ink">
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t.body}</p>
        </div>
        {explore}
      </div>

      <DataState loading={plans.loading && !plans.data} error={plans.error} onRetry={() => void plans.refresh()}>
        {plans.data && (
          <PlansTab
            view={plans.data}
            billing={billing.data}
            onPlansChange={(next) => plans.setData(next)}
            onBillingChange={(next) => billing.setData(next)}
            onChanged={refreshAll}
            hideTrial
          />
        )}
      </DataState>

      {plans.data && <div className="flex justify-center border-t border-line pt-5">{explore}</div>}
    </section>
  );
}
