import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  returnDecide,
  returnPhotosOf,
  returnSourceOf,
  type Order,
  type ReturnDecisionPayload,
  type ReturnItemLine,
  type ReturnReasonCode,
  type ReturnRequest,
  type ReturnStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewOrderButton } from "@/components/ViewOrderButton";
import { SHOPPER_RETURNS_ENABLED } from "@/lib/features";
import { ReturnDecisionSheet } from "./ReturnDecisionSheet";
import { ReturnPhotos, ReturnSourceBadge } from "./ReturnExtras";
import { ReturnExchangeBadge, ReturnHandling } from "./ReturnHandling";
import { ReturnSettingsSheet, useShopperReturnsSettings } from "./ReturnSettingsSheet";

/** "" is the All tab — the backend simply omits the status filter. */
type StatusFilter = "" | ReturnStatus;

const STRINGS = {
  en: {
    title: "Returns",
    description:
      "Returns opened against delivered orders. Approving one settles it with the customer; putting the units back on the shelf is a separate step.",
    filterLabel: "Filter returns by status",
    tabRequested: "Requested",
    tabApproved: "Approved",
    tabRejected: "Rejected",
    tabReceived: "Received",
    tabRefunded: "Refunded",
    tabAll: "All",
    statusRequested: "Requested",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusReceived: "Received",
    statusRefunded: "Refunded",
    emptyRequested: "Nothing is waiting for a decision.",
    emptyApproved: "No approved returns are waiting to be restocked.",
    emptyRejected: "No returns have been rejected.",
    emptyReceived: "Nothing has been received back yet.",
    emptyRefunded: "No returns have been refunded.",
    emptyAll: "No returns yet. One can be opened from an order once it has been delivered.",
    openOrder: "View order",
    itemsLabel: "Items",
    reasonDamaged: "Damaged",
    reasonDefective: "Defective",
    reasonWrongItem: "Wrong item",
    reasonNotAsDescribed: "Not as described",
    reasonNoLongerWanted: "No longer wanted",
    reasonArrivedLate: "Arrived late",
    reasonOther: "Other",
    approve: "Approve",
    reject: "Reject",
    shopperReturns: "Returns from customers",
    shopperReturnsOn: "Returns from customers: on",
    shopperReturnsOff: "Returns from customers: off",
    restock: "Restock units",
    restockedAt: "Restocked {date}",
    saving: "Saving…",
    toastApproved: "Return approved. Restock the units when they arrive back.",
    toastRejected: "Return rejected.",
    toastRestocked: "Returned units added back to stock.",
  },
  ar: {
    title: "المرتجعات",
    description:
      "المرتجعات المفتوحة على أوردرات تم تسليمها. الموافقة تنهي الأمر مع العميل، وإعادة القطع إلى المخزون خطوة منفصلة.",
    filterLabel: "تصفية المرتجعات حسب الحالة",
    tabRequested: "مطلوبة",
    tabApproved: "مقبولة",
    tabRejected: "مرفوضة",
    tabReceived: "مستلمة",
    tabRefunded: "مستردة",
    tabAll: "الكل",
    statusRequested: "مطلوب",
    statusApproved: "مقبول",
    statusRejected: "مرفوض",
    statusReceived: "مستلم",
    statusRefunded: "مسترد",
    emptyRequested: "لا يوجد ما ينتظر قرارًا.",
    emptyApproved: "لا توجد مرتجعات مقبولة تنتظر إعادة التخزين.",
    emptyRejected: "لا توجد مرتجعات مرفوضة.",
    emptyReceived: "لم يتم استلام أي مرتجع بعد.",
    emptyRefunded: "لا توجد مرتجعات تم ردّ قيمتها.",
    emptyAll: "لا توجد مرتجعات بعد. يمكن فتح مرتجع من الأوردر بعد تسليمه.",
    openOrder: "فتح الأوردر",
    itemsLabel: "العناصر",
    reasonDamaged: "تالف",
    reasonDefective: "به عيب",
    reasonWrongItem: "منتج خاطئ",
    reasonNotAsDescribed: "مخالف للوصف",
    reasonNoLongerWanted: "لم يعد مطلوبًا",
    reasonArrivedLate: "وصل متأخرًا",
    reasonOther: "سبب آخر",
    approve: "قبول",
    reject: "رفض",
    shopperReturns: "المرتجعات من العملاء",
    shopperReturnsOn: "المرتجعات من العملاء: مفعّلة",
    shopperReturnsOff: "المرتجعات من العملاء: متوقفة",
    restock: "إعادة إلى المخزون",
    restockedAt: "أُعيد إلى المخزون {date}",
    saving: "جارٍ الحفظ…",
    toastApproved: "تم قبول المرتجع. أعد القطع إلى المخزون عند وصولها.",
    toastRejected: "تم رفض المرتجع.",
    toastRestocked: "تمت إعادة القطع المرتجعة إلى المخزون.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const REASON_KEYS = {
  damaged: "reasonDamaged",
  defective: "reasonDefective",
  wrong_item: "reasonWrongItem",
  not_as_described: "reasonNotAsDescribed",
  no_longer_wanted: "reasonNoLongerWanted",
  arrived_late: "reasonArrivedLate",
  other: "reasonOther",
} satisfies Record<ReturnReasonCode, keyof Strings>;

/**
 * The backend keeps one string: a reason code, or "code: the merchant's own
 * words". Split it back apart so the code can be translated and the detail
 * shown verbatim, in whatever language it was typed.
 */
function splitReason(reason: string): { code: string; detail: string | null } {
  const at = reason.indexOf(":");
  if (at === -1) return { code: reason.trim(), detail: null };
  return { code: reason.slice(0, at).trim(), detail: reason.slice(at + 1).trim() || null };
}

function reasonLabel(code: string, t: Strings): string {
  const key = REASON_KEYS[code as ReturnReasonCode] as keyof Strings | undefined;
  return key ? t[key] : humanize(code);
}

type OrderEntry =
  | { status: "loading" }
  | { status: "ready"; order: Order }
  | { status: "error" };

/**
 * GET /returns carries an `orderId` and nothing else — no order number, no
 * customer, no product names behind the returned lines. So each distinct order
 * is fetched separately, all of them in flight at once, and cached for the life
 * of the page so switching filters never refetches one.
 *
 * `allSettled`: an order that 404s (or that this role may not read) leaves its
 * card in the fallback state. It must never blank the queue — the return row
 * itself came back fine, and it is still actionable without the order.
 */
function useOrdersById(orderIds: string[]): Record<string, OrderEntry> {
  const workspaceId = useWorkspaceId();
  const [entries, setEntries] = useState<Record<string, OrderEntry>>({});
  // Ids already requested, so a re-render never re-fetches. Tied to the
  // workspace it was filled for: switching workspace invalidates the lot.
  const asked = useRef<{ workspaceId: string; ids: Set<string> }>({ workspaceId, ids: new Set() });
  const key = orderIds.join(",");

  useEffect(() => {
    let stale = false;
    if (asked.current.workspaceId !== workspaceId) {
      asked.current = { workspaceId, ids: new Set() };
      setEntries({});
    }
    const missing = orderIds.filter((id) => !asked.current.ids.has(id));
    if (missing.length === 0) return;
    for (const id of missing) asked.current.ids.add(id);

    setEntries((prev) => {
      const next = { ...prev };
      for (const id of missing) next[id] = { status: "loading" };
      return next;
    });

    void Promise.allSettled(
      missing.map((id) => apiClient.getOrder(workspaceId, id))
    ).then((results) => {
      if (stale) return;
      setEntries((prev) => {
        const next = { ...prev };
        results.forEach((result, i) => {
          const id = missing[i];
          next[id] =
            result.status === "fulfilled"
              ? { status: "ready", order: result.value }
              : { status: "error" };
        });
        return next;
      });
    });

    return () => {
      stale = true;
    };
    // `key` stands in for orderIds — a new array of the same ids is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return entries;
}

export function ReturnsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  // Requested first: this page is a decision queue before it is an archive.
  const [status, setStatus] = useState<StatusFilter>("requested");

  const list = useAsync(
    () => apiClient.listReturns(workspaceId, { status: status || undefined }),
    [workspaceId, status]
  );
  const returns = list.data ?? [];
  const orders = useOrdersById([...new Set(returns.map((r) => r.orderId))]);

  const tabs: ReadonlyArray<FilterTab<StatusFilter>> = [
    { value: "requested", label: t.tabRequested },
    { value: "approved", label: t.tabApproved },
    { value: "rejected", label: t.tabRejected },
    { value: "received", label: t.tabReceived },
    { value: "refunded", label: t.tabRefunded },
    { value: "", label: t.tabAll },
  ];

  const emptyMessage = {
    requested: t.emptyRequested,
    approved: t.emptyApproved,
    rejected: t.emptyRejected,
    received: t.emptyReceived,
    refunded: t.emptyRefunded,
    "": t.emptyAll,
  }[status];

  /** An updated row leaves the list when it no longer matches the active
   * filter — approving from the Requested tab, restocking from Approved. */
  function applyUpdate(updated: ReturnRequest) {
    list.setData((prev) => {
      const rows = prev ?? [];
      if (status && updated.status !== status) return rows.filter((r) => r.id !== updated.id);
      return rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
    });
  }

  return (
    <div className="max-w-3xl">
      {/* Whether customers may ask for a return themselves, behind one header button (lib/features). */}
      <PageHeader title={t.title} description={t.description} actions={SHOPPER_RETURNS_ENABLED ? <ShopperReturnsButton /> : undefined} />

      <div className="mb-4">
        <FilterTabs tabs={tabs} value={status} onChange={setStatus} label={t.filterLabel} />
      </div>

      <DataState
        skeleton={<ListSkeleton variant="card" rows={4} />}
        loading={list.loading}
        error={list.error}
        empty={returns.length === 0}
        emptyMessage={emptyMessage}
        onRetry={() => list.refresh()}
      >
        <div className="space-y-3">
          {returns.map((ret) => (
            <ReturnCard
              key={ret.id}
              returnRequest={ret}
              orderEntry={orders[ret.orderId]}
              onUpdated={applyUpdate}
              onPhotosExpired={() => void list.refresh({ silent: true })}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

/**
 * The header's way into the shopper-returns setting: it says whether customers
 * can ask for a return from their tracking page, and opens the sheet that
 * changes it. Drawn only while the feature is switched on, so its read is too.
 */
function ShopperReturnsButton() {
  const t = useT(STRINGS);
  const settings = useShopperReturnsSettings();
  const [open, setOpen] = useState(false);
  const label = !settings.data ? t.shopperReturns : settings.data.enabled ? t.shopperReturnsOn : t.shopperReturnsOff;
  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ReturnSettingsSheet open={open} onClose={() => setOpen(false)} settings={settings} />
    </>
  );
}

function ReturnCard({
  returnRequest: ret,
  orderEntry,
  onUpdated,
  onPhotosExpired,
}: {
  returnRequest: ReturnRequest;
  orderEntry: OrderEntry | undefined;
  onUpdated: (updated: ReturnRequest) => void;
  /** The photos' signed links ran out: the list is read again for fresh ones. */
  onPhotosExpired: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const [busy, setBusy] = useState<"approve" | "reject" | "restock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // With shopper returns on, a decision goes through a sheet: a message for the customer, and an exchange's shipping.
  const [deciding, setDeciding] = useState<{ action: "approve" | "reject"; open: boolean } | null>(null);

  const order = orderEntry?.status === "ready" ? orderEntry.order : null;
  const { code, detail } = splitReason(ret.reason);

  const statusText = {
    requested: t.statusRequested,
    approved: t.statusApproved,
    rejected: t.statusRejected,
    received: t.statusReceived,
    refunded: t.statusRefunded,
  }[ret.status];

  /** The product name behind a returned line, once its order has landed: "…"
   * while that is still in flight, the short id if it never arrives. */
  function lineName(line: ReturnItemLine): string {
    const item = order?.items.find((i) => i.id === line.orderItemId);
    if (item) return item.productNameSnapshot;
    if (!orderEntry || orderEntry.status === "loading") return "…";
    return line.orderItemId.slice(0, 8);
  }

  async function run(action: "approve" | "reject" | "restock") {
    setBusy(action);
    setError(null);
    try {
      const updated =
        action === "restock"
          ? await apiClient.restockReturn(workspaceId, ret.id)
          : await apiClient.moderateReturn(workspaceId, ret.id, action);
      toast.success(
        action === "approve"
          ? t.toastApproved
          : action === "reject"
            ? t.toastRejected
            : t.toastRestocked
      );
      onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  }

  async function decide(payload: ReturnDecisionPayload) {
    const updated = await returnDecide(apiClient, workspaceId, ret.id, payload);
    toast.success(payload.action === "approve" ? t.toastApproved : t.toastRejected);
    setDeciding((current) => (current ? { ...current, open: false } : current));
    onUpdated(updated);
  }
  const moderate = (action: "approve" | "reject") => (SHOPPER_RETURNS_ENABLED ? setDeciding({ action, open: true }) : void run(action));
  const photos = SHOPPER_RETURNS_ENABLED ? returnPhotosOf(ret) : [];

  // The backend moderates only a `requested` return and restocks only an
  // approved (or received) one that hasn't been restocked yet — so these
  // buttons are absent, not disabled, whenever the call could only 409.
  const canModerate = ret.status === "requested";
  const canRestock =
    (ret.status === "approved" || ret.status === "received") && !ret.restockedAt;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/orders/${ret.orderId}`}
            className={
              order
                ? "font-medium text-ink hover:text-primary"
                : "font-medium text-ink-soft hover:text-primary"
            }
          >
            {order ? order.orderNumber : t.openOrder}
          </Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            {order?.contactSnapshot?.fullName
              ? `${order.contactSnapshot.fullName} · ${formatDate(ret.createdAt)}`
              : formatDate(ret.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SHOPPER_RETURNS_ENABLED && returnSourceOf(ret) === "shopper" && <ReturnSourceBadge />}
          {SHOPPER_RETURNS_ENABLED && <ReturnExchangeBadge ret={ret} />}
          <StatusBadge value={ret.status} text={statusText} />
        </div>
      </div>

      <div className="text-sm">
        <p className="text-ink">{reasonLabel(code, t)}</p>
        {/* Its own line, with dir="auto": the detail is the merchant's own
            words, not necessarily in the language the dashboard is set to, and
            on one line with the label the two scripts reorder into a tangle. */}
        {detail && (
          <p dir="auto" className="mt-0.5 text-ink-soft">
            {detail}
          </p>
        )}
      </div>

      <div>
        <span className="text-xs font-medium tracking-wide text-ink-soft uppercase">
          {t.itemsLabel}
        </span>
        <ul className="mt-1 space-y-0.5 text-sm text-ink">
          {ret.items.map((line) => (
            <li key={line.orderItemId} className="flex gap-2">
              <span className="tabular-nums text-ink-soft">{line.quantity}×</span>
              <span dir="auto" className="min-w-0">
                {lineName(line)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* What the customer attached and asked for: photos, the exchange («M → L»), the message they were sent. */}
      {photos.length > 0 && <ReturnPhotos photos={photos} onExpired={onPhotosExpired} />}
      {SHOPPER_RETURNS_ENABLED && <ReturnHandling ret={ret} order={order} className="space-y-2 text-sm" />}

      {ret.restockedAt && (
        <p className="text-sm text-ink-soft">
          {fmt(t.restockedAt, { date: formatDateTime(ret.restockedAt) })}
        </p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {canModerate && (
          <>
            <Button size="sm" onClick={() => moderate("approve")} disabled={busy !== null}>
              {busy === "approve" ? t.saving : t.approve}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => moderate("reject")}
              disabled={busy !== null}
            >
              {busy === "reject" ? t.saving : t.reject}
            </Button>
          </>
        )}
        {canRestock && (
          <Button size="sm" onClick={() => run("restock")} disabled={busy !== null}>
            {busy === "restock" ? t.saving : t.restock}
          </Button>
        )}
        <ViewOrderButton orderId={ret.orderId} orderNumber={order?.orderNumber} size="sm" />
      </div>

      {SHOPPER_RETURNS_ENABLED && (
        <ReturnDecisionSheet
          ret={ret}
          action={deciding?.action ?? "approve"}
          open={Boolean(deciding?.open)}
          who={order ? [order.contactSnapshot?.fullName, order.orderNumber].filter(Boolean).join(" · ") : undefined}
          currency={order?.currency}
          onClose={() => setDeciding((current) => (current ? { ...current, open: false } : current))}
          onConfirm={decide}
        />
      )}
    </Card>
  );
}
