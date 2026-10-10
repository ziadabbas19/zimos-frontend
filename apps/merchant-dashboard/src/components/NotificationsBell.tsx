import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useGuardedLeave } from "@/lib/useUnsavedGuard";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Download,
  Megaphone,
  PackageMinus,
  PlugZap,
  ShoppingBag,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import {
  notificationsList,
  notificationsMarkAllRead,
  notificationsMarkRead,
  notificationsSummary,
  type MerchantNotificationDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRelativeTime } from "@/lib/relativeTime";
import { NOTIFICATION_STRINGS, notificationText } from "@/lib/notificationText";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";

const STRINGS = {
  en: {
    open: "Notifications",
    openUnread: "Notifications, {n} unread",
    title: "Notifications",
    close: "Close notifications",
    readAll: "Mark all as read",
    all: "All",
    unread: "Unread",
    emptyTitle: "You're all caught up",
    emptyBody: "New orders, low stock and anything that needs your attention will show up here.",
    emptyUnread: "No unread notifications.",
    settings: "Notification settings",
    filterLabel: "Filter notifications",
  },
  ar: {
    open: "الإشعارات",
    openUnread: "الإشعارات، {n} غير مقروءة",
    title: "الإشعارات",
    close: "إغلاق الإشعارات",
    readAll: "تحديد الكل كمقروء",
    all: "الكل",
    unread: "غير المقروءة",
    emptyTitle: "لا جديد حتى الآن",
    emptyBody: "الطلبات الجديدة وتنبيهات المخزون وكل ما يحتاج انتباهك سيظهر هنا.",
    emptyUnread: "لا توجد إشعارات غير مقروءة.",
    settings: "إعدادات الإشعارات",
    filterLabel: "تصفية الإشعارات",
  },
} satisfies Messages;

/** How often the header asks for the unread count while the tab is visible. */
const POLL_MS = 20_000;
const PAGE_SIZE = 20;

const ICONS: Record<string, LucideIcon> = {
  "order.new": ShoppingBag,
  "order.suspicious": AlertTriangle,
  "stock.low": PackageMinus,
  "integration.failed": PlugZap,
  "export.ready": Download,
  "shipping.batch_done": Truck,
  "wallet.low": Wallet,
  "wallet.limit_reached": Wallet,
  "wallet.refund": Wallet,
  "wallet.credit": Wallet,
  "wallet.fallback": Wallet,
  announcement: Megaphone,
  automation: Megaphone,
};

/**
 * The new-order chime: two short notes from the Web Audio API, so there is no
 * sound file to ship. Browsers only allow audio after the person has
 * interacted with the page; before that the call fails silently.
 */
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const note = (frequency: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    note(880, 0);
    note(1174.66, 0.16);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // No audio device or not allowed yet: the badge still updates.
  }
}

/** The bell in the header: unread badge, new-order sound, and the drawer. */
export function NotificationsBell() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  // The newest new-order notification already seen, per store; null until the
  // first answer so opening the dashboard never rings for old orders.
  const lastOrderAt = useRef<string | null | undefined>(undefined);

  const poll = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const summary = await notificationsSummary(apiClient, workspaceId);
      setUnreadCount(summary.unreadCount);
      const latest = summary.latestOrderNotificationAt;
      if (lastOrderAt.current !== undefined && latest && (!lastOrderAt.current || latest > lastOrderAt.current)) {
        if (summary.soundEnabled) playChime();
      }
      lastOrderAt.current = latest;
    } catch {
      // A failed poll keeps the last known count; the next one retries.
    }
  }, [workspaceId]);

  useEffect(() => {
    lastOrderAt.current = undefined;
    setUnreadCount(0);
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  if (!workspaceId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unreadCount > 0 ? t.openUnread.replace("{n}", String(unreadCount)) : t.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-slot="notifications-bell"
        className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-primary-soft aria-expanded:text-primary-dark motion-reduce:transition-none dark:aria-expanded:text-primary pointer-coarse:size-11"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -end-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4.5 text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {/* Mounted on <body>: the bell sits in the dark top bar, the drawer follows the page theme. */}
      {open &&
        createPortal(
          <NotificationsDrawer
            workspaceId={workspaceId}
            onClose={() => setOpen(false)}
            onUnreadCount={setUnreadCount}
          />,
          document.body
        )}
    </>
  );
}

function NotificationsDrawer({
  workspaceId,
  onClose,
  onUnreadCount,
}: {
  workspaceId: string;
  onClose: () => void;
  onUnreadCount: (n: number) => void;
}) {
  const t = useT(STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const navigate = useNavigate();
  const leave = useGuardedLeave();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<MerchantNotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [unread, setUnread] = useState(0);
  const call = useRef(0);

  const load = useCallback(
    async (cursor: string | null) => {
      const id = ++call.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await notificationsList(apiClient, workspaceId, { limit: PAGE_SIZE, cursor, unread: filter === "unread" });
        if (id !== call.current) return;
        setItems((prev) => (cursor ? [...prev, ...page.notifications] : page.notifications));
        setNextCursor(page.nextCursor);
        setUnread(page.unreadCount);
        onUnreadCount(page.unreadCount);
      } catch (err) {
        if (id === call.current) setError(err);
      } finally {
        if (id === call.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, filter, onUnreadCount]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function openNotification(n: MerchantNotificationDto) {
    if (!n.readAt) {
      const readAt = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt } : x)));
      try {
        const result = await notificationsMarkRead(apiClient, workspaceId, n.id);
        setUnread(result.unreadCount);
        onUnreadCount(result.unreadCount);
      } catch {
        // Still navigate: reading it again later is harmless.
      }
    }
    if (n.link) {
      const to = n.link;
      onClose();
      leave(() => navigate(to));
    }
  }

  async function readAll() {
    const readAt = new Date().toISOString();
    setItems((prev) => (filter === "unread" ? [] : prev.map((x) => (x.readAt ? x : { ...x, readAt }))));
    setUnread(0);
    onUnreadCount(0);
    try {
      await notificationsMarkAllRead(apiClient, workspaceId);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-primary-dark/40 dark:bg-black/60" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-line bg-paper-raised shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={readAll} disabled={unread === 0}>
              <CheckCheck className="size-4" aria-hidden />
              {t.readAll}
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="cursor-pointer rounded-md p-1.5 text-ink-soft hover:bg-primary-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="border-b border-line px-4 py-2">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            label={t.filterLabel}
            tabs={[
              { value: "all", label: t.all },
              { value: "unread", label: unread > 0 ? `${t.unread} (${unread})` : t.unread },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DataState loading={loading} error={error} onRetry={() => void load(null)}>
            {items.length === 0 ? (
              <EmptyState
                className="m-4"
                icon={<Bell className="size-6" aria-hidden />}
                title={filter === "unread" ? t.emptyUnread : t.emptyTitle}
                description={filter === "unread" ? undefined : t.emptyBody}
              />
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const text = notificationText(nt, n);
                  const warn = n.type === "order.suspicious" || n.type === "integration.failed";
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-start hover:bg-paper",
                          !n.readAt && "bg-primary-soft/40"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                            warn ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary-dark dark:text-primary"
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm text-ink", !n.readAt && "font-semibold")}>{text.title}</span>
                          {text.body && <span className="mt-0.5 block text-sm text-ink-soft">{text.body}</span>}
                          <span className="mt-1 block text-xs text-ink-soft">{formatRelativeTime(n.createdAt)}</span>
                        </span>
                        {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="pb-4">
              <LoadMore hasMore={Boolean(nextCursor)} loading={loadingMore} onClick={() => void load(nextCursor)} />
            </div>
          </DataState>
        </div>

        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              leave(() => navigate("/settings?tab=notifications"));
            }}
            className="cursor-pointer text-sm text-primary hover:underline"
          >
            {t.settings}
          </button>
        </div>
      </aside>
    </div>
  );
}
