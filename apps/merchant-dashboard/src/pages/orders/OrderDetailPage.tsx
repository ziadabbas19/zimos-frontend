import { useParams } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderSummary } from "./components/OrderSummary";
import { OrderActions } from "./components/OrderActions";
import { ShipmentsSection } from "./components/ShipmentsSection";
import { ReturnsSection } from "./components/ReturnsSection";

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const workspaceId = useWorkspaceId();

  const order = useAsync(
    () => apiClient.getOrder(workspaceId, orderId as string),
    [workspaceId, orderId]
  );
  const data = order.data;
  const reload = () => order.refresh({ silent: true });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={data ? data.orderNumber : "Order"}
        back={{ to: "/orders", label: "Orders" }}
        description={data ? `Placed ${formatDateTime(data.createdAt)}` : undefined}
      />

      <DataState loading={order.loading} error={order.error} onRetry={() => order.refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Confirmation" value={data.confirmationState} />
              <StatusBadge label="Payment" value={data.financialState} />
              <StatusBadge label="Fulfilment" value={data.fulfillmentState} />
            </div>

            <OrderActions order={data} onChanged={reload} />

            <OrderSummary order={data} />

            <ShipmentsSection
              orderId={data.id}
              shipments={data.shipments ?? []}
              orderCancelled={Boolean(data.cancelledAt)}
              onChanged={reload}
            />

            <ReturnsSection order={data} onOrderMaybeChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}
