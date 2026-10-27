import { useState, type ReactNode } from "react";
import { Button, Alert, ZLoaderHold } from "@store-builder/ui";
import { Modal } from "./Modal";
import { getErrorMessage } from "@/lib/errors";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `onConfirm` runs. */
  busyLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  /** Resolve to close. Throw to show the error inline and stay open. */
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busyLabel = "Working…",
  destructive = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  function handleCancel() {
    if (busy) return;
    setError(null);
    onCancel();
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={handleCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? <ZLoaderHold label={busyLabel}>{confirmLabel}</ZLoaderHold> : confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {children}
    </Modal>
  );
}
