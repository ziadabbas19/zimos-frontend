import type { SupportTicket, SupportTicketCategory, SupportTicketStatus } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";

/** The topics a ticket can be opened under, in the order the form offers them. */
export const SUPPORT_CATEGORIES: SupportTicketCategory[] = ["general", "billing", "orders", "shipping", "payments", "technical", "account"];

/** The statuses a ticket moves through, in the order of the chips. */
export const SUPPORT_STATUSES: SupportTicketStatus[] = ["pending", "open", "resolved", "closed"];

export const SUPPORT_STATUS_TONE: Record<SupportTicketStatus, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  pending: "warning",
  resolved: "success",
  closed: "neutral",
};

const STRINGS = {
  en: {
    cat_general: "General question",
    cat_billing: "Billing & subscription",
    cat_orders: "Orders",
    cat_shipping: "Shipping",
    cat_payments: "Payments",
    cat_technical: "Technical problem",
    cat_account: "Account",
    st_open: "Waiting on Zimos",
    st_pending: "Waiting on you",
    st_resolved: "Resolved",
    st_closed: "Closed",
    messages_one: "1 message",
    messages_other: "{n} messages",
    you: "You",
    someone: "a team member",
  },
  ar: {
    cat_general: "سؤال عام",
    cat_billing: "الفواتير والاشتراك",
    cat_orders: "الطلبات",
    cat_shipping: "الشحن",
    cat_payments: "المدفوعات",
    cat_technical: "مشكلة تقنية",
    cat_account: "الحساب",
    st_open: "تنتظر رد زيموس",
    st_pending: "تنتظر ردك",
    st_resolved: "تم الحل",
    st_closed: "مغلقة",
    messages_one: "رسالة واحدة",
    messages_two: "رسالتان",
    messages_few: "{n} رسائل",
    messages_other: "{n} رسالة",
    you: "أنت",
    someone: "أحد أعضاء الفريق",
  },
} satisfies Messages;

export interface SupportLabels {
  status: (status: SupportTicketStatus) => string;
  category: (category: SupportTicketCategory) => string;
  /** «٣ رسايل», in the reader's digits and plural. */
  messages: (count: number) => string;
  you: string;
  someone: string;
}

/** The words every support screen says the same way: the status, the topic, how many messages. */
export function useSupportLabels(): SupportLabels {
  const t = useT(STRINGS);
  return {
    status: (status) => t[`st_${status}`],
    category: (category) => t[`cat_${category}`],
    messages: (count) => pluralOf(t, "messages", count),
    you: t.you,
    someone: t.someone,
  };
}

/** Zimos answered and the ticket waits for the store: the one state that asks for a look. */
export function waitsOnYou(ticket: Pick<SupportTicket, "status">): boolean {
  return ticket.status === "pending";
}

/** The session's copy of one ticket's thread: Quick Look reads it, and the ticket's page opens from it at once. */
export function ticketCacheKey(workspaceId: string, ticketId: string): string {
  return `support-ticket:${workspaceId}:${ticketId}`;
}

/** The session's copy of the list of tickets. */
export function ticketsCacheKey(workspaceId: string): string {
  return `support-tickets:${workspaceId}`;
}
