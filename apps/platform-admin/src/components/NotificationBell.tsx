import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, cn, ZLoader } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as notificationsApi from "@/lib/notificationsApi";
import type { ConsoleNotification } from "@/lib/notificationsApi";
import { NOTIFICATION_STRINGS, typeLabel } from "@/lib/notificationStrings";
import { formatRelative } from "@/lib/format";
import { useConsoleLive } from "@/lib/liveUpdates";

const POLL_MS = 60_000;
/** Live updates connected: the count on their events, on coming back to the tab, and this often for the kinds they do not send. */
const LIVE_POLL_MS = 5 * 60_000;
/** Live updates on but not connected: polled this often until they are. */
const FALLBACK_MS = 30_000;
/** A burst of events (several sign-ups at once) is one read. */
const SETTLE_MS = 800;

/**
 * Top-bar bell: the unread count and the latest 8 in a menu. The count is
 * polled every 60 s; with VITE_CONSOLE_REALTIME_ENABLED it follows the live
 * updates instead (lib/liveUpdates), polled every 30 s while they are down.
 * The round button and its count are the merchant dashboard's bell; the list
 * is a menu pane of the theme, drawn outside the frosted toolbar so nothing
 * clips it.
 */
export function NotificationBell() {
  const t = useT(NOTIFICATION_STRINGS);
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConsoleNotification[] | null>(null);

  const refreshCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  const settle = useRef<number | undefined>(undefined);
  const live = useConsoleLive(() => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(refreshCount, SETTLE_MS);
  });
  useEffect(() => () => window.clearTimeout(settle.current), []);

  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, live === "off" ? POLL_MS : live === "live" ? LIVE_POLL_MS : FALLBACK_MS);
    if (live === "off") return () => window.clearInterval(timer);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCount, live]);

  useEffect(() => {
    if (!open) return;
    notificationsApi
      .listNotifications({ limit: 8 })
      .then((page) => {
        setItems(page.notifications);
        setUnread(page.unread);
      })
      .catch(() => setItems([]));
  }, [open]);

  async function openItem(n: ConsoleNotification) {
    setOpen(false);
    if (!n.readAt) {
      const res = await notificationsApi.markRead({ ids: [n.id] }).catch(() => null);
      if (res) setUnread(res.unread);
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    const res = await notificationsApi.markRead({ all: true }).catch(() => null);
    if (res) {
      setUnread(res.unread);
      setItems((list) => list?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            data-slot="notifications-bell"
            aria-label={unread ? `${t.bell}: ${fmt(t.unreadCount, { count: unread })}` : t.bell}
            className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-primary-soft aria-expanded:text-primary-dark motion-reduce:transition-none dark:aria-expanded:text-primary pointer-coarse:size-11"
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute -end-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4.5 font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={10} className="w-80 max-w-[calc(100vw-1.5rem)] rounded-[1.125rem] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <span className="font-display text-base font-medium text-ink">{t.title}</span>
          {unread > 0 && (
            <button type="button" onClick={() => void markAll()} className="cursor-pointer rounded-full text-xs font-medium text-primary hover:underline">
              {t.markAllRead}
            </button>
          )}
        </div>
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {items === null ? (
            <li className="flex justify-center px-4 py-4">
              <ZLoader size="sm" />
            </li>
          ) : items.length === 0 ? (
            <li className="px-4 py-4 text-sm text-ink-soft">{t.empty}</li>
          ) : (
            items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openItem(n)}
                  className={cn("flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-start hover:bg-paper", !n.readAt && "bg-primary-soft/40")}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm text-ink", !n.readAt && "font-semibold")}>{typeLabel(t, n.type)}</span>
                    {(typeof n.data.name === "string" || n.body) && (
                      <span className="mt-0.5 block truncate text-sm text-ink-soft">{typeof n.data.name === "string" ? n.data.name : n.body}</span>
                    )}
                    <span className="mt-1 block text-xs text-ink-soft">{formatRelative(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-line px-4 py-3">
          <Link to="/notifications" onClick={() => setOpen(false)} className="text-sm text-primary hover:underline">
            {t.viewAll}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
