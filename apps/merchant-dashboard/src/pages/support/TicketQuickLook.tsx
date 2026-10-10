import type { SupportTicket } from "@store-builder/api-client";
import { DataState } from "@/components/DataState";
import { QuickLook } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { SUPPORT_STATUS_TONE, ticketCacheKey, useSupportLabels, waitsOnYou } from "./supportLabels";
import { TicketMessages, TicketThreadSkeleton } from "./TicketThread";

const STRINGS = {
  en: {
    opened: "Opened {date} by {name}",
    openAndReply: "Open and reply",
    openTicket: "Open the ticket",
    waiting: "Zimos support answered and is waiting for your reply.",
    thread: "Messages of this ticket",
  },
  ar: {
    opened: "فُتحت {date} بواسطة {name}",
    openAndReply: "فتح والرد",
    openTicket: "فتح التذكرة",
    waiting: "رد عليك دعم زيموس وينتظر ردك.",
    thread: "رسائل هذه التذكرة",
  },
} satisfies Messages;

/**
 * Quick Look of a ticket: its messages, read without leaving the list. The
 * one way out is the ticket's own page, where the reply is written.
 * The thread it reads is kept for the session, so that page opens from it at once.
 */
export function TicketQuickLook({ ticket, open, onOpenChange }: { ticket: SupportTicket | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!ticket) return null;
  // Keyed by the ticket: another row means another read, never the last one's messages for a moment.
  return <TicketPeek key={ticket.id} ticket={ticket} open={open} onOpenChange={onOpenChange} />;
}

function TicketPeek({ ticket, open, onOpenChange }: { ticket: SupportTicket; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(STRINGS);
  const labels = useSupportLabels();
  const workspaceId = useWorkspaceId();
  const thread = useCachedAsync(ticketCacheKey(workspaceId, ticket.id), () => apiClient.getSupportTicket(workspaceId, ticket.id), [workspaceId, ticket.id]);
  // The list's copy until the thread brings a fresher one.
  const current = thread.data?.ticket ?? ticket;

  return (
    <QuickLook
      open={open}
      onOpenChange={onOpenChange}
      title={<bdi>{current.subject}</bdi>}
      status={<StatusBadge value={current.status} tone={SUPPORT_STATUS_TONE[current.status]} text={labels.status(current.status)} />}
      to={`/support/${ticket.id}`}
      openLabel={current.status === "closed" ? t.openTicket : t.openAndReply}
    >
      <div className="space-y-4">
        <p className="text-xs leading-5 text-ink-soft">
          {labels.category(current.category)}
          <span aria-hidden> · </span>
          {fmt(t.opened, { date: formatDateTime(current.createdAt), name: current.createdBy ?? labels.someone })}
        </p>
        {waitsOnYou(current) && (
          <p data-slot="support-note" className="rounded-[1rem] bg-accent-soft px-3.5 py-2.5 text-[13px] leading-5 font-medium text-accent-dark">
            {t.waiting}
          </p>
        )}
        <DataState
          loading={thread.loading}
          error={thread.data ? null : thread.error}
          onRetry={() => void thread.refresh()}
          skeleton={<TicketThreadSkeleton />}
        >
          {thread.data && <TicketMessages messages={thread.data.messages} label={t.thread} />}
        </DataState>
      </div>
    </QuickLook>
  );
}
