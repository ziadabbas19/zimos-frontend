import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  isInvalidCursorError,
  type CheckoutRecoveryStatus,
  type CheckoutSession,
  type CheckoutSessionListParams,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatDateTime, formatMoney, formatOptions } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";

/**
 * System role keys carrying orders.manage, which PATCH .../checkout-sessions/:id
 * needs (Backend core/security/permissions.js SYSTEM_ROLES; owner holds "*").
 * The list itself only needs orders.view. The dashboard sees only the role key,
 * so a custom role with the permission doesn't get the buttons; one without it
 * that slips through gets the 403 toast.
 */
const RECOVERY_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

/**
 * Each tab is a list query. "To contact" and "All abandoned" read only
 * abandoned sessions; the follow-up tabs read every session with that recovery
 * status, since a contacted shopper may be back at checkout and a recovered one
 * has usually ordered (the server turns "contacted" into "recovered" when an
 * order from that shopper arrives).
 */
type Filter = "toContact" | "contacted" | "recovered" | "lost" | "all";

const FILTER_QUERY: Record<Filter, Pick<CheckoutSessionListParams, "view" | "recoveryStatus">> = {
  toContact: { view: "abandoned", recoveryStatus: "not_contacted" },
  contacted: { view: "all", recoveryStatus: "contacted" },
  recovered: { view: "all", recoveryStatus: "recovered" },
  lost: { view: "all", recoveryStatus: "lost" },
  all: { view: "abandoned" },
};

const RECOVERY_TONE: Record<CheckoutRecoveryStatus, "neutral" | "info" | "success" | "warning"> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

const STRINGS = {
  en: {
    title: "Abandoned carts",
    description:
      "Shoppers who entered their phone at checkout but didn't place the order. A cart counts as abandoned after an hour with no activity.",
    filterLabel: "Which carts to show",
    tabToContact: "To contact",
    tabContacted: "Contacted",
    tabRecovered: "Recovered",
    tabLost: "Lost",
    tabAll: "All abandoned",
    emptyToContact: "No abandoned carts are waiting for a follow-up.",
    emptyContacted: "No carts are marked as contacted.",
    emptyRecovered: "No carts have been recovered yet.",
    emptyLost: "No carts are marked as lost.",
    emptyAll: "No abandoned carts. When a shopper leaves checkout after entering their phone, they'll show up here.",
    unnamed: "No name given",
    call: "Call {phone}",
    items: "Items",
    total: "Total",
    lastActivity: "Last activity {date}",
    contactedOn: "Contacted {date}",
    offer: "Offer: {name}",
    fromFunnel: "Funnel",
    stillAtCheckout: "Back at checkout",
    orderPlaced: "Ordered as {order}",
    recovery_not_contacted: "Not contacted",
    recovery_contacted: "Contacted",
    recovery_recovered: "Recovered",
    recovery_lost: "Lost",
    markContacted: "Mark contacted",
    markRecovered: "Mark recovered",
    markLost: "Mark lost",
    reopen: "Reopen",
    saving: "Saving…",
    savedContacted: "Marked as contacted.",
    savedRecovered: "Marked as recovered.",
    savedLost: "Marked as lost.",
    savedReopened: "Cart reopened.",
  },
  ar: {
    title: "السلات المتروكة",
    description:
      "عملاء كتبوا رقم هاتفهم في صفحة الدفع لكن لم يكملوا الأوردر. تُعتبر السلة متروكة بعد ساعة بدون أي نشاط.",
    filterLabel: "السلات المعروضة",
    tabToContact: "بانتظار التواصل",
    tabContacted: "تم التواصل",
    tabRecovered: "مستردة",
    tabLost: "خسارة",
    tabAll: "كل المتروكة",
    emptyToContact: "لا توجد سلات متروكة بانتظار المتابعة.",
    emptyContacted: "لا توجد سلات مُعلَّمة كتم التواصل.",
    emptyRecovered: "لم تُسترد أي سلة بعد.",
    emptyLost: "لا توجد سلات مُعلَّمة كخسارة.",
    emptyAll: "لا توجد سلات متروكة. عندما يترك عميل صفحة الدفع بعد كتابة رقمه، سيظهر هنا.",
    unnamed: "بدون اسم",
    call: "اتصل بـ {phone}",
    items: "المنتجات",
    total: "الإجمالي",
    lastActivity: "آخر نشاط {date}",
    contactedOn: "تم التواصل {date}",
    offer: "العرض: {name}",
    fromFunnel: "مسار بيع",
    stillAtCheckout: "عاد لصفحة الدفع",
    orderPlaced: "طلب الأوردر {order}",
    recovery_not_contacted: "لم يتم التواصل",
    recovery_contacted: "تم التواصل",
    recovery_recovered: "مستردة",
    recovery_lost: "خسارة",
    markContacted: "تم التواصل",
    markRecovered: "تم الاسترداد",
    markLost: "خسارة",
    reopen: "إعادة فتح",
    saving: "جارٍ الحفظ…",
    savedContacted: "تم التعليم كتم التواصل.",
    savedRecovered: "تم التعليم كمستردة.",
    savedLost: "تم التعليم كخسارة.",
    savedReopened: "تمت إعادة فتح السلة.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

interface RecoveryAction {
  to: CheckoutRecoveryStatus;
  label: keyof Strings;
  saved: keyof Strings;
}

/**
 * The buttons a session gets. The backend accepts any status from any status;
 * these are the moves that make sense in a follow-up. "Reopen" goes back to
 * where the merchant was before (contacted if they ever were). A session
 * recovered by an actual order has nothing left to do.
 */
function actionsFor(session: CheckoutSession): RecoveryAction[] {
  const reopen: RecoveryAction = {
    to: session.contactedAt ? "contacted" : "not_contacted",
    label: "reopen",
    saved: "savedReopened",
  };
  switch (session.recoveryStatus) {
    case "not_contacted":
      return [
        { to: "contacted", label: "markContacted", saved: "savedContacted" },
        { to: "lost", label: "markLost", saved: "savedLost" },
      ];
    case "contacted":
      return [
        { to: "recovered", label: "markRecovered", saved: "savedRecovered" },
        { to: "lost", label: "markLost", saved: "savedLost" },
      ];
    case "lost":
      return [reopen];
    case "recovered":
      return session.convertedOrder ? [] : [reopen];
  }
}

export function AbandonedCartsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [filter, setFilter] = useState<Filter>("toContact");
  const { currentWorkspace } = useWorkspace();
  const canManage = RECOVERY_ROLES.has(currentWorkspace?.role ?? "");

  const list = useCursorList<CheckoutSession>(
    async (cursor) => {
      const page = await apiClient.listCheckoutSessions(workspaceId, { ...FILTER_QUERY[filter], before: cursor });
      return { items: page.sessions, nextCursor: page.nextCursor };
    },
    [workspaceId, filter],
    // The cursor is a session id; the server rejects one that no longer exists.
    { isStaleCursor: (err) => isInvalidCursorError(err, "before") }
  );

  function onUpdated(updated: CheckoutSession) {
    const wanted = FILTER_QUERY[filter].recoveryStatus;
    list.setItems((prev) =>
      wanted && updated.recoveryStatus !== wanted
        ? prev.filter((s) => s.id !== updated.id)
        : prev.map((s) => (s.id === updated.id ? updated : s))
    );
  }

  const emptyMessage = {
    toContact: t.emptyToContact,
    contacted: t.emptyContacted,
    recovered: t.emptyRecovered,
    lost: t.emptyLost,
    all: t.emptyAll,
  }[filter];

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.description} />
      <FilterTabs
        label={t.filterLabel}
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "toContact", label: t.tabToContact },
          { value: "contacted", label: t.tabContacted },
          { value: "recovered", label: t.tabRecovered },
          { value: "lost", label: t.tabLost },
          { value: "all", label: t.tabAll },
        ]}
        className="[&>button]:min-h-11"
      />
      <DataState
        loading={list.loading}
        error={list.error}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
      >
        <ul className="space-y-3">
          {list.items.map((session) => (
            <li key={session.id}>
              <AbandonedCartCard session={session} canManage={canManage} onUpdated={onUpdated} />
            </li>
          ))}
        </ul>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

function AbandonedCartCard({
  session,
  canManage,
  onUpdated,
}: {
  session: CheckoutSession;
  canManage: boolean;
  onUpdated: (session: CheckoutSession) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<CheckoutRecoveryStatus | null>(null);
  const actions = canManage ? actionsFor(session) : [];

  async function run(action: RecoveryAction) {
    setBusy(action.to);
    try {
      const updated = await apiClient.updateCheckoutSessionRecovery(workspaceId, session.id, action.to);
      toast.success(t[action.saved]);
      onUpdated(updated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-medium text-ink">
            {session.customerName ? <bdi dir="ltr">{session.customerName}</bdi> : t.unnamed}
          </h2>
          {session.phone && (
            <a
              href={`tel:${session.phone}`}
              aria-label={fmt(t.call, { phone: `⁦${session.phone}⁩` })}
              className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              <bdi dir="ltr">{session.phone}</bdi>
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-ink-soft">
          {session.source === "funnel" && (
            <span className="rounded-full border border-line px-2 py-0.5">{t.fromFunnel}</span>
          )}
          <time dateTime={session.lastActivityAt}>
            {fmt(t.lastActivity, { date: formatDateTime(session.lastActivityAt) })}
          </time>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge
          value={session.recoveryStatus}
          tone={RECOVERY_TONE[session.recoveryStatus]}
          text={t[`recovery_${session.recoveryStatus}`]}
        />
        {session.status === "in_progress" && (
          <StatusBadge value="in_progress" tone="info" text={t.stillAtCheckout} />
        )}
        {session.contactedAt && (
          <span className="text-xs text-ink-soft">{fmt(t.contactedOn, { date: formatDate(session.contactedAt) })}</span>
        )}
      </div>
      {session.convertedOrder && (
        <Link
          to={`/orders/${session.convertedOrder.id}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {fmt(t.orderPlaced, { order: `⁦${session.convertedOrder.orderNumber}⁩` })}
        </Link>
      )}

      <h3 className="sr-only">{t.items}</h3>
      <ul className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
        {session.items.map((item, i) => {
          const options = formatOptions(item.options);
          return (
            <li key={`${item.variantId}-${i}`} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="text-ink" dir="auto">
                  {item.productName}
                </span>
                <span className="text-ink-soft"> × {item.quantity}</span>
                {options && (
                  <span className="block text-xs text-ink-soft" dir="auto">
                    {options}
                  </span>
                )}
                {item.offerName && (
                  <span className="block text-xs text-ink-soft">
                    {fmt(t.offer, { name: item.offerName })}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-ink">{formatMoney(item.lineTotalAmount, session.currency)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-between gap-3 border-t border-line pt-3 text-sm font-semibold text-ink">
        <span>{t.total}</span>
        <span>{formatMoney(session.subtotalAmount, session.currency)}</span>
      </div>

      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.to + action.label}
              variant="outline"
              onClick={() => void run(action)}
              disabled={busy !== null}
              className="min-h-11"
            >
              {busy === action.to ? t.saving : t[action.label]}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
