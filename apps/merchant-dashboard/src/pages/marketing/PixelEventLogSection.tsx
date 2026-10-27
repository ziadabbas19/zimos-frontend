import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, RefreshCw } from "lucide-react";
import { Button, Card } from "@store-builder/ui";
import {
  trackingPixelsListEvents,
  type TrackingPixelEventDto,
  type TrackingPixelEventStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRelativeTime } from "@/lib/relativeTime";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { platformName } from "./pixelPlatforms";

const STRINGS = {
  en: {
    title: "Server event log",
    description: "The last {n} events your store sent to the ad platforms from the server, and whether each was accepted.",
    refresh: "Refresh",
    filter: "Filter events by result",
    all: "All",
    sent: "Accepted",
    failed: "Failed",
    emptyTitle: "No server events yet",
    emptyBody: "Events appear here once a pixel has the Conversions API turned on and the store gets visits or orders.",
    emptyFiltered: "No events with this result.",
    colEvent: "Event",
    colPixel: "Pixel",
    colResult: "Result",
    colWhen: "When",
    test: "Test",
    ev_purchase: "Purchase",
    ev_view_content: "Product view",
    ev_add_to_cart: "Add to cart",
    ev_begin_checkout: "Checkout started",
    ev_add_payment_info: "Payment method chosen",
    ev_lead: "Lead",
    ev_page_view: "Page view",
  },
  ar: {
    title: "سجل أحداث السيرفر",
    description: "آخر {n} حدث أرسله متجرك لمنصات الإعلانات من السيرفر، وهل قُبل كل منها.",
    refresh: "تحديث",
    filter: "تصفية الأحداث حسب النتيجة",
    all: "الكل",
    sent: "مقبول",
    failed: "فشل",
    emptyTitle: "لا توجد أحداث من السيرفر بعد",
    emptyBody: "تظهر الأحداث هنا بعد تفعيل الـ Conversions API على أحد البيكسلات ووصول زيارات أو طلبات للمتجر.",
    emptyFiltered: "لا توجد أحداث بهذه النتيجة.",
    colEvent: "الحدث",
    colPixel: "البيكسل",
    colResult: "النتيجة",
    colWhen: "الوقت",
    test: "تجريبي",
    ev_purchase: "شراء",
    ev_view_content: "مشاهدة منتج",
    ev_add_to_cart: "إضافة للسلة",
    ev_begin_checkout: "بدء الطلب",
    ev_add_payment_info: "اختيار وسيلة الدفع",
    ev_lead: "عميل محتمل",
    ev_page_view: "فتح صفحة",
  },
} satisfies Messages;

type Filter = "all" | TrackingPixelEventStatus;
const PAGE_SIZE = 50;

/** Short names for the log's narrow column; the other platforms keep their full name (pixelPlatforms.ts). */
const PLATFORM_NAMES: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
};

/** Marketing → Tracking tools: what the server sent to the ad platforms. */
export function PixelEventLogSection({ reloadKey = 0 }: { reloadKey?: number }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<TrackingPixelEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [keep, setKeep] = useState(500);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const call = useRef(0);

  const load = useCallback(
    async (cursor: string | null, silent = false) => {
      const id = ++call.current;
      if (cursor) setLoadingMore(true);
      else if (!silent) setLoading(true);
      setError(null);
      try {
        const page = await trackingPixelsListEvents(apiClient, workspaceId, {
          limit: PAGE_SIZE,
          cursor,
          status: filter === "all" ? undefined : filter,
        });
        if (id !== call.current) return;
        setEvents((prev) => (cursor ? [...prev, ...page.events] : page.events));
        setNextCursor(page.nextCursor);
        setKeep(page.keep);
      } catch (err) {
        if (id === call.current) setError(err);
      } finally {
        if (id === call.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, filter]
  );

  useEffect(() => {
    void load(null, reloadKey > 0);
  }, [load, reloadKey]);

  const eventLabel = (name: string) => (t as Record<string, string>)[`ev_${name}`] ?? name;

  const columns: Column<TrackingPixelEventDto>[] = [
    {
      key: "event",
      header: t.colEvent,
      cell: (e) => (
        <div>
          <span className="font-medium text-ink">{eventLabel(e.eventName)}</span>
          {e.isTest && <span className="ms-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">{t.test}</span>}
          {e.eventId && (
            <div dir="ltr" className="mt-0.5 max-w-52 truncate font-mono text-xs text-ink-soft text-start">
              {e.eventId}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "pixel",
      header: t.colPixel,
      cell: (e) => (
        <div className="flex items-start gap-2">
          <PlatformIcon platform={e.platform} className="mt-px text-ink" />
          <div className="min-w-0">
            <div className="text-ink">{PLATFORM_NAMES[e.platform] ?? platformName(e.platform)}</div>
            <code dir="ltr" className="font-mono text-xs text-ink-soft">
              {e.pixelId}
            </code>
          </div>
        </div>
      ),
    },
    {
      key: "result",
      header: t.colResult,
      cell: (e) => (
        <div>
          <StatusBadge value={e.status} tone={e.status === "sent" ? "success" : "danger"} text={e.status === "sent" ? t.sent : t.failed} />
          {e.error && <div className="mt-1 max-w-72 text-xs text-danger">{e.error}</div>}
        </div>
      ),
    },
    { key: "when", header: t.colWhen, align: "end", cell: (e) => <span className="text-ink-soft">{formatRelativeTime(e.createdAt)}</span> },
  ];

  return (
    <Card className="mb-6 gap-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ListChecks className="size-4 text-primary" aria-hidden />
            {t.title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">{fmt(t.description, { n: keep })}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load(null)} disabled={loading}>
          <RefreshCw className="size-4" aria-hidden />
          {t.refresh}
        </Button>
      </div>

      <FilterTabs
        className="mt-3 self-start"
        label={t.filter}
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: t.all },
          { value: "sent", label: t.sent },
          { value: "failed", label: t.failed },
        ]}
      />

      <div className="mt-3">
        <DataState skeleton={<ListSkeleton />} loading={loading} error={error} onRetry={() => void load(null)}>
          {events.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="size-6" aria-hidden />}
              title={filter === "all" ? t.emptyTitle : t.emptyFiltered}
              description={filter === "all" ? t.emptyBody : undefined}
            />
          ) : (
            <DataTable columns={columns} rows={events} rowKey={(e) => e.id} minWidth="40rem" />
          )}
          <LoadMore hasMore={Boolean(nextCursor)} loading={loadingMore} onClick={() => void load(nextCursor)} />
        </DataState>
      </div>
    </Card>
  );
}
