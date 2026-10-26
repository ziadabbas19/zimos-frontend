import { useEffect, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  funnelsList,
  webhooksDeliveryLog,
  webhooksResendDelivery,
  webhooksResendOrders,
  developersListWebhooks,
  type WebhookEndpointFull,
  type WebhookFilter,
  type WebhookLogEntry,
  type WebhookLogStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { FilterTabs } from "@/components/FilterTabs";
import { DataState } from "@/components/DataState";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * The parts of the webhooks screen added for SPEC §16.1: the per-endpoint
 * filter, the "switched off after three days" note, the store-wide delivery
 * log and the "resend to webhook" button of the order page.
 */

const STRINGS = {
  en: {
    filterTitle: "Send events about",
    filterAll: "The whole store",
    filterProduct: "One product only",
    filterFunnel: "One funnel only",
    filterHint: "Events that are not about a product or a funnel (a new customer, a contact form) are always sent.",
    pickProduct: "Choose a product",
    pickFunnel: "Choose a funnel",
    onlyProducts: "{count} product(s) only",
    onlyFunnels: "{count} funnel(s) only",
    disabledNote: "Switched off automatically after three days of failed deliveries. Fix the receiver, then press Resume.",
    failingNote: "Deliveries have been failing since {when}. After three days the endpoint is switched off.",
    logTitle: "Delivery log",
    logHint: "Every event sent to your endpoints, newest first.",
    all: "All",
    succeeded: "Succeeded",
    failed: "Failed",
    filterLabel: "Filter deliveries by result",
    empty: "Nothing was sent yet.",
    resend: "Resend",
    sending: "Sending…",
    attempts: "{count} attempt(s)",
    noAnswer: "no answer",
    pending: "Waiting",
    delivered: "Delivered",
    failedStatus: "Failed",
    exhausted: "Gave up",
    resendOrder: "Resend to webhook",
    resentToast: "Sent again to {count} endpoint(s).",
    resentNone: "No endpoint listens to new orders.",
  },
  ar: {
    filterTitle: "ابعت الأحداث الخاصة بـ",
    filterAll: "المتجر كله",
    filterProduct: "منتج واحد بس",
    filterFunnel: "فانل واحد بس",
    filterHint: "الأحداث اللي ملهاش علاقة بمنتج أو فانل (عميل جديد، نموذج تواصل) بتتبعت دايمًا.",
    pickProduct: "اختار منتج",
    pickFunnel: "اختار فانل",
    onlyProducts: "{count} منتج فقط",
    onlyFunnels: "{count} فانل فقط",
    disabledNote: "اتوقف تلقائيًا بعد ٣ أيام من فشل الإرسال. صلّح العنوان المستقبِل وبعدين اضغط «تشغيل».",
    failingNote: "الإرسال بيفشل من {when}. بعد ٣ أيام الـ endpoint هيتوقف.",
    logTitle: "سجل الإرسال",
    logHint: "كل حدث اتبعت للـ endpoints بتاعتك، الأحدث أولًا.",
    all: "الكل",
    succeeded: "نجح",
    failed: "فشل",
    filterLabel: "فلترة سجل الإرسال بالنتيجة",
    empty: "لسه مفيش حاجة اتبعتت.",
    resend: "إعادة الإرسال",
    sending: "جارٍ الإرسال…",
    attempts: "{count} محاولة",
    noAnswer: "مفيش رد",
    pending: "في الانتظار",
    delivered: "وصل",
    failedStatus: "فشل",
    exhausted: "توقفت المحاولات",
    resendOrder: "إعادة إرسال للـ webhook",
    resentToast: "اتبعت تاني لـ {count} endpoint.",
    resentNone: "مفيش endpoint بيستقبل الطلبات الجديدة.",
  },
} satisfies Messages;

// ───────────────────────────── filter field ─────────────────────────────

type FilterKind = "all" | "product" | "funnel";

/** In the add-endpoint dialog: the whole store, one product or one funnel. */
export function WebhookFilterField({ value, onChange }: { value: WebhookFilter | null; onChange: (next: WebhookFilter | null) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [kind, setKind] = useState<FilterKind>("all");
  const products = useAsync(
    async () => (kind === "product" ? (await apiClient.listProducts(workspaceId, { limit: 100 })).products : []),
    [workspaceId, kind]
  );
  const funnels = useAsync(async () => (kind === "funnel" ? funnelsList(apiClient, workspaceId) : []), [workspaceId, kind]);

  function pickKind(next: FilterKind) {
    setKind(next);
    onChange(null);
  }
  const selected = kind === "product" ? value?.productIds[0] ?? "" : kind === "funnel" ? value?.funnelIds[0] ?? "" : "";
  const options: Array<{ id: string; name: string }> = kind === "product" ? products.data ?? [] : kind === "funnel" ? funnels.data ?? [] : [];

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-ink">{t.filterTitle}</legend>
      <Select aria-label={t.filterTitle} value={kind} onChange={(e) => pickKind(e.target.value as FilterKind)}>
        <option value="all">{t.filterAll}</option>
        <option value="product">{t.filterProduct}</option>
        <option value="funnel">{t.filterFunnel}</option>
      </Select>
      {kind !== "all" && (
        <>
          <Select
            aria-label={kind === "product" ? t.pickProduct : t.pickFunnel}
            value={selected}
            onChange={(e) =>
              onChange(
                e.target.value
                  ? kind === "product"
                    ? { productIds: [e.target.value], funnelIds: [] }
                    : { productIds: [], funnelIds: [e.target.value] }
                  : null
              )
            }
          >
            <option value="">{kind === "product" ? t.pickProduct : t.pickFunnel}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-ink-soft">{t.filterHint}</p>
        </>
      )}
    </fieldset>
  );
}

// ───────────────────────────── endpoint notes ─────────────────────────────

/** Under an endpoint's row: its filter, and what is wrong with it if anything. */
export function WebhookEndpointNotes({ endpoint }: { endpoint: WebhookEndpointFull }) {
  const t = useT(STRINGS);
  const filter = endpoint.filter;
  const when = (iso: string) => new Date(iso).toLocaleString();
  return (
    <>
      {filter && (filter.productIds.length > 0 || filter.funnelIds.length > 0) && (
        <p className="text-xs text-ink-soft">
          {[
            filter.productIds.length > 0 ? fmt(t.onlyProducts, { count: filter.productIds.length }) : null,
            filter.funnelIds.length > 0 ? fmt(t.onlyFunnels, { count: filter.funnelIds.length }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {endpoint.disabledAt ? (
        <Alert variant="danger">{t.disabledNote}</Alert>
      ) : endpoint.failingSince && endpoint.isActive ? (
        <Alert variant="info">{fmt(t.failingNote, { when: when(endpoint.failingSince) })}</Alert>
      ) : null}
    </>
  );
}

// ───────────────────────────── delivery log ─────────────────────────────

const PAGE = 25;

/** Every delivery of the store: All / Succeeded / Failed, with Resend. */
export function WebhookDeliveryLog() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<WebhookLogStatus>("all");
  const [rows, setRows] = useState<WebhookLogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const first = useAsync(async () => {
    const page = await webhooksDeliveryLog(apiClient, workspaceId, { status, limit: PAGE });
    setRows(page.deliveries);
    setCursor(page.nextCursor);
    return page;
  }, [workspaceId, status]);

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    try {
      const page = await webhooksDeliveryLog(apiClient, workspaceId, { status, limit: PAGE, before: cursor });
      setRows((prev) => [...prev, ...page.deliveries]);
      setCursor(page.nextCursor);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setMore(false);
    }
  }

  async function resend(row: WebhookLogEntry) {
    setSending(row.id);
    try {
      const fresh = await webhooksResendDelivery(apiClient, workspaceId, row.id);
      setRows((prev) => prev.map((r) => (r.id === fresh.id ? fresh : r)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(null);
    }
  }

  const label: Record<WebhookLogEntry["status"], string> = {
    pending: t.pending,
    delivered: t.delivered,
    failed: t.failedStatus,
    exhausted: t.exhausted,
  };
  const tone = { pending: "warning", delivered: "success", failed: "danger", exhausted: "neutral" } as const;

  return (
    <div className="mt-8" data-search-anchor="webhook-deliveries">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{t.logTitle}</h3>
          <p className="text-sm text-ink-soft">{t.logHint}</p>
        </div>
        <FilterTabs
          label={t.filterLabel}
          value={status}
          onChange={setStatus}
          tabs={[
            { value: "all", label: t.all },
            { value: "succeeded", label: t.succeeded },
            { value: "failed", label: t.failed },
          ]}
        />
      </div>
      <div className="mt-3">
        <DataState loading={first.loading} error={first.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => void first.refresh()}>
          <ul className="divide-y divide-line rounded-md border border-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <code dir="ltr" className="font-mono text-sm text-ink">
                      {row.eventType}
                    </code>
                    <StatusBadge value={row.status} tone={tone[row.status]} text={label[row.status]} />
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {new Date(row.createdAt).toLocaleString()} ·{" "}
                    <code dir="ltr" className="break-all font-mono">
                      {row.url ?? "—"}
                    </code>{" "}
                    · {row.lastResponseStatus ? `HTTP ${row.lastResponseStatus}` : t.noAnswer} · {fmt(t.attempts, { count: row.attemptCount })}
                  </p>
                  {row.lastError && row.status !== "delivered" && <p className="mt-1 text-xs text-danger">{row.lastError}</p>}
                </div>
                <Button size="sm" variant="outline" disabled={sending === row.id} onClick={() => resend(row)}>
                  {sending === row.id ? t.sending : t.resend}
                </Button>
              </li>
            ))}
          </ul>
          <LoadMore hasMore={Boolean(cursor)} loading={more} onClick={loadMore} />
        </DataState>
      </div>
    </div>
  );
}

// ───────────────────────────── order page button ─────────────────────────────

/**
 * "Resend to webhook" on the order page. Shown only when the store has an
 * active endpoint and the viewer may manage webhooks (the list call tells).
 */
export function ResendToWebhookButton({ orderId }: { orderId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    developersListWebhooks(apiClient, workspaceId)
      .then((list) => alive && setAvailable(list.endpoints.some((endpoint) => endpoint.isActive)))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  if (!available) return null;

  async function resend() {
    setBusy(true);
    try {
      const result = await webhooksResendOrders(apiClient, workspaceId, [orderId]);
      if (result.deliveries > 0) toast.success(fmt(t.resentToast, { count: result.deliveries }));
      else toast.error(t.resentNone);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={resend}>
      {busy ? t.sending : t.resendOrder}
    </Button>
  );
}
