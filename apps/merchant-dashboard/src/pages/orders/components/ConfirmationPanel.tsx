import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  type ConfirmationChannel,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type Order,
  type OrderConfirmationAttempt,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useToast } from "@/components/Toast";
import { CONFIRM_ROLES, MANAGE_ROLES, minutesUntil, useNow } from "@/pages/confirmation/confirmationRoles";
import { ChannelPicker, WhatsAppButton, useChannelLabels } from "@/pages/confirmation/confirmationChannel";
import { CustomizationList } from "./CustomizationList";
import { LockedOrderNotice, isLockedOrder, useConfirmBlockedText } from "@/components/OrdersLock";

const STRINGS = {
  en: {
    title: "Confirmation",
    needsConfirmation: "This cash-on-delivery order must be confirmed with the customer before it can ship.",
    attemptsOne: "1 call attempt so far.",
    attemptsOther: "{n} call attempts so far.",
    callback: "Callback scheduled for {time}.",
    waiting:
      "Waiting for the offers window: the customer is still on the sales funnel's offers and may add to this order. It can be confirmed in {n} min (at {time}).",
    waitingSoon: "Waiting for the offers window: it can be confirmed in a moment.",
    heldBy: "{name} is calling the customer now (claim expires in {n} min). Confirming here is blocked until they finish or release it.",
    someone: "Another agent",
    confirm: "Confirm order",
    confirming: "Confirming…",
    rejectHint: "To reject it, use Cancel order.",
    openQueue: "Open confirmation queue",
    confirmedToast: "Order confirmed. It's ready to ship.",
    lockedBy: "{name} is already on this call (claim expires in {n} min).",
    assignedTo: "Assigned to {name}.",
    assignedToYou: "Assigned to you.",
    assignedToOther: "Assigned to {name}. Only they or a manager can confirm it.",
    history: "Confirmation history",
    customerDetails: "Confirm these details with the customer",
    outcome_confirmed: "Confirmed",
    outcome_rejected: "Rejected",
    outcome_unreachable: "Unreachable",
    outcome_postponed: "Postponed",
    via: "via {channel}",
    unknownAgent: "Unknown user",
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
    waiting:
      "في انتظار نافذة العروض: ما زال العميل في عروض مسار البيع وقد يضيف إلى هذا الطلب. يمكن تأكيده خلال {n} دقيقة (في {time}).",
    waitingSoon: "في انتظار نافذة العروض: يمكن تأكيده بعد لحظات.",
    assignedTo: "المعيّن له: {name}.",
    assignedToYou: "المعيّن له: أنت.",
    assignedToOther: "معيّن لـ {name}، ولا يؤكده غيره إلا المدير.",
    history: "سجل التأكيد",
    customerDetails: "راجع هذه البيانات مع العميل",
    outcome_confirmed: "مؤكد",
    outcome_rejected: "مرفوض",
    outcome_unreachable: "تعذّر الوصول",
    outcome_postponed: "مؤجل",
    via: "عبر {channel}",
    unknownAgent: "مستخدم غير معروف",
  },
} satisfies Messages;

const OPEN_STATES = new Set(["pending", "unreachable", "postponed"]);

/**
 * Confirm a COD order that's still waiting on its call, without going through
 * the queue. Same backend rules as a queue call (POST /orders/:id/confirmation):
 * refused while another agent holds a live claim, or while the task is
 * assigned to someone else (unless the viewer manages orders). Rejecting stays
 * with Cancel order, which also closes the task.
 *
 * Once the order is past confirmation, only its attempt history stays.
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
  const [channel, setChannel] = useState<ConfirmationChannel>("call");
  const confirmBlocked = useConfirmBlockedText();
  const locked = isLockedOrder(order);

  const task = order.confirmationTask ?? null;
  const attempts = task?.attempts ?? [];
  // A manually paid order (InstaPay / a wallet) is confirmed only once its payment is approved.
  const confirmable = order.paymentMethod === "cod" || order.manualPayment?.status === "approved";
  const open = confirmable && !order.cancelledAt && OPEN_STATES.has(order.confirmationState);

  if (!open) {
    return attempts.length > 0 ? (
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-medium text-ink">{t.history}</h2>
        <AttemptList attempts={attempts} />
      </Card>
    ) : null;
  }

  const role = currentWorkspace?.role ?? "";
  const canConfirm = CONFIRM_ROLES.has(role);
  const canManage = MANAGE_ROLES.has(role);
  const heldMinutes = task?.lockedBy ? minutesUntil(task.lockExpiresAt, now) : 0;
  // The holder themselves may confirm here; the server allows it.
  const heldByOther = Boolean(task?.lockedBy) && task?.lockedBy?.id !== user?.id && heldMinutes > 0;
  const assignee = task?.assignedTo ?? null;
  const assignedToOther = Boolean(assignee) && assignee?.id !== user?.id && !canManage;
  // A funnel order waits until the shopper is past the offers (the server refuses before).
  const waiting =
    task?.status === "queued" && Boolean(task.availableAt) && new Date(task.availableAt as string).getTime() > now;
  const waitingMinutes = waiting ? minutesUntil(task?.availableAt ?? null, now) : 0;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.confirmOrder(workspaceId, order.id, undefined, channel);
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
      } else if (isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER")) {
        const details = apiErrorDetails<{ assignedTo: { fullName: string } | null }>(err);
        setError(fmt(t.assignedToOther, { name: details?.assignedTo?.fullName ?? t.someone }));
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
        {assignee && (
          <p className={assignedToOther ? "font-medium text-accent-dark" : undefined}>
            {assignee.id === user?.id
              ? t.assignedToYou
              : assignedToOther
                ? fmt(t.assignedToOther, { name: assignee.fullName })
                : fmt(t.assignedTo, { name: assignee.fullName })}
          </p>
        )}
        {waiting && (
          <p role="status" className="font-medium text-accent-dark">
            {waitingMinutes > 0
              ? fmt(t.waiting, { n: waitingMinutes, time: formatDateTime(task?.availableAt as string) })
              : t.waitingSoon}
          </p>
        )}
        {heldByOther && (
          <p className="font-medium text-accent-dark">
            {fmt(t.heldBy, { name: task?.lockedBy?.fullName ?? t.someone, n: heldMinutes })}
          </p>
        )}
      </div>

      {order.items.some((item) => item.customizations && item.customizations.length > 0) && (
        <section aria-label={t.customerDetails} className="space-y-2">
          <h3 className="text-sm font-medium text-ink">{t.customerDetails}</h3>
          {order.items
            .filter((item) => item.customizations && item.customizations.length > 0)
            .map((item) => (
              <div key={item.id} className="space-y-1">
                <p className="text-xs font-medium text-ink-soft">{item.productNameSnapshot}</p>
                <CustomizationList customizations={item.customizations} compact currency={order.currency} />
              </div>
            ))}
        </section>
      )}

      {/* Locked: no call, no message, no confirmation until the store renews or tops up. */}
      {locked && <LockedOrderNotice order={order} />}

      {canConfirm && !heldByOther && !assignedToOther && !waiting && !locked && (
        <div className="space-y-3">
          <WhatsAppButton order={order} onOpen={() => setChannel("whatsapp")} />
          <ChannelPicker value={channel} onChange={setChannel} disabled={busy} />
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {canConfirm && (
          <Button
            onClick={confirm}
            disabled={busy || heldByOther || assignedToOther || waiting || locked}
            title={locked ? confirmBlocked : undefined}
            aria-describedby={locked ? `confirm-blocked-${order.id}` : undefined}
            className="min-h-11"
          >
            {busy ? t.confirming : t.confirm}
          </Button>
        )}
        {canConfirm && locked && (
          <span id={`confirm-blocked-${order.id}`} className="text-xs font-medium text-danger">
            {confirmBlocked}
          </span>
        )}
        <Link to="/confirmation-queue" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          {t.openQueue}
        </Link>
      </div>
      <p className="text-xs text-ink-soft">{t.rejectHint}</p>

      {attempts.length > 0 && (
        <details className="rounded-[0.5rem] border border-line px-4 py-2 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">{t.history}</summary>
          <AttemptList attempts={attempts} />
        </details>
      )}
    </Card>
  );
}

/** Each attempt: outcome, how the customer was reached, who, when and any note. */
function AttemptList({ attempts }: { attempts: OrderConfirmationAttempt[] }) {
  const t = useT(STRINGS);
  const channelLabel = useChannelLabels();
  const outcome = (o: ConfirmationOutcome) => t[`outcome_${o}`];
  return (
    <ol className="mt-2 space-y-2 text-sm">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="border-b border-line pb-2 last:border-b-0 last:pb-0">
          <p className="text-ink">
            <span className="font-medium">{outcome(attempt.outcome)}</span>
            {attempt.channel && <> · {fmt(t.via, { channel: channelLabel[attempt.channel] })}</>} ·{" "}
            {attempt.agent?.fullName ?? t.unknownAgent}
          </p>
          <p className="text-xs text-ink-soft">{formatDateTime(attempt.createdAt)}</p>
          {attempt.notes && <p className="mt-0.5 whitespace-pre-line text-ink-soft">{attempt.notes}</p>}
        </li>
      ))}
    </ol>
  );
}
