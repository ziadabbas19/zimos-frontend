import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Alert, Button, Input, cn, ZLoader } from "@store-builder/ui";
import type {
  WhatsappConversation,
  WhatsappConversationStatus,
  WhatsappMessage,
  WhatsappTemplatePayload,
} from "@store-builder/api-client";
import { inboxListConversations, type InboxConversation, type InboxCounts } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/relativeTime";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { useInboxLive } from "./useInboxLive";
import { AssigneeSelect, CustomerPanel, CustomerPanelButton, InboxScopeTabs, QuickRepliesMenu, type InboxScope } from "./InboxExtras";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { AI_ENABLED } from "@/lib/features";
import { SuggestReplyButton } from "./SuggestReply";
import { BotBadge, BotSettingsLink, BotToggle } from "./WaBot";
import { waBotSentOf } from "@store-builder/api-client";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TemplatePicker } from "@/components/WhatsappTemplates";

/** There is no realtime channel, so the inbox polls while the tab is visible. */
const POLL_MS = 10_000;
const LIST_LIMIT = 30;
const MESSAGE_LIMIT = 50;

const STRINGS = {
  en: {
    title: "WhatsApp inbox",
    description: "Reply to your customers on WhatsApp.",
    notConnectedTitle: "WhatsApp isn't connected yet",
    notConnectedHint:
      "Connect your WhatsApp Business number in Settings to start chatting with customers here.",
    goConnect: "Connect WhatsApp",
    newMessage: "New message",
    search: "Search name or phone",
    open: "Open",
    closed: "Closed",
    noConversations: "No conversations here",
    noConversationsHint: "New customer messages will show up here automatically.",
    noResults: "No conversations match your search.",
    selectConversation: "Pick a conversation to read it.",
    unread: "{count} unread",
    back: "Back to conversations",
    viewCustomer: "Customer profile",
    closeConversation: "Close",
    reopenConversation: "Reopen",
    closedToast: "Conversation closed.",
    reopenedToast: "Conversation reopened.",
    loadOlder: "Load older messages",
    noMessages: "No messages yet.",
    template: "Template: {name}",
    status_sent: "Sent",
    status_delivered: "Delivered",
    status_read: "Read",
    status_failed: "Failed",
    status_received: "Received",
    failedWithError: "Failed: {error}",
    typeMessage: "Type a message…",
    send: "Send",
    sending: "Sending…",
    windowClosed:
      "The 24-hour window is closed. WhatsApp only lets you message this customer with an approved template until they reply.",
    windowClosedToast: "The 24-hour window closed — send a template instead.",
    notConnectedToast: "WhatsApp is disconnected. Reconnect it from Settings.",
    sendTemplate: "Send template",
    templateName: "Template name",
    templateNameHint: "Exactly as approved in Meta, e.g. order_confirmation",
    invalidTemplateName: "Use lowercase letters, numbers and underscores only.",
    language: "Language code",
    languageHint: "e.g. ar, en_US",
    params: "Variables",
    paramsHint: "Fill the template's placeholders in order.",
    param: "Variable {n}",
    addParam: "Add variable",
    removeParam: "Remove variable {n}",
    sent: "Message sent.",
    phone: "Customer phone",
    phoneHint: "With country code, e.g. 201012345678",
    invalidPhone: "Enter a valid phone number with country code.",
    newMessageHint: "WhatsApp needs an approved template to start a new conversation.",
    cancel: "Cancel",
    retry: "Try again",
  },
  ar: {
    title: "صندوق واتساب",
    description: "رد على عملاءك على واتساب.",
    notConnectedTitle: "واتساب لسه مش مربوط",
    notConnectedHint: "اربط رقم واتساب بيزنس بتاعك من الإعدادات، وابدأ تكلّم عملاءك من هنا.",
    goConnect: "اربط واتساب",
    newMessage: "رسالة جديدة",
    search: "دوّر بالاسم أو الرقم",
    open: "مفتوحة",
    closed: "مقفولة",
    noConversations: "مفيش محادثات هنا",
    noConversationsHint: "رسايل العملاء الجديدة هتظهر هنا لوحدها.",
    noResults: "مفيش محادثات بالبحث ده.",
    selectConversation: "اختار محادثة عشان تقراها.",
    unread: "{count} مش مقروءة",
    back: "رجوع للمحادثات",
    viewCustomer: "صفحة العميل",
    closeConversation: "اقفل",
    reopenConversation: "افتح تاني",
    closedToast: "المحادثة اتقفلت.",
    reopenedToast: "المحادثة اتفتحت تاني.",
    loadOlder: "اعرض رسايل أقدم",
    noMessages: "مفيش رسايل لسه.",
    template: "قالب: {name}",
    status_sent: "اتبعتت",
    status_delivered: "وصلت",
    status_read: "اتقرت",
    status_failed: "فشلت",
    status_received: "مستلمة",
    failedWithError: "فشلت: {error}",
    typeMessage: "اكتب رسالة…",
    send: "ابعت",
    sending: "بنبعت…",
    windowClosed:
      "فترة الـ ٢٤ ساعة خلصت. واتساب مش هيسمحلك تبعت للعميل ده غير بقالب متوافق عليه لحد ما يرد.",
    windowClosedToast: "فترة الـ ٢٤ ساعة خلصت — ابعت قالب بدلها.",
    notConnectedToast: "واتساب مفصول. اربطه تاني من الإعدادات.",
    sendTemplate: "ابعت قالب",
    templateName: "اسم القالب",
    templateNameHint: "زي ما هو متوافق عليه في Meta، مثلًا order_confirmation",
    invalidTemplateName: "استخدم حروف إنجليزي صغيرة وأرقام و _ بس.",
    language: "كود اللغة",
    languageHint: "مثلًا ar أو en_US",
    params: "المتغيرات",
    paramsHint: "املى خانات القالب بالترتيب.",
    param: "متغير {n}",
    addParam: "ضيف متغير",
    removeParam: "شيل متغير {n}",
    sent: "الرسالة اتبعتت.",
    phone: "رقم العميل",
    phoneHint: "بكود الدولة، مثلًا 201012345678",
    invalidPhone: "اكتب رقم صحيح بكود الدولة.",
    newMessageHint: "واتساب محتاج قالب متوافق عليه عشان تبدأ محادثة جديدة.",
    cancel: "إلغاء",
    retry: "حاول تاني",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** Runs `tick` every POLL_MS while the tab is visible, and again on return. */
function usePolling(tick: () => void, enabled = true) {
  const ref = useRef(tick);
  useEffect(() => {
    ref.current = tick;
  });
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = window.setInterval(run, POLL_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled]);
}

function sendErrorText(err: unknown, t: Strings): string {
  if (err instanceof ApiError) {
    if (err.code === "WHATSAPP_WINDOW_CLOSED") return t.windowClosedToast;
    if (err.code === "WHATSAPP_NOT_CONNECTED") return t.notConnectedToast;
  }
  return getErrorMessage(err);
}

export function InboxPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const navigate = useNavigate();
  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);

  return (
    <div className="min-w-0">
      <PageHeader title={t.title} description={t.description} actions={AI_ENABLED ? <BotSettingsLink /> : undefined} />
      <DataState
        loading={integration.loading}
        error={integration.error}
        onRetry={() => integration.refresh()}
      >
        {integration.data && !integration.data.connected ? (
          <EmptyState
            icon={<MessageCircle />}
            title={t.notConnectedTitle}
            description={t.notConnectedHint}
            action={<Button onClick={() => navigate("/settings#whatsapp")}>{t.goConnect}</Button>}
          />
        ) : integration.data ? (
          <InboxView key={workspaceId} />
        ) : null}
      </DataState>
    </div>
  );
}

function InboxView() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const [status, setStatus] = useState<WhatsappConversationStatus>("open");
  // All / assigned to me / unread — and how many open conversations wait in each.
  const [scope, setScope] = useState<InboxScope>("all");
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const scopeParams = { assigned: scope === "mine" ? ("me" as const) : undefined, unread: scope === "unread" };
  // Bumped on any activity so the customer panel re-reads the orders.
  const [activity, setActivity] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const reqId = useRef(0);
  const loadedBeyondFirstPage = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Hand-rolled rather than useAsync: the poll must refresh the first page
  // without clearing the older pages the merchant already scrolled into.
  const loadFirstPage = useCallback(
    async (silent: boolean) => {
      const id = ++reqId.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await inboxListConversations(apiClient, workspaceId, {
          ...scopeParams,
          status,
          search: search || undefined,
          limit: LIST_LIMIT,
        });
        if (id !== reqId.current) return;
        setCounts(res.counts);
        if (silent) {
          setConversations((prev) => {
            const fresh = new Set(res.conversations.map((c) => c.id));
            const older = prev.slice(LIST_LIMIT).filter((c) => !fresh.has(c.id));
            return [...res.conversations, ...older];
          });
          setNextCursor((prev) => (loadedBeyondFirstPage.current ? prev : res.nextCursor));
        } else {
          loadedBeyondFirstPage.current = false;
          setConversations(res.conversations);
          setNextCursor(res.nextCursor);
        }
        setError(null);
      } catch (err) {
        if (id === reqId.current && !silent) setError(err);
      } finally {
        if (id === reqId.current && !silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, status, search, scope]
  );

  useEffect(() => {
    void loadFirstPage(false);
  }, [loadFirstPage]);

  usePolling(() => void loadFirstPage(true));
  // The live stream makes a new message show at once; the poll above stays as the safety net.
  useInboxLive(workspaceId, () => {
    void loadFirstPage(true);
    setActivity((n) => n + 1);
  });

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await inboxListConversations(apiClient, workspaceId, {
          ...scopeParams,
        status,
        search: search || undefined,
        limit: LIST_LIMIT,
        before: nextCursor,
      });
      loadedBeyondFirstPage.current = true;
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.conversations.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  // Remember the last known version so closing a conversation (which drops it
  // out of the "open" filter) does not yank the thread out from under the user.
  const lastSelected = useRef<WhatsappConversation | null>(null);
  if (selected) lastSelected.current = selected;
  const threadConversation = selectedId
    ? (selected ?? (lastSelected.current?.id === selectedId ? lastSelected.current : null))
    : null;

  function patchConversation(id: string, patch: Partial<WhatsappConversation>) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (lastSelected.current?.id === id) lastSelected.current = { ...lastSelected.current, ...patch };
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setComposing(true)}>
          <Plus className="size-4" /> {t.newMessage}
        </Button>
      </div>

      <div
        className={cn(
          "grid h-[calc(100dvh-14rem)] min-h-[480px] overflow-hidden rounded-xl bg-paper-raised shadow-xs ring-1 ring-foreground/10 md:grid-cols-[320px_1fr]",
          threadConversation && "xl:grid-cols-[320px_1fr_300px]"
        )}
      >
        {/* Conversation list */}
        <aside
          className={cn("flex min-h-0 flex-col border-line md:border-e", threadConversation && "hidden md:flex")}
        >
          <div className="space-y-2 border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
                className="ps-9"
              />
            </div>
            <div
              role="radiogroup"
              aria-label={t.title}
              className="inline-flex rounded-lg bg-paper p-1 ring-1 ring-foreground/10"
            >
              {(["open", "closed"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    status === s ? "bg-primary text-primary-foreground" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {s === "open" ? t.open : t.closed}
                </button>
              ))}
            </div>
            <InboxScopeTabs value={scope} onChange={setScope} counts={counts} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-6">
                <ZLoader />
              </div>
            ) : error ? (
              <div className="space-y-3 p-4">
                <Alert variant="danger">{getErrorMessage(error)}</Alert>
                <Button size="sm" variant="outline" onClick={() => loadFirstPage(false)}>
                  {t.retry}
                </Button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-medium text-ink">{search ? t.noResults : t.noConversations}</p>
                {!search && <p className="mt-1 text-xs text-ink-soft">{t.noConversationsHint}</p>}
              </div>
            ) : (
              <ul>
                {conversations.map((c) => (
                  <li key={c.id}>
                    <ConversationRow
                      conversation={c}
                      active={c.id === selectedId}
                      onClick={() => setSelectedId(c.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {!loading && !error && (
              <div className="pb-4">
                <LoadMore hasMore={Boolean(nextCursor)} loading={loadingMore} onClick={loadMore} />
              </div>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn("flex min-h-0 flex-col", !threadConversation && "hidden md:flex")}>
          {threadConversation ? (
            <Thread
              key={threadConversation.id}
              conversation={threadConversation}
              onBack={() => setSelectedId(null)}
              onPatch={(patch) => patchConversation(threadConversation.id, patch)}
              onActivity={() => void loadFirstPage(true)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-soft">
              {t.selectConversation}
            </div>
          )}
        </section>

        {/* Customer panel: its own column on wide screens; a dialog from the thread header otherwise. */}
        {threadConversation && (
          <CustomerPanel
            key={`panel-${threadConversation.id}`}
            className="hidden border-line xl:flex xl:border-s"
            conversation={threadConversation}
            refreshKey={activity}
          />
        )}
      </div>

      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title={t.newMessage}
        description={t.newMessageHint}
      >
        {composing && (
          <TemplateForm
            onCancel={() => setComposing(false)}
            onSent={(conversationId) => {
              setComposing(false);
              setStatus("open");
              setSelectedId(conversationId);
              void loadFirstPage(true);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ConversationRow({
  conversation: c,
  active,
  onClick,
}: {
  conversation: WhatsappConversation;
  active: boolean;
  onClick: () => void;
}) {
  const t = useT(STRINGS);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 border-b border-line px-3 py-3 text-start transition-colors hover:bg-paper",
        active && "bg-primary-soft hover:bg-primary-soft"
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink-soft">
        <UserRound className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm text-ink", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>
            <bdi>{c.customerName || c.phone}</bdi>
          </span>
          <span className="shrink-0 text-xs text-ink-soft">{formatRelativeTime(c.lastMessageAt)}</span>
        </div>
        {c.customerName && (
          <div className="truncate text-xs text-ink-soft">
            <bdi dir="ltr">{c.phone}</bdi>
          </div>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-soft">
            <bdi>{c.lastMessagePreview ?? ""}</bdi>
          </span>
          {c.unreadCount > 0 && (
            <span
              className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
              aria-label={fmt(t.unread, { count: c.unreadCount })}
            >
              {c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Thread({
  conversation,
  onBack,
  onPatch,
  onActivity,
}: {
  conversation: WhatsappConversation;
  onBack: () => void;
  onPatch: (patch: Partial<WhatsappConversation>) => void;
  onActivity: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const olderLoaded = useRef(false);

  const loadLatest = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const res = await apiClient.listWhatsappMessages(workspaceId, conversation.id, {
          limit: MESSAGE_LIMIT,
        });
        setMessages((prev) => {
          if (!silent) return res.messages;
          // Merge on id: a poll re-sends the tail, and a status change (sent →
          // delivered → read) arrives as an update to a message already here.
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of res.messages) byId.set(m.id, m);
          return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        if (!silent || !olderLoaded.current) setOlderCursor(res.nextCursor);
        setError(null);
        // The GET marks the conversation read server-side.
        onPatch({ unreadCount: 0 });
      } catch (err) {
        if (!silent) setError(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    // onPatch is recreated every render; depending on it would re-fetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId, conversation.id]
  );

  useEffect(() => {
    void loadLatest(false);
  }, [loadLatest]);

  usePolling(() => void loadLatest(true));
  useInboxLive(workspaceId, (event) => {
    if (!event.conversationId || event.conversationId === conversation.id) void loadLatest(true);
  });
  const [panelOpen, setPanelOpen] = useState(false);

  // Keep the view pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!olderCursor) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const res = await apiClient.listWhatsappMessages(workspaceId, conversation.id, {
        limit: MESSAGE_LIMIT,
        before: olderCursor,
      });
      olderLoaded.current = true;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...res.messages.filter((m) => !seen.has(m.id)), ...prev];
      });
      setOlderCursor(res.nextCursor);
      // Hold the reading position steady as content is prepended.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function toggleStatus() {
    const next: WhatsappConversationStatus = conversation.status === "open" ? "closed" : "open";
    setStatusBusy(true);
    try {
      const res = await apiClient.setWhatsappConversationStatus(workspaceId, conversation.id, next);
      onPatch({ status: res.status });
      toast.success(res.status === "closed" ? t.closedToast : t.reopenedToast);
      onActivity();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  }

  async function afterSend() {
    stickToBottom.current = true;
    await loadLatest(true);
    onActivity();
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Button size="icon-sm" variant="ghost" className="md:hidden" onClick={onBack} aria-label={t.back}>
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">
            <bdi>{conversation.customerName || conversation.phone}</bdi>
          </h2>
          <p className="truncate text-xs text-ink-soft">
            <bdi dir="ltr">{conversation.phone}</bdi>
          </p>
        </div>
        {conversation.customerId && (
          <Link
            to={`/customers/${conversation.customerId}`}
            className="hidden text-xs font-medium text-primary hover:underline sm:inline"
          >
            {t.viewCustomer}
          </Link>
        )}
        <CustomerPanelButton className="xl:hidden" onClick={() => setPanelOpen(true)} />
        {AI_ENABLED && <BotToggle conversation={conversation} onChange={(botPaused) => onPatch({ botPaused } as Partial<WhatsappConversation>)} />}
        <AssigneeSelect
          conversation={conversation as InboxConversation}
          onAssigned={(assignedTo) => {
            onPatch({ assignedTo } as Partial<WhatsappConversation>);
            onActivity();
          }}
        />
        <Button size="sm" variant="outline" onClick={toggleStatus} disabled={statusBusy}>
          {conversation.status === "open" ? t.closeConversation : t.reopenConversation}
        </Button>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-paper px-3 py-4"
      >
        {loading ? (
          <div className="flex justify-center p-6">
            <ZLoader />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <Alert variant="danger">{getErrorMessage(error)}</Alert>
            <Button size="sm" variant="outline" onClick={() => loadLatest(false)}>
              {t.retry}
            </Button>
          </div>
        ) : (
          <>
            {olderCursor && (
              <div className="flex justify-center">
                <Button size="sm" variant="ghost" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? <ZLoader size="sm" /> : t.loadOlder}
                </Button>
              </div>
            )}
            {messages.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-soft">{t.noMessages}</p>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
          </>
        )}
      </div>

      <Composer conversation={conversation} onSent={afterSend} />

      {panelOpen && (
        <div className="fixed inset-0 z-50 bg-primary-dark/40 xl:hidden dark:bg-black/60" onMouseDown={() => setPanelOpen(false)}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-y-0 end-0 flex w-full max-w-sm flex-col border-s border-line bg-paper-raised shadow-xl"
          >
            <CustomerPanel className="flex-1" conversation={conversation} onClose={() => setPanelOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ message: m }: { message: WhatsappMessage }) {
  const t = useT(STRINGS);
  const out = m.direction === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-xs",
          out ? "rounded-ee-sm bg-primary-soft text-ink" : "rounded-es-sm bg-paper-raised text-ink ring-1 ring-foreground/10",
          m.status === "failed" && "ring-1 ring-danger/40"
        )}
      >
        {AI_ENABLED && waBotSentOf(m) && <BotBadge />}
        {m.templateName && (
          <p className="mb-0.5 text-[11px] font-medium text-ink-soft">
            {fmt(t.template, { name: m.templateName })}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words" dir="auto">
          {m.body ?? (m.type !== "text" ? `[${m.type}]` : "")}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-ink-soft">
          <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString()}>
            {formatRelativeTime(m.createdAt)}
          </time>
          {out && <StatusTick status={m.status} error={m.error} />}
        </div>
      </div>
    </div>
  );
}

function StatusTick({ status, error }: { status: WhatsappMessage["status"]; error: string | null }) {
  const t = useT(STRINGS);
  const label =
    status === "failed"
      ? error
        ? fmt(t.failedWithError, { error })
        : t.status_failed
      : t[`status_${status}` as const];
  const icon =
    status === "failed" ? (
      <AlertCircle className="size-3.5 text-danger" />
    ) : status === "read" ? (
      <CheckCheck className="size-3.5 text-primary" />
    ) : status === "delivered" ? (
      <CheckCheck className="size-3.5" />
    ) : status === "sent" ? (
      <Check className="size-3.5" />
    ) : (
      <Clock className="size-3.5" />
    );
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      {icon}
    </span>
  );
}

function Composer({
  conversation,
  onSent,
}: {
  conversation: WhatsappConversation;
  onSent: () => Promise<void>;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function sendText(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await apiClient.sendWhatsappMessage(workspaceId, { to: conversation.phone, text: body });
      setText("");
      await onSent();
    } catch (err) {
      toast.error(sendErrorText(err, t));
      // The window may have closed since the list was fetched; refresh so the
      // composer swaps itself for the template form.
      if (err instanceof ApiError && err.code === "WHATSAPP_WINDOW_CLOSED") await onSent();
    } finally {
      setSending(false);
    }
  }

  if (!conversation.canReply) {
    return (
      <div className="space-y-3 border-t border-line p-3">
        <Alert
          variant="default"
          className="border-accent/40 bg-accent-soft text-accent-dark dark:text-accent"
        >
          {t.windowClosed}
        </Alert>
        <details className="rounded-lg bg-paper p-3 ring-1 ring-foreground/10">
          <summary className="cursor-pointer text-sm font-medium text-ink">{t.sendTemplate}</summary>
          <div className="mt-3">
            <TemplateForm to={conversation.phone} onSent={() => void onSent()} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <form onSubmit={sendText} className="flex items-end gap-2 border-t border-line p-3">
      <QuickRepliesMenu onPick={setText} draft={text} />
      {AI_ENABLED && <SuggestReplyButton conversationId={conversation.id} onSuggest={setText} />}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={t.typeMessage}
        aria-label={t.typeMessage}
        rows={1}
        dir="auto"
        className="min-h-10 flex-1 resize-none"
        maxLength={4096}
      />
      <Button type="submit" disabled={sending || !text.trim()}>
        {sending ? t.sending : t.send}
      </Button>
    </form>
  );
}

/** Template sender, used by the closed-window composer and the New message dialog. */
function TemplateForm({
  to,
  onSent,
  onCancel,
}: {
  /** Fixed recipient; when omitted the form asks for a phone number. */
  to?: string;
  onSent: (conversationId: string) => void;
  onCancel?: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("ar");
  const [params, setParams] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const recipient = to ?? phone.replace(/[\s+()-]/g, "");
    if (!to && !/^\d{8,15}$/.test(recipient)) next.phone = t.invalidPhone;
    if (!/^[a-z0-9_]+$/.test(name.trim())) next.name = t.invalidTemplateName;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    const template: WhatsappTemplatePayload = {
      name: name.trim(),
      language: language.trim() || "ar",
      params: params.map((p) => p.trim()),
    };
    setSending(true);
    try {
      const message = await apiClient.sendWhatsappMessage(workspaceId, { to: recipient, template });
      toast.success(t.sent);
      setName("");
      setParams([]);
      onSent(message.conversationId);
    } catch (err) {
      setFormError(sendErrorText(err, t));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {formError && <Alert variant="danger">{formError}</Alert>}
      {!to && (
        <TextField
          label={t.phone}
          required
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint={t.phoneHint}
        />
      )}
      {/* A template synced from Meta fills the name, language and variable count. */}
      <TemplatePicker
        name={name}
        language={language}
        onPick={(tpl) => {
          setName(tpl.name);
          setLanguage(tpl.language);
          setParams((prev) => Array.from({ length: tpl.paramsCount }, (_, i) => prev[i] ?? ""));
        }}
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <TextField
          label={t.templateName}
          required
          dir="ltr"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          hint={t.templateNameHint}
        />
        <TextField
          label={t.language}
          required
          dir="ltr"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          hint={t.languageHint}
        />
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-ink">{t.params}</p>
          <p className="text-xs text-ink-soft">{t.paramsHint}</p>
        </div>
        {params.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={p}
              dir="auto"
              aria-label={fmt(t.param, { n: i + 1 })}
              onChange={(e) => setParams((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={fmt(t.removeParam, { n: i + 1 })}
              onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setParams((prev) => [...prev, ""])}>
          <Plus className="size-4" /> {t.addParam}
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>
            {t.cancel}
          </Button>
        )}
        <Button type="submit" disabled={sending || !name.trim() || (!to && !phone.trim())}>
          {sending ? t.sending : t.sendTemplate}
        </Button>
      </div>
    </form>
  );
}
