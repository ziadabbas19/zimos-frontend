import { useParams } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderSummary } from "./components/OrderSummary";
import { OrderActions } from "./components/OrderActions";
import { ConfirmationPanel } from "./components/ConfirmationPanel";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { ReturnsSection } from "./components/ReturnsSection";
import { STAGE_TONE, useOrderLabels } from "./orderLabels";

const STRINGS = {
  en: {
    order: "Order",
    back: "Orders",
    placed: "Placed {date}",
    confirmation: "Confirmation",
    payment: "Payment",
    fulfillment: "Fulfillment",
  },
  ar: {
    order: "الأوردر",
    back: "الأوردرات",
    placed: "تم الطلب {date}",
    confirmation: "التأكيد",
    payment: "الدفع",
    fulfillment: "التنفيذ",
  },
} satisfies Messages;

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();

  const order = useAsync(
    () => apiClient.getOrder(workspaceId, orderId as string),
    [workspaceId, orderId]
  );
  const data = order.data;
  const reload = () => order.refresh({ silent: true });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={data ? data.orderNumber : t.order}
        back={{ to: "/orders", label: t.back }}
        description={data ? fmt(t.placed, { date: formatDateTime(data.createdAt) }) : undefined}
        titleBadge={
          data?.stage ? (
            <StatusBadge value={data.stage} tone={STAGE_TONE[data.stage]} text={labels.stage(data.stage)} />
          ) : undefined
        }
      />

      <DataState loading={order.loading} error={order.error} onRetry={() => order.refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={t.confirmation}
                value={data.confirmationState}
                text={labels.confirmation(data.confirmationState)}
              />
              <StatusBadge label={t.payment} value={data.financialState} text={labels.financial(data.financialState)} />
              <StatusBadge
                label={t.fulfillment}
                value={data.fulfillmentState}
                text={labels.fulfillment(data.fulfillmentState)}
              />
            </div>

            <OrderActions order={data} onChanged={reload} />

            <ConfirmationPanel order={data} onChanged={reload} />

            <OrderSummary order={data} />

            <ShipmentsSection order={data} onChanged={reload} />

            <ReturnsSection order={data} onOrderMaybeChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}
