import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  apiErrorDetails,
  isApiErrorCode,
  isInvalidCursorError,
  type ConfirmationAttempt,
  type ConfirmationAttemptSource,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type ConfirmationQueueCounts,
  type ConfirmationQueueTab,
  type ConfirmationTask,
  type RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatAddress, formatDateTime, formatMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { CONFIRM_ROLES, MANAGE_ROLES, minutesUntil, useNow } from "./confirmationRoles";

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];
const PAGE_SIZE = 50;

const STRINGS = {
  en: {
    title: "Confirmation queue",
    description: "Call each customer to confirm their order before it moves to fulfilment.",
    tabsLabel: "Queue tabs",
    tabPending: "Pending",
    tabInProgress: "In progress",
    tabDone: "Done",
    tabCount: "{label} ({n})",
    emptyPending: "No orders are waiting for confirmation right now.",
    emptyInProgress: "Nobody is on a call right now.",
    emptyDone: "No finished confirmations yet.",
    outcomeConfirmed: "Confirmed",
    outcomeRejected: "Rejected",
    outcomeUnreachable: "Unreachable",
    outcomePostponed: "Postponed",
    itemsOne: "1 item",
    itemsOther: "{n} items",
    attemptsOne: "1 previous attempt",
    attemptsOther: "{n} previous attempts",
    unnamedCustomer: "Unnamed customer",
    noPhone: "No phone number",
    claiming: "Claiming…",
    claimAndCall: "Claim & call",
    takeOver: "Take over",
    reclaim: "Claim again",
    release: "Release",
    releasing: "Releasing…",
    rejectionReason: "Rejection reason",
    rejectionPlaceholder: "Customer changed their mind",
    notes: "Notes",
    notesPlaceholder: "Anything worth recording from the call (optional).",
    saving: "Saving…",
    saveOutcome: "Save outcome",
    toastMarked: "{order} marked {outcome}.",
    toastReleased: "{order} is back in Pending.",
    callbackDue: "Callback due since {time}",
    callbackLater: "Callback scheduled for {time}",
    lastAttempt: "Last: {outcome} by {agent}, {time}",
    yourClaim: "You're on this call · your claim expires in {n} min",
    yourClaimExpired: "Your claim expired. Claim it again before saving — someone else may take it.",
    heldBy: "{name} is on this call · claim expires in {n} min",
    heldByExpired: "{name}'s claim expired — anyone can take it over.",
    someone: "Another agent",
    lockedBy: "{name} is already on this call (claim expires in {n} min).",
    doneAt: "{outcome} · {time}",
    doneBy: "by {agent}",
    orderCancelled: "Order cancelled",
    history: "History ({n})",
    sourceQueue: "call",
    sourceOrderPage: "order page",
    sourceCorrection: "correction",
    corrected: "{from} → {to}",
    unknownAgent: "Unknown user",
    correct: "Correct outcome",
    correctTitle: "Correct {order}",
    correctToRejected:
      "Change to Rejected. Any courier booking that hasn't been collected is cancelled and the stock is released.",
    correctToConfirmed: "Change to Confirmed. The stock is reserved again; this fails if it has sold out.",
    correctReason: "Reason",
    correctReasonPlaceholder: "Customer called back",
    correctNotes: "Notes (optional)",
    correctSubmit: "Change to {outcome}",
    cancel: "Cancel",
    toastCorrected: "{order} changed to {outcome}.",
  },
  ar: {
    title: "قائمة التأكيد",
    description: "اتصل بكل عميل لتأكيد طلبه قبل أن ينتقل إلى التجهيز.",
    tabsLabel: "أقسام القائمة",
    tabPending: "بالانتظار",
    tabInProgress: "قيد التنفيذ",
    tabDone: "منتهية",
    tabCount: "{label} ({n})",
    emptyPending: "لا توجد طلبات بانتظار التأكيد حاليًا.",
    emptyInProgress: "لا أحد في مكالمة الآن.",
    emptyDone: "لا توجد تأكيدات منتهية بعد.",
    outcomeConfirmed: "مؤكد",
    outcomeRejected: "مرفوض",
    outcomeUnreachable: "تعذّر الوصول",
    outcomePostponed: "مؤجل",
    itemsOne: "منتج واحد",
    itemsOther: "{n} منتجات",
    attemptsOne: "محاولة سابقة واحدة",
    attemptsOther: "{n} محاولات سابقة",
    unnamedCustomer: "عميل بدون اسم",
    noPhone: "لا يوجد رقم هاتف",
    claiming: "جارٍ الاستلام…",
    claimAndCall: "استلام واتصال",
    takeOver: "استلام بدلًا منه",
    reclaim: "استلام مرة أخرى",
    release: "إرجاع للقائمة",
    releasing: "جارٍ الإرجاع…",
    rejectionReason: "سبب الرفض",
    rejectionPlaceholder: "غيّر العميل رأيه",
    notes: "ملاحظات",
    notesPlaceholder: "أي شيء يستحق التسجيل من المكالمة (اختياري).",
    saving: "جارٍ الحفظ…",
    saveOutcome: "حفظ النتيجة",
    toastMarked: "تم تعيين {order} كـ {outcome}.",
    toastReleased: "عاد {order} إلى قائمة الانتظار.",
    callbackDue: "موعد معاودة الاتصال حان منذ {time}",
    callbackLater: "معاودة الاتصال مجدولة في {time}",
    lastAttempt: "آخر محاولة: {outcome} بواسطة {agent}، {time}",
    yourClaim: "أنت في هذه المكالمة · ينتهي استلامك خلال {n} دقيقة",
    yourClaimExpired: "انتهت مدة استلامك. استلمه مرة أخرى قبل الحفظ — قد يستلمه شخص آخر.",
    heldBy: "{name} في هذه المكالمة · ينتهي الاستلام خلال {n} دقيقة",
    heldByExpired: "انتهت مدة استلام {name} — يمكن لأي شخص استلامه.",
    someone: "موظف آخر",
    lockedBy: "{name} في هذه المكالمة بالفعل (ينتهي الاستلام خلال {n} دقيقة).",
    doneAt: "{outcome} · {time}",
    doneBy: "بواسطة {agent}",
    orderCancelled: "أوردر ملغي",
    history: "السجل ({n})",
    sourceQueue: "مكالمة",
    sourceOrderPage: "صفحة الأوردر",
    sourceCorrection: "تصحيح",
    corrected: "{from} ← {to}",
    unknownAgent: "مستخدم غير معروف",
    correct: "تصحيح النتيجة",
    correctTitle: "تصحيح {order}",
    correctToRejected: "التغيير إلى مرفوض. تُلغى أي شحنة لم تُستلم بعد ويُحرَّر المخزون.",
    correctToConfirmed: "التغيير إلى مؤكد. يُحجز المخزون مرة أخرى، ويفشل ذلك إذا نفد.",
    correctReason: "السبب",
    correctReasonPlaceholder: "اتصل العميل مرة أخرى",
    correctNotes: "ملاحظات (اختياري)",
    correctSubmit: "التغيير إلى {outcome}",
    cancel: "إلغاء",
    toastCorrected: "تم تغيير {order} إلى {outcome}.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

/** Outcome buttons and the toast, in the active locale. */
function useOutcomeLabels(): Record<ConfirmationOutcome, string> {
  const t = useT(STRINGS);
  return {
    confirmed: t.outcomeConfirmed,
    rejected: t.outcomeRejected,
    unreachable: t.outcomeUnreachable,
    postponed: t.outcomePostponed,
  };
}

function sourceLabel(t: Strings, source: ConfirmationAttemptSource): string {
  if (source === "order_page") return t.sourceOrderPage;
  if (source === "correction") return t.sourceCorrection;
  return t.sourceQueue;
}

/** What the viewer may do here, from their role key in this workspace. */
function useQueueAbilities() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role ?? "";
  return {
    userId: user?.id ?? null,
    canConfirm: CONFIRM_ROLES.has(role),
    canManage: MANAGE_ROLES.has(role),
  };
}

export function ConfirmationQueuePage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const [tab, setTab] = useState<ConfirmationQueueTab>("pending");

  const counts = useAsync(() => apiClient.getConfirmationQueueCounts(workspaceId), [workspaceId]);
  const list = useCursorList<ConfirmationTask>(
    async (cursor) => {
      const page = await apiClient.listConfirmationQueue(workspaceId, { status: tab, cursor, limit: PAGE_SIZE });
      return { items: page.tasks, nextCursor: page.nextCursor };
    },
    [workspaceId, tab],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );

  function tabLabel(label: string, key: keyof ConfirmationQueueCounts) {
    const n = counts.data?.[key];
    return n === undefined ? label : fmt(t.tabCount, { label, n });
  }

  // A task that changed in place (claimed, released, corrected) keeps its
  // spot until the next load, so the card an agent is working doesn't jump.
  function replaceTask(updated: ConfirmationTask) {
    list.setItems((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    void counts.refresh({ silent: true });
  }

  function removeTask(taskId: string) {
    list.setItems((prev) => prev.filter((task) => task.id !== taskId));
    void counts.refresh({ silent: true });
  }

  const emptyMessage =
    tab === "pending" ? t.emptyPending : tab === "in_progress" ? t.emptyInProgress : t.emptyDone;

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />

      <FilterTabs
        className="mb-4"
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: tabLabel(t.tabPending, "pending") },
          { value: "in_progress", label: tabLabel(t.tabInProgress, "inProgress") },
          { value: "done", label: tabLabel(t.tabDone, "done") },
        ]}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
      >
        <div className="space-y-4">
          {list.items.map((task) =>
            task.status === "done" ? (
              <DoneCard key={task.id} task={task} onChanged={replaceTask} />
            ) : (
              <OpenCard key={task.id} task={task} onChanged={replaceTask} onResolved={removeTask} />
            )
          )}
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

/** Order number, items, total, risk flags and the customer's contact — every card's top half. */
function OrderSummary({ task, aside }: { task: ConfirmationTask; aside?: ReactNode }) {
  const t = useT(STRINGS);
  const orderLabels = useOrderLabels();
  const { order } = task;
  const riskFlags = order.riskFlags ?? [];
  const contact = order.contactSnapshot;
  const itemCount = order.items.length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/orders/${order.id}`}
              className="font-display text-lg font-medium text-ink hover:text-primary"
            >
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </Link>
            {riskFlags.length > 0 && (
              <StatusBadge value="flagged" tone="danger" text={orderLabels.flagged} />
            )}
            {order.cancelledAt && <StatusBadge value="cancelled" text={t.orderCancelled} />}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {itemCount === 1 ? t.itemsOne : fmt(t.itemsOther, { n: itemCount })} ·{" "}
            {formatMoney(order.totalAmount, order.currency)}
          </p>
          {riskFlags.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-danger">
              {riskFlags.map((flag) => orderLabels.riskFlag(flag)).join(" · ")}
            </p>
          )}
        </div>
        {aside}
      </div>

      <div className="rounded-[0.5rem] bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink">{contact.fullName || t.unnamedCustomer}</p>
        <p className="mt-0.5 font-display text-xl font-medium text-ink">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="hover:text-primary">
              <bdi dir="ltr">{contact.phone}</bdi>
            </a>
          ) : (
            <span className="text-ink-soft">{t.noPhone}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
      </div>
    </>
  );
}

function AttemptsBadge({ count }: { count: number }) {
  const t = useT(STRINGS);
  if (count === 0) return null;
  return (
    <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
      {count === 1 ? t.attemptsOne : fmt(t.attemptsOther, { n: count })}
    </span>
  );
}

/** A pending or in-progress task: claim, record an outcome, release. */
function OpenCard({
  task,
  onChanged,
  onResolved,
}: {
  task: ConfirmationTask;
  onChanged: (task: ConfirmationTask) => void;
  onResolved: (taskId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const outcomeLabel = useOutcomeLabels();
  const { userId, canConfirm, canManage } = useQueueAbilities();
  const now = useNow();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  const { order } = task;
  const inProgress = task.status === "in_progress";
  const mine = inProgress && task.lockedByUserId === userId;
  const expired = inProgress && minutesUntil(task.lockExpiresAt, now) === 0;
  const holderName = task.lockedBy?.fullName ?? t.someone;
  const rejectionMissing = outcome === "rejected" && rejectionReason.trim() === "";
  const lastAttempt = task.attempts[task.attempts.length - 1];

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
      const lock = apiErrorDetails<ConfirmationLockDetails>(err);
      return fmt(t.lockedBy, {
        name: lock?.lockedBy?.fullName ?? t.someone,
        n: minutesUntil(lock?.lockExpiresAt ?? null, Date.now()),
      });
    }
    return errorMessage(err);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const claim = () => run(async () => onChanged(await apiClient.claimConfirmationTask(workspaceId, task.id)));

  const release = () =>
    run(async () => {
      onChanged(await apiClient.releaseConfirmationTask(workspaceId, task.id));
      toast.success(fmt(t.toastReleased, { order: order.orderNumber }));
    });

  const save = () =>
    run(async () => {
      if (!outcome || rejectionMissing) return;
      const payload: RecordConfirmationOutcomePayload = { outcome };
      if (notes.trim()) payload.notes = notes.trim();
      if (outcome === "rejected") payload.rejectionReason = rejectionReason.trim();
      await apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
      // Arabic has no letter case, so lowercasing is a no-op there.
      toast.success(
        fmt(t.toastMarked, { order: order.orderNumber, outcome: outcomeLabel[outcome].toLowerCase() })
      );
      onResolved(task.id);
    });

  let lockLine: string | null = null;
  if (mine) {
    lockLine = expired ? t.yourClaimExpired : fmt(t.yourClaim, { n: minutesUntil(task.lockExpiresAt, now) });
  } else if (inProgress) {
    lockLine = expired
      ? fmt(t.heldByExpired, { name: holderName })
      : fmt(t.heldBy, { name: holderName, n: minutesUntil(task.lockExpiresAt, now) });
  }

  let callbackLine: string | null = null;
  if (!inProgress && task.nextRetryAt) {
    const due = new Date(task.nextRetryAt).getTime() <= now;
    callbackLine = fmt(due ? t.callbackDue : t.callbackLater, { time: formatDateTime(task.nextRetryAt) });
  }

  return (
    <Card className="space-y-4 p-5">
      <OrderSummary task={task} aside={<AttemptsBadge count={task.attemptCount} />} />

      {(callbackLine || lastAttempt) && (
        <div className="space-y-0.5 text-sm text-ink-soft">
          {callbackLine && <p className="font-medium text-accent-dark">{callbackLine}</p>}
          {lastAttempt && (
            <p>
              {fmt(t.lastAttempt, {
                outcome: outcomeLabel[lastAttempt.outcome],
                agent: lastAttempt.agent?.fullName ?? t.unknownAgent,
                time: formatDateTime(lastAttempt.createdAt),
              })}
            </p>
          )}
        </div>
      )}

      {lockLine && (
        <p className={mine && expired ? "text-sm font-medium text-danger" : "text-sm text-ink-soft"}>
          {lockLine}
        </p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {mine && !expired ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                type="button"
                size="lg"
                variant={outcome === o ? "primary" : "outline"}
                onClick={() => setOutcome(o)}
                disabled={busy}
              >
                {outcomeLabel[o]}
              </Button>
            ))}
          </div>

          {outcome === "rejected" && (
            <TextField
              label={t.rejectionReason}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t.rejectionPlaceholder}
            />
          )}

          <Field label={t.notes}>
            {({ id }) => (
              <Textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !outcome || rejectionMissing}>
              {busy ? t.saving : t.saveOutcome}
            </Button>
            <Button variant="outline" onClick={release} disabled={busy}>
              {t.release}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canConfirm && (!inProgress || expired) && (
            <Button onClick={claim} disabled={busy}>
              {busy ? t.claiming : mine ? t.reclaim : inProgress ? t.takeOver : t.claimAndCall}
            </Button>
          )}
          {inProgress && !mine && !expired && canManage && (
            <Button variant="outline" onClick={release} disabled={busy}>
              {busy ? t.releasing : t.release}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** A finished task: outcome, who and when, the attempt history, and a manager's correction. */
function DoneCard({ task, onChanged }: { task: ConfirmationTask; onChanged: (task: ConfirmationTask) => void }) {
  const t = useT(STRINGS);
  const outcomeLabel = useOutcomeLabels();
  const { canManage } = useQueueAbilities();
  const [correcting, setCorrecting] = useState(false);

  const outcome = task.outcome ?? "confirmed";
  const last = task.attempts[task.attempts.length - 1];

  return (
    <Card className="space-y-4 p-5">
      <OrderSummary task={task} aside={<StatusBadge value={outcome} text={outcomeLabel[outcome]} />} />

      <div className="space-y-1 text-sm text-ink-soft">
        <p>
          {fmt(t.doneAt, { outcome: outcomeLabel[outcome], time: formatDateTime(task.completedAt ?? task.updatedAt) })}
          {last?.agent && <> · {fmt(t.doneBy, { agent: last.agent.fullName })}</>}
        </p>
        {task.rejectionReason && <p className="text-ink">“{task.rejectionReason}”</p>}
      </div>

      {task.attempts.length > 0 && (
        <details className="rounded-[0.5rem] border border-line px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-ink">
            {fmt(t.history, { n: task.attempts.length })}
          </summary>
          <ol className="mt-2 space-y-2">
            {task.attempts.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </ol>
        </details>
      )}

      {task.correctable && canManage && (
        <Button variant="outline" onClick={() => setCorrecting(true)}>
          {t.correct}
        </Button>
      )}

      {correcting && (
        <CorrectOutcomeModal
          task={task}
          onClose={() => setCorrecting(false)}
          onCorrected={(updated) => {
            setCorrecting(false);
            onChanged(updated);
          }}
        />
      )}
    </Card>
  );
}

function AttemptRow({ attempt }: { attempt: ConfirmationAttempt }) {
  const t = useT(STRINGS);
  const outcomeLabel = useOutcomeLabels();
  const what = attempt.previousOutcome
    ? fmt(t.corrected, { from: outcomeLabel[attempt.previousOutcome], to: outcomeLabel[attempt.outcome] })
    : outcomeLabel[attempt.outcome];
  return (
    <li className="border-b border-line pb-2 last:border-b-0 last:pb-0">
      <p className="text-ink">
        <span className="font-medium">{what}</span> · {sourceLabel(t, attempt.source)} ·{" "}
        {attempt.agent?.fullName ?? t.unknownAgent}
      </p>
      <p className="text-xs text-ink-soft">{formatDateTime(attempt.createdAt)}</p>
      {attempt.notes && <p className="mt-0.5 whitespace-pre-line text-ink-soft">{attempt.notes}</p>}
    </li>
  );
}

function CorrectOutcomeModal({
  task,
  onClose,
  onCorrected,
}: {
  task: ConfirmationTask;
  onClose: () => void;
  onCorrected: (task: ConfirmationTask) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const outcomeLabel = useOutcomeLabels();
  // The order's state is what gets corrected; the target is the other final outcome.
  const target = task.order.confirmationState === "rejected" ? "confirmed" : "rejected";
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.correctConfirmationOutcome(workspaceId, task.id, {
        outcome: target,
        reason: reason.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(
        fmt(t.toastCorrected, { order: task.order.orderNumber, outcome: outcomeLabel[target].toLowerCase() })
      );
      onCorrected(updated);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.correctTitle, { order: task.order.orderNumber })}
      description={target === "rejected" ? t.correctToRejected : t.correctToConfirmed}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            variant={target === "rejected" ? "danger" : "primary"}
            onClick={submit}
            disabled={busy || !reason.trim()}
          >
            {busy ? t.saving : fmt(t.correctSubmit, { outcome: outcomeLabel[target] })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField
          label={t.correctReason}
          required
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.correctReasonPlaceholder}
        />
        <Field label={t.correctNotes}>
          {({ id }) => (
            <Textarea id={id} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
          )}
        </Field>
      </div>
    </Modal>
  );
}
