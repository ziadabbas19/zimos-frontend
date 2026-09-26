import { useCallback, useState, type ReactNode } from "react";
import { manualCancelShipments, type ManualCancelShipment } from "@store-builder/api-client";
import { ManualCancelDialog } from "./ManualCancelDialog";

/**
 * Wires a request that may cancel a courier booking to ManualCancelDialog.
 * `offer(err, retry)` returns true when `err` is a 409
 * CARRIER_MANUAL_CANCEL_REQUIRED and the dialog took over; `retry` resends
 * the same request with acknowledgeManualCancel: true (throw a translated
 * Error from it to keep the dialog open with that message).
 */
export function useManualCancelPrompt(): {
  offer: (err: unknown, retry: () => Promise<unknown>) => boolean;
  isOpen: boolean;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{ shipments: ManualCancelShipment[]; retry: () => Promise<unknown> } | null>(
    null
  );

  const offer = useCallback((err: unknown, retry: () => Promise<unknown>) => {
    const shipments = manualCancelShipments(err);
    if (shipments.length === 0) return false;
    setPending({ shipments, retry });
    return true;
  }, []);

  const dialog = (
    <ManualCancelDialog
      shipments={pending?.shipments ?? null}
      onCancel={() => setPending(null)}
      onConfirm={async () => {
        if (!pending) return;
        await pending.retry();
        setPending(null);
      }}
    />
  );

  return { offer, isOpen: pending !== null, dialog };
}

