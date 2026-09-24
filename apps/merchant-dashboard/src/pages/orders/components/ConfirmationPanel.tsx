import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  type ConfirmationLockDetails,
  type Order,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useToast } from "@/components/Toast";
import { CONFIRM_ROLES, minutesUntil, useNow } from "@/pages/confirmation/confirmationRoles";

const STRINGS = {
  en: {
    title: "Confirmation",
    needsConfirmation: "This cash-on-delivery order must be confirmed with the customer before it can ship.",
    attemptsOne: "1 call attempt so far.",
    attemptsOther: "{n} call attempts so far.",
    callback: "Callback scheduled for {time}.",
    heldBy: "{name} is calling the customer now (claim expires in {n} min). Confirming here is blocked until they finish or release it.",
    someone: "Another agent",
    confirm: "Confirm order",
    confirming: "Confirming…",
    rejectHint: "To reject it, use Cancel order.",
    openQueue: "Open confirmation queue",
    confirmedToast: "Order confirmed. It's ready to ship.",
    lockedBy: "{name} is already on this call (claim expires in {n} min).",
  },
  ar: {
    title: "التأكيد",
    needsConfirmation: "يجب تأكيد أوردر الدفع عند الاستلام مع العميل قبل شحنه.",
    attemptsOne: "محاولة اتصال واحدة حتى الآن.",
    attemptsOther: "{n} محاولات اتصال حتى الآن.",
    callback: "معاودة الاتصال مجدولة في {time}.",
    heldBy: "{name} يتصل بالعميل الآن (ينتهي الاستلام خلال {n} دقيقة). التأكيد من هنا متوقف حتى ينتهي أو يُرجعه للقائمة.",
    someone: "موظف آخر",
    confirm: "تأكيد الأوردر",
    confirming: "جارٍ التأكيد…",
    rejectHint: "لرفضه، استخدم إلغاء الأوردر.",
    openQueue: "فتح قائمة التأكيد",
    confirmedToast: "تم تأكيد الأوردر. أصبح جاهزًا للشحن.",
    lockedBy: "{name} في هذه المكالمة بالفعل (ينتهي الاستلام خلال {n} دقيقة).",
  },
} satisfies Messages;

const OPEN_STATES = new Set(["pending", "unreachable", "postponed"]);

/**
 * Confirm a COD order that's still waiting on its call, without going through
 * the queue. Same backend rules as a queue call (POST /orders/:id/confirmation):
 * refused while another agent holds a live claim. Rejecting stays with Cancel
 * order, which also closes the task.
 */
export function ConfirmationPanel({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.paymentMethod !== "cod" || order.cancelledAt || !OPEN_STATES.has(order.confirmationState)) return null;

  const canConfirm = CONFIRM_ROLES.has(currentWorkspace?.role ?? "");
  const task = order.confirmationTask ?? null;
  const heldMinutes = task?.lockedBy ? minutesUntil(task.lockExpiresAt, now) : 0;
  // The holder themselves may confirm here; the server allows it.
  const heldByOther = Boolean(task?.lockedBy) && task?.lockedBy?.id !== user?.id && heldMinutes > 0;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.confirmOrder(workspaceId, order.id);
      toast.success(t.confirmedToast);
      onChanged();
    } catch (err) {
      if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
        const lock = apiErrorDetails<ConfirmationLockDetails>(err);
        setError(
          fmt(t.lockedBy, {
            name: lock?.lockedBy?.fullName ?? t.someone,
            n: minutesUntil(lock?.lockExpiresAt ?? null, Date.now()),
          })
        );
      } else {
        setError(errorMessage(err));
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <div className="space-y-1 text-sm text-ink-soft">
        <p className="text-ink">{t.needsConfirmation}</p>
        {task && task.attemptCount > 0 && (
          <p>{task.attemptCount === 1 ? t.attemptsOne : fmt(t.attemptsOther, { n: task.attemptCount })}</p>
        )}
        {task?.nextRetryAt && task.status === "queued" && (
          <p>{fmt(t.callback, { time: formatDateTime(task.nextRetryAt) })}</p>
        )}
        {heldByOther && (
          <p className="font-medium text-accent-dark">
            {fmt(t.heldBy, { name: task?.lockedBy?.fullName ?? t.someone, n: heldMinutes })}
          </p>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {canConfirm && (
          <Button onClick={confirm} disabled={busy || heldByOther} className="min-h-11">
            {busy ? t.confirming : t.confirm}
          </Button>
        )}
        <Link to="/confirmation-queue" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          {t.openQueue}
        </Link>
      </div>
      <p className="text-xs text-ink-soft">{t.rejectHint}</p>
    </Card>
  );
}
