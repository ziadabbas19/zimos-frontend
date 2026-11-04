import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { Toggle } from "@/components/Toggle";
import { NativeSelect } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as notificationsApi from "@/lib/notificationsApi";
import { NOTIFICATION_TYPES, type ConsoleNotification, type NotificationPref, type NotificationType } from "@/lib/notificationsApi";
import { NOTIFICATION_STRINGS, typeLabel } from "@/lib/notificationStrings";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatRelative } from "@/lib/format";

export function NotificationsPage() {
  const t = useT(NOTIFICATION_STRINGS);
  const navigate = useNavigate();
  const [type, setType] = useState<NotificationType | "">("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<ConsoleNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // The filter offers what this account can be told about: the API's own list of it.
  const [types, setTypes] = useState<NotificationType[]>([]);

  useEffect(() => {
    notificationsApi
      .getPrefs()
      .then((res) => setTypes(NOTIFICATION_TYPES.filter((k) => res.prefs.some((p) => p.type === k))))
      .catch(() => undefined);
  }, []);

  const load = useCallback(
    async (after: string | null) => {
      setLoading(true);
      try {
        const page = await notificationsApi.listNotifications({ type: type || undefined, unread: unreadOnly, cursor: after ?? undefined, limit: 20 });
        setItems((list) => (after ? [...list, ...page.notifications] : page.notifications));
        setCursor(page.nextCursor);
        setUnread(page.unread);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [type, unreadOnly]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  async function markAll() {
    const res = await notificationsApi.markRead({ all: true }).catch(() => null);
    if (res) {
      setUnread(res.unread);
      if (unreadOnly) setItems([]);
      else setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
  }

  async function open(n: ConsoleNotification) {
    if (!n.readAt) {
      const res = await notificationsApi.markRead({ ids: [n.id] }).catch(() => null);
      if (res) setUnread(res.unread);
    }
    if (n.link) navigate(n.link);
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
              {t.settings}
            </Button>
            <Button size="sm" onClick={() => void markAll()} disabled={unread === 0}>
              {t.markAllRead}
            </Button>
          </div>
        }
      />
      {showSettings && <SettingsPanel onSaved={() => void load(null)} />}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-56">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value as NotificationType | "")} aria-label={t.allTypes}>
            <option value="">{t.allTypes}</option>
            {types.map((k) => (
              <option key={k} value={k}>
                {typeLabel(t, k)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          {t.unreadOnly}
        </label>
        <span className="text-sm text-ink-soft">{fmt(t.unreadCount, { count: unread })}</span>
      </div>
      {error && <p className="mb-4 text-sm font-medium text-danger">{error}</p>}
      <Panel flush>
        {items.length === 0 && !loading ? (
          <p className="p-6 text-sm text-ink-soft">{unreadOnly ? t.emptyUnread : t.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void open(n)}
                  className={cn("flex w-full cursor-pointer gap-3 px-4 py-3 text-start hover:bg-primary-soft", !n.readAt && "bg-primary-soft/40")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{typeLabel(t, n.type)}</span>
                    {typeof n.data.name === "string" && <span className="block text-sm text-ink">{n.data.name}</span>}
                    {n.body && <span className="block text-sm text-ink-soft">“{n.body}”</span>}
                  </span>
                  <span className="shrink-0 text-end text-xs text-ink-soft" title={formatDateTime(n.createdAt)}>
                    {formatRelative(n.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void load(cursor)} disabled={loading}>
            {t.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const t = useT(NOTIFICATION_STRINGS);
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPref[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationsApi
      .getPrefs()
      .then((res) => setPrefs(res.prefs))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  function set(type: NotificationType, patch: Partial<NotificationPref>) {
    setPrefs((list) => list?.map((p) => (p.type === type ? { ...p, ...patch } : p)) ?? null);
  }

  async function save() {
    if (!prefs) return;
    setBusy(true);
    try {
      const res = await notificationsApi.savePrefs(prefs);
      setPrefs(res.prefs);
      setError(null);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t.settings} className="mb-6">
      <p className="mb-4 text-sm text-ink-soft">{t.settingsHint}</p>
      {prefs && (
        <ul className="divide-y divide-line">
          {prefs.map((p) => (
            <li key={p.type} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="text-sm text-ink">{typeLabel(t, p.type)}</span>
              <span className="flex items-center gap-4">
                <Toggle checked={p.enabled} onChange={(v) => set(p.type, { enabled: v })} label={t.inApp} />
                <Toggle checked={p.email} onChange={(v) => set(p.type, { email: v })} label={t.email} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-4">
        <Button size="sm" onClick={() => void save()} disabled={busy || !prefs}>
          {t.save}
        </Button>
      </div>
    </Panel>
  );
}
