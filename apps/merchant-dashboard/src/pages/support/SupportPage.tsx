import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import type { SupportTicket, SupportTicketStatus, SupportTicketThread } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconEye, IconLock, IconPlus, IconSearch, IconSend, IconSpinner, IconSuccess, IconSupport, IconTicket } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages, useLocale } from "@/i18n/LocaleContext";
import { SocialLinks } from "@store-builder/ui/social-links";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useViewNavigate } from "@/lib/viewTransition";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { rowKeyProps } from "@/pages/returns/rowkit/RowBits";
import { NewTicketSheet } from "./NewTicketSheet";
import { SUPPORT_STATUSES, SUPPORT_STATUS_TONE, ticketCacheKey, ticketsCacheKey, useSupportLabels, waitsOnYou } from "./supportLabels";
import { TicketQuickLook } from "./TicketQuickLook";
import { TicketMessages, TicketThreadSkeleton } from "./TicketThread";

const STRINGS = {
  en: {
    socialHeading: "Other ways to reach us",
    title: "Contact support",
    description: "Ask the Zimos team for help. We reply here, in the ticket.",
    newTicket: "New ticket",
    searchLabel: "Search your tickets",
    searchPlaceholder: "Subject or topic",
    chipsLabel: "Tickets by status",
    tabAll: "All",
    listLabel: "Your tickets",
    colSubject: "Subject",
    colStatus: "Status",
    colMessages: "Messages",
    colUpdated: "Last update",
    updated: "Last update {date}",
    peek: "Preview the ticket: {subject}",
    openTicket: "Open the ticket: {subject}",
    menuLabel: "Actions for this ticket",
    menuOpen: "Open the ticket",
    menuPeek: "Quick look",
    empty: "You haven't contacted support yet",
    emptyHint: "Write your question or your problem, and the Zimos team answers you here.",
    emptyFiltered: "No ticket matches this search",
    clearSearch: "Clear the search",
    emptyPending: "No ticket is waiting for your reply",
    emptyTab: "No tickets with this status",
    showAll: "Show all tickets",
    sent: "Your ticket was sent. We'll reply here.",
    openIt: "Open it",
    back: "Contact support",
    opened: "Opened {date} by {name}",
    thread: "Messages of this ticket",
    reply: "Your reply",
    replyPlaceholder: "Write a reply…",
    sendReply: "Send reply",
    sending: "Sending…",
    replySent: "Reply sent.",
    messageRequired: "Write your reply first.",
    closedNotice: "This ticket is closed. Open a new one if you still need help.",
    noAccessTitle: "Support is for the owner and managers",
    noAccess: "Only the store owner or a manager can talk to support. Ask them to open the ticket, or to give you access from Settings → Team.",
  },
  ar: {
    socialHeading: "طرق أخرى للتواصل معنا",
    title: "تواصل مع الدعم",
    description: "اطلب المساعدة من فريق زيموس. سنرد عليك هنا داخل التذكرة.",
    newTicket: "تذكرة جديدة",
    searchLabel: "ابحث في تذاكرك",
    searchPlaceholder: "الموضوع أو النوع",
    chipsLabel: "التذاكر حسب الحالة",
    tabAll: "الكل",
    listLabel: "تذاكرك",
    colSubject: "الموضوع",
    colStatus: "الحالة",
    colMessages: "الرسائل",
    colUpdated: "آخر تحديث",
    updated: "آخر تحديث {date}",
    peek: "معاينة التذكرة: {subject}",
    openTicket: "فتح التذكرة: {subject}",
    menuLabel: "إجراءات التذكرة",
    menuOpen: "فتح التذكرة",
    menuPeek: "معاينة سريعة",
    empty: "لم تتواصل مع الدعم بعد",
    emptyHint: "اكتب سؤالك أو مشكلتك، وسيرد عليك فريق زيموس هنا.",
    emptyFiltered: "لا توجد تذكرة مطابقة لهذا البحث",
    clearSearch: "مسح البحث",
    emptyPending: "لا توجد تذكرة تنتظر ردك",
    emptyTab: "لا توجد تذاكر بهذه الحالة",
    showAll: "عرض كل التذاكر",
    sent: "تم إرسال تذكرتك. سنرد عليك هنا.",
    openIt: "فتحها",
    back: "تواصل مع الدعم",
    opened: "فُتح في {date} بواسطة {name}",
    thread: "رسائل هذه التذكرة",
    reply: "ردّك",
    replyPlaceholder: "اكتب ردًا…",
    sendReply: "إرسال الرد",
    sending: "جارٍ الإرسال…",
    replySent: "تم إرسال الرد.",
    messageRequired: "اكتب ردّك أولًا.",
    closedNotice: "هذه التذكرة مغلقة. افتح تذكرة جديدة إذا كنت ما زلت تحتاج المساعدة.",
    noAccessTitle: "الدعم متاح لمالك المتجر والمدير",
    noAccess: "مالك المتجر أو المدير فقط يمكنه مراسلة الدعم. اطلب منه فتح التذكرة، أو منحك الصلاحية من الإعدادات ← الفريق.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** "all" is every ticket; the others are the statuses a ticket moves through. */
type StatusTab = "all" | SupportTicketStatus;
const TABS: readonly StatusTab[] = ["all", ...SUPPORT_STATUSES];

function isTab(value: string | null): value is StatusTab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

/** Lower case, and Arabic-Indic digits as Latin ones, so «١٠٢٤» finds 1024. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Below md a ticket is a card; from md it is a line of the sheet. */
const COMPACT_QUERY = "(max-width: 47.99rem)";
/** The columns of the sheet: the subject, where it stands, how long the thread is, since when. */
const TICKET_COLUMNS = "grid-cols-[minmax(0,1fr)_max-content_max-content_max-content]";

/**
 * /support — the store's tickets with the Zimos team. The list is read whole
 * and filtered here, so the chips can say how many each status holds; a row
 * opens Quick Look (the thread, without leaving the list), its subject and
 * Enter open the ticket's page, where the reply is written. A new ticket is
 * written in a sheet over the list.
 *
 * `?status=` keeps the chosen chip, and `?new=1` opens the sheet (the closed
 * notice of a ticket links here).
 */
export function SupportPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = useSupportLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const navigate = useViewNavigate();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("status");
  const tab: StatusTab = isTab(rawTab) ? rawTab : "all";
  const creating = params.get("new") === "1";

  function patchParams(change: (next: URLSearchParams) => void) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: true }
    );
  }
  function selectTab(next: StatusTab) {
    patchParams((out) => {
      if (next === "all") out.delete("status");
      else out.set("status", next);
    });
  }
  function setCreating(open: boolean) {
    patchParams((out) => {
      if (open) out.set("new", "1");
      else out.delete("new");
    });
  }

  const list = useCachedAsync(ticketsCacheKey(workspaceId), () => apiClient.listSupportTickets(workspaceId), [workspaceId]);
  const tickets = useMemo(() => list.data ?? [], [list.data]);
  const [search, setSearch] = useState("");
  // The ticket being looked at stays here while its preview closes, so the sheet does not empty on its way out.
  const [peek, setPeek] = useState<{ id: string; open: boolean } | null>(null);

  const counts = useMemo(() => {
    const tally: Record<SupportTicketStatus, number> = { open: 0, pending: 0, resolved: 0, closed: 0 };
    for (const ticket of tickets) if (ticket.status in tally) tally[ticket.status] += 1;
    return tally;
  }, [tickets]);

  const query = fold(search.trim());
  const visible = tickets.filter((ticket) => {
    if (tab !== "all" && ticket.status !== tab) return false;
    if (!query) return true;
    return [ticket.subject, labels.category(ticket.category)].some((part) => fold(part).includes(query));
  });

  // While the list is on its way a chip holds its place with a dash (null), instead of folding behind «كمان» as an empty one.
  const figure = (count: number) => (list.loading ? null : count);
  const chips: ChipItem<StatusTab>[] = [
    { value: "all", label: t.tabAll, count: figure(tickets.length) },
    ...SUPPORT_STATUSES.map((status): ChipItem<StatusTab> => ({
      value: status,
      label: labels.status(status),
      count: figure(counts[status]),
      tone: status === "pending" ? "attention" : "default",
    })),
  ];

  const peeked = peek ? (tickets.find((ticket) => ticket.id === peek.id) ?? null) : null;
  const noAccess = !list.data && isPermissionError(list.error);

  const newTicketButton = (
    <Button className="gap-1.5 rounded-full px-5" aria-haspopup="dialog" onClick={() => setCreating(true)}>
      <IconPlus className="size-4" aria-hidden />
      {t.newTicket}
    </Button>
  );

  const empty = query ? (
    <EmptyState
      icon={<IconSearch aria-hidden />}
      title={t.emptyFiltered}
      action={
        <Button variant="outline" className="rounded-full px-5" onClick={() => setSearch("")}>
          {t.clearSearch}
        </Button>
      }
    />
  ) : tab !== "all" ? (
    <EmptyState
      icon={tab === "pending" ? <IconSuccess aria-hidden /> : <IconTicket aria-hidden />}
      tone={tab === "pending" ? "success" : "default"}
      title={tab === "pending" ? t.emptyPending : t.emptyTab}
      action={
        <Button variant="outline" className="rounded-full px-5" onClick={() => selectTab("all")}>
          {t.showAll}
        </Button>
      }
    />
  ) : (
    <EmptyState icon={<IconSupport aria-hidden />} title={t.empty} description={t.emptyHint} action={newTicketButton} />
  );

  const rows = visible.map((ticket) => (
    <TicketRow
      key={ticket.id}
      ticket={ticket}
      compact={compact}
      current={peek?.open === true && peek.id === ticket.id}
      onPeek={() => setPeek({ id: ticket.id, open: true })}
      onOpen={() => navigate(`/support/${ticket.id}`)}
      t={t}
    />
  ));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the tickets: the sentence is for wider screens.
        description={compact ? undefined : t.description}
        primaryAction={noAccess ? undefined : newTicketButton}
      />

      <div className="flex flex-col gap-3">
        {!noAccess && (
          <>
            <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
            <ChipRow items={chips} value={tab} onChange={selectTab} label={t.chipsLabel} countsLoading={list.loading} />
          </>
        )}

        {noAccess ? (
          <EmptyState icon={<IconLock aria-hidden />} tone="attention" title={t.noAccessTitle} description={t.noAccess} />
        ) : (
          <DataState
            loading={list.loading}
            // A refresh that failed behind tickets already on screen leaves them there.
            error={list.data ? null : list.error}
            onRetry={() => void list.refresh()}
            skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
          >
            {visible.length === 0 ? (
              empty
            ) : compact ? (
              <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
                {rows}
              </ul>
            ) : (
              <DeskList
                columns={TICKET_COLUMNS}
                label={t.listLabel}
                head={[{ label: t.colSubject }, { label: t.colStatus }, { label: t.colMessages, end: true }, { label: t.colUpdated, end: true }]}
              >
                {rows}
              </DeskList>
            )}
          </DataState>
        )}
      </div>

      {/* ZIMOS's own social accounts and email (packages/ui/src/social-links): the other ways to reach us. */}
      <SocialLinks locale={locale} heading={t.socialHeading} headingClassName="mt-8 font-display text-lg font-medium text-ink" />

      <TicketQuickLook
        ticket={peeked}
        open={Boolean(peek?.open)}
        onOpenChange={(open) => setPeek((current) => (current ? { ...current, open } : current))}
      />

      <NewTicketSheet
        open={creating}
        onClose={() => setCreating(false)}
        onOpened={(ticket) => {
          setCreating(false);
          toast.notify("success", t.sent, { action: { label: t.openIt, onClick: () => navigate(`/support/${ticket.id}`) } });
          void list.refresh({ silent: true });
        }}
      />
    </div>
  );
}

/**
 * One ticket in the list: its subject and topic, where it stands, how long
 * the thread is and when it last moved. A press opens Quick Look (Space too);
 * the subject, Enter and the row's menu open the ticket's page. A ticket that
 * waits for the store's reply carries the dot of something new.
 */
function TicketRow({
  ticket,
  compact,
  current,
  onPeek,
  onOpen,
  t,
}: {
  ticket: SupportTicket;
  compact: boolean;
  current: boolean;
  onPeek: () => void;
  onOpen: () => void;
  t: Strings;
}) {
  const labels = useSupportLabels();
  const to = `/support/${ticket.id}`;
  const keys = rowKeyProps(onPeek, onOpen);
  const peekLabel = fmt(t.peek, { subject: ticket.subject });
  const waiting = waitsOnYou(ticket);
  const status = <StatusBadge value={ticket.status} tone={SUPPORT_STATUS_TONE[ticket.status]} text={labels.status(ticket.status)} />;
  const messages = labels.messages(ticket.messageCount ?? 1);
  const when = (
    <time dateTime={ticket.lastMessageAt} title={fmt(t.updated, { date: formatDateTime(ticket.lastMessageAt) })}>
      {formatRelativeTime(ticket.lastMessageAt)}
    </time>
  );
  const menu: ContextMenuItem[] = [
    { id: "open", label: t.menuOpen, icon: IconTicket, onSelect: onOpen },
    { id: "peek", label: t.menuPeek, icon: IconEye, onSelect: onPeek },
  ];

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={
              <bdi data-vt-part="title" dir="auto">
                {ticket.subject}
              </bdi>
            }
            amount={<span className="text-xs font-normal text-ink-soft">{when}</span>}
            status={status}
            meta={
              <>
                {labels.category(ticket.category)}
                <span aria-hidden> · </span>
                {messages}
              </>
            }
            unread={waiting}
            onOpen={onPeek}
            openLabel={peekLabel}
            aria-haspopup="dialog"
            {...keys}
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow onOpen={onPeek} openLabel={peekLabel} keyProps={keys} current={current} menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-[15px] leading-6 text-ink">
          {waiting && <span aria-hidden className="zimos-row-dot size-2 shrink-0 rounded-full bg-primary" />}
          {/* The subject is the way to the ticket's page; the row itself opens the preview. */}
          <ViewLink
            to={to}
            aria-label={fmt(t.openTicket, { subject: ticket.subject })}
            className={cn(
              "min-w-0 truncate rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              waiting ? "font-semibold" : "font-medium"
            )}
          >
            <bdi data-vt-part="title" dir="auto">
              {ticket.subject}
            </bdi>
          </ViewLink>
        </p>
        <p className="truncate text-xs leading-5 text-ink-soft">{labels.category(ticket.category)}</p>
      </div>
      <div className="flex items-center">{status}</div>
      <div className="text-end text-[13px] whitespace-nowrap text-ink-soft tabular-nums">{messages}</div>
      <div className="text-end text-xs whitespace-nowrap text-ink-soft">{when}</div>
    </DeskRow>
  );
}

/** /support/:ticketId — one ticket's thread, and a reply box while it is open. */
export function SupportTicketPage() {
  const { ticketId = "" } = useParams();
  // Keyed by the ticket: a link from one ticket to another starts clean.
  return <TicketView key={ticketId} ticketId={ticketId} />;
}

/** The reply box grows with what is typed, up to about six lines. */
const REPLY_MAX = 168;

function TicketView({ ticketId }: { ticketId: string }) {
  const t = useT(STRINGS);
  const labels = useSupportLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const thread = useCachedAsync(ticketCacheKey(workspaceId, ticketId), () => apiClient.getSupportTicket(workspaceId, ticketId), [workspaceId, ticketId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const ticket = thread.data?.ticket;

  // The box is as tall as what is in it, up to a few lines; after that it scrolls.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, REPLY_MAX)}px`;
  }, [reply, ticket?.status]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!reply.trim()) {
      setError(t.messageRequired);
      boxRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.replySupportTicket(workspaceId, ticketId, reply.trim());
      thread.setData((prev: SupportTicketThread | null) => {
        if (!prev) throw new Error("Ticket not loaded.");
        return { ticket: res.ticket, messages: [...prev.messages, res.message] };
      });
      setReply("");
      toast.success(t.replySent);
    } catch (err) {
      setError(errorMessage(err));
      boxRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={ticket?.subject ?? t.title}
        titleBadge={
          ticket ? <StatusBadge value={ticket.status} tone={SUPPORT_STATUS_TONE[ticket.status]} text={labels.status(ticket.status)} /> : undefined
        }
        description={
          ticket
            ? `${labels.category(ticket.category)} · ${fmt(t.opened, {
                date: formatDateTime(ticket.createdAt),
                name: ticket.createdBy ?? labels.someone,
              })}`
            : undefined
        }
        back={{ to: "/support", label: t.back }}
      />
      <DataState
        loading={thread.loading}
        error={thread.data ? null : thread.error}
        onRetry={() => void thread.refresh()}
        skeleton={<TicketThreadSkeleton />}
      >
        {thread.data && ticket && (
          <div className="flex flex-col gap-4">
            <TicketMessages messages={thread.data.messages} label={t.thread} />

            {ticket.status === "closed" ? (
              <div data-slot="support-closed" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3.5 shadow-[var(--shadow-card)] ring-1 ring-line">
                <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-6 text-ink-soft">
                  <IconLock className="mt-1 size-4 shrink-0" aria-hidden />
                  <span>{t.closedNotice}</span>
                </p>
                <Button variant="outline" asChild className="h-11 shrink-0 gap-1.5 rounded-full px-5">
                  <ViewLink to="/support?new=1">
                    <IconPlus className="size-4" aria-hidden />
                    {t.newTicket}
                  </ViewLink>
                </Button>
              </div>
            ) : (
              // Pinned above the dock (at the bottom edge from md up), so the answer is always one reach away.
              <form
                onSubmit={send}
                noValidate
                data-slot="support-reply"
                className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 rounded-[1.75rem] bg-paper-raised p-2 shadow-[var(--shadow-raised)] ring-1 ring-line md:bottom-4"
              >
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={boxRef}
                    rows={1}
                    maxLength={5000}
                    dir="auto"
                    aria-label={t.reply}
                    aria-invalid={error ? true : undefined}
                    placeholder={t.replyPlaceholder}
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      // Enter is a new line here; Ctrl or ⌘ with it sends.
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    className="max-h-[10.5rem] min-h-11 flex-1 resize-none rounded-[1.375rem] px-4 py-2.5 text-base leading-6 md:text-[15px]"
                  />
                  <Button
                    type="submit"
                    aria-busy={busy || undefined}
                    disabled={busy || !reply.trim()}
                    className="h-11 shrink-0 gap-1.5 rounded-full px-4 max-sm:w-11 max-sm:px-0"
                  >
                    {busy ? (
                      <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                    ) : (
                      <IconSend className="size-[18px] rtl:-scale-x-100" aria-hidden />
                    )}
                    <span className="max-sm:sr-only">{busy ? t.sending : t.sendReply}</span>
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="px-3 pt-2 pb-1 text-xs leading-5 font-medium text-danger">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
