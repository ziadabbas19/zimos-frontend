import { useMemo, useState } from "react";
import {
  LOST_ORDER_RECOVERY_STATUSES,
  lostOrdersDelete,
  lostOrdersRevealPhone,
  lostOrdersSendWhatsapp,
  lostOrdersUpdate,
  type LostOrder,
  type LostOrderRecoveryStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { storeUrl } from "@/lib/storeAddress";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import type { ContextMenuItem } from "@/components/ContextMenu";
import {
  IconCopy,
  IconDelete,
  IconEye,
  IconLink,
  IconOrders,
  IconPhone,
  IconQuickLook,
  IconSuccess,
  IconUndo,
  IconWhatsApp,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLostOrderLabels } from "./lostOrderLabels";
import {
  MANAGE_ROLES,
  dialable,
  isMasked,
  reachable,
  whatsappNumber,
  type LostOrderRowActions,
  type WhatsappMode,
} from "./lostOrderModel";
import type { LostOrdersListState } from "./useLostOrdersList";
import { rememberWhatsappAsked, shouldAskBeforeWhatsapp } from "./WhatsappSendConfirm";

const STRINGS = {
  en: {
    // Written to the shopper, in the storefront's register: it is the text of the WhatsApp chat that opens.
    whatsappMessage: "Hello {name}, you left your order unfinished. You can complete it here: {link}",
    whatsappSent: "Recovery message sent from your WhatsApp number.",
    marked: "Marked: {status}",
    reviewed: "Marked as reviewed.",
    reopened: "Back under review.",
    noPhone: "No number is saved for this order.",
    removed: "Lost order deleted.",
    converted: "Order {order} created.",
    openIt: "Open it",
    phoneCopied: "Number copied.",
    linkCopied: "Recovery link copied.",
    copyFailed: "Couldn't copy. Select it and copy it by hand.",
    menuPeek: "Quick look",
    menuCall: "Call",
    menuSend: "Send WhatsApp",
    menuWhatsapp: "Open WhatsApp",
    menuReveal: "Show number",
    menuCopyPhone: "Copy the number",
    menuCopyLink: "Copy the recovery link",
    menuMark: "Mark: {status}",
    menuReviewed: "Done reviewing",
    menuReopen: "Back to review",
    menuConvert: "Convert to an order",
    menuOpenOrder: "Open order {order}",
    menuRemove: "Delete",
  },
  ar: {
    whatsappMessage: "أهلًا {name}، طلبك لسه ما اكتملش. تقدر تكمّله من هنا: {link}",
    whatsappSent: "تم إرسال رسالة الاسترجاع من رقم واتساب متجرك.",
    marked: "تم التعليم: {status}",
    reviewed: "تم تعليمه بأن مراجعته انتهت.",
    reopened: "أُعيد إلى المراجعة.",
    noPhone: "لا يوجد رقم مسجَّل لهذا الطلب.",
    removed: "تم حذف الطلب المفقود.",
    converted: "تم إنشاء الطلب {order}.",
    openIt: "فتحه",
    phoneCopied: "تم نسخ الرقم.",
    linkCopied: "تم نسخ رابط الإكمال.",
    copyFailed: "تعذّر النسخ. حدّده وانسخه يدويًا.",
    menuPeek: "نظرة سريعة",
    menuCall: "اتصال",
    menuSend: "إرسال واتساب",
    menuWhatsapp: "فتح واتساب",
    menuReveal: "إظهار الرقم",
    menuCopyPhone: "نسخ الرقم",
    menuCopyLink: "نسخ رابط الإكمال",
    menuMark: "تعليم: {status}",
    menuReviewed: "تمت المراجعة",
    menuReopen: "إعادة للمراجعة",
    menuConvert: "تحويل إلى طلب",
    menuOpenOrder: "فتح الطلب {order}",
    menuRemove: "حذف",
  },
} satisfies Messages;

type UpdatePayload = Parameters<typeof lostOrdersUpdate>[3];

/** An order number inside an Arabic sentence keeps its own left-to-right order (LRI … PDI). */
function isolate(text: string): string {
  return `${String.fromCharCode(0x2066)}${text}${String.fromCharCode(0x2069)}`;
}

function withId(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

/**
 * Everything the lost orders page does to a row, in one place: the handlers
 * the old page held (recovery status, review, the three ways WhatsApp works,
 * delete, convert) with the same endpoints and payloads, plus what is new on
 * the page — the reveal of a masked number as its own step, the question
 * before the first template is sent, Quick Look, and Undo on what can be
 * taken back. The page draws the dialogs; this holds their state.
 */
export function useLostOrderActions({ list, refreshStats }: { list: LostOrdersListState; refreshStats: () => void }) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const navigate = useViewNavigate();
  const { currentWorkspace } = useWorkspace();
  const canManage = MANAGE_ROLES.has(currentWorkspace?.role ?? "");

  // With the store's WhatsApp connected, the row's WhatsApp sends the recovery template from that number.
  // Remembered for the session, so on the way back the rows show the right button at once.
  const storeWhatsapp = useCachedAsync<boolean>(
    `lost-orders:whatsapp:${workspaceId}`,
    () =>
      apiClient
        .getWhatsappIntegration(workspaceId)
        .then((integration) => Boolean(integration && "connected" in integration && integration.connected))
        .catch(() => false),
    [workspaceId]
  );
  const whatsappMode: WhatsappMode = storeWhatsapp.data === null ? "unknown" : storeWhatsapp.data ? "store" : "link";

  const [sending, setSending] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [revealing, setRevealing] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Numbers the server handed over on this visit (each reveal is in the activity log). Kept here only: the
  // list and its memory hold the rows as the server sends them, masked.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [peek, setPeek] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LostOrder | null>(null);
  const [asking, setAsking] = useState<LostOrder | null>(null);

  /** The rows as the page draws them: a revealed number in place of its mask. */
  const rows = useMemo(
    () =>
      list.items.map((session) => {
        const phone = revealed[session.id];
        return phone ? { ...session, phone } : session;
      }),
    [list.items, revealed]
  );

  const { setItems } = list;
  const replaceRow = (updated: LostOrder) => setItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  const patchRow = (id: string, patch: Partial<LostOrder>) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const closePeek = () => setPeek((prev) => (prev.open ? { ...prev, open: false } : prev));

  /** PATCH a status: shown at once, put back if the server refuses, and offered back with Undo once it is saved. */
  async function change(session: LostOrder, payload: UpdatePayload, back: UpdatePayload, message: string) {
    patchRow(session.id, payload);
    try {
      replaceRow(await lostOrdersUpdate(apiClient, workspaceId, session.id, payload));
    } catch (err) {
      patchRow(session.id, back);
      toast.error(errorMessage(err));
      return;
    }
    if (payload.recoveryStatus) refreshStats();
    toast.undo(message, async () => {
      replaceRow(await lostOrdersUpdate(apiClient, workspaceId, session.id, back));
      if (back.recoveryStatus) refreshStats();
    });
  }

  function setRecovery(session: LostOrder, next: LostOrderRecoveryStatus) {
    if (next === session.recoveryStatus) return;
    void change(
      session,
      { recoveryStatus: next },
      { recoveryStatus: session.recoveryStatus },
      fmt(t.marked, { status: labels.recovery(next) })
    );
  }

  function toggleReview(session: LostOrder) {
    const next = session.reviewStatus === "completed" ? "under_review" : "completed";
    void change(session, { reviewStatus: next }, { reviewStatus: session.reviewStatus }, next === "completed" ? t.reviewed : t.reopened);
  }

  function recoveryLink(session: LostOrder): string | null {
    if (!session.recoveryPath || !currentWorkspace?.slug) return null;
    return `${storeUrl(currentWorkspace.slug)}${session.recoveryPath}`;
  }

  function whatsappHref(session: LostOrder): string {
    const link = recoveryLink(session) ?? "";
    const text = fmt(t.whatsappMessage, { name: session.customerName ?? "", link });
    return `https://wa.me/${whatsappNumber(session.phone)}?text=${encodeURIComponent(text)}`;
  }

  /** The wa.me link was followed: a manager's untouched row becomes "contacted" (as the old link did). */
  function whatsappOpened(session: LostOrder) {
    if (canManage && session.recoveryStatus === "not_contacted") setRecovery(session, "contacted");
  }

  async function sendNow(session: LostOrder) {
    setSending((prev) => withId(prev, session.id, true));
    try {
      const res = await lostOrdersSendWhatsapp(apiClient, workspaceId, session.id);
      patchRow(session.id, { recoveryStatus: res.recoveryStatus });
      toast.success(t.whatsappSent);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending((prev) => withId(prev, session.id, false));
    }
  }

  /** «ابعت واتساب»: the first time in a session it says what it is about to do and waits for «ابعت». */
  function sendWhatsapp(session: LostOrder) {
    if (shouldAskBeforeWhatsapp(workspaceId)) {
      closePeek();
      setAsking(session);
      return;
    }
    void sendNow(session);
  }

  function confirmSend(session: LostOrder, notAgainToday: boolean) {
    rememberWhatsappAsked(workspaceId, notAgainToday);
    setAsking(null);
    void sendNow(session);
  }

  /** «اظهر الرقم»: the server hands over the one number, and logs it. */
  async function reveal(session: LostOrder): Promise<string | null> {
    setRevealing((prev) => withId(prev, session.id, true));
    try {
      const phone = await lostOrdersRevealPhone(apiClient, workspaceId, session.id);
      if (!phone) {
        toast.error(t.noPhone);
        return null;
      }
      setRevealed((prev) => ({ ...prev, [session.id]: phone }));
      return phone;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setRevealing((prev) => withId(prev, session.id, false));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await lostOrdersDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      // Thrown, so the dialog stays open and shows why.
      throw new Error(errorMessage(err));
    }
    const id = removing.id;
    setItems((prev) => prev.filter((s) => s.id !== id));
    toast.success(t.removed);
    setRemoving(null);
    refreshStats();
  }

  function converted(updated: LostOrder, order: { id: string; orderNumber: string }) {
    replaceRow(updated);
    setConvertingId(null);
    toast.notify("success", fmt(t.converted, { order: isolate(order.orderNumber) }), {
      action: { label: t.openIt, onClick: () => navigate(`/orders/${order.id}`) },
    });
    refreshStats();
  }

  async function copy(text: string, done: string) {
    try {
      await copyText(text);
      toast.success(done);
    } catch {
      toast.error(t.copyFailed);
    }
  }

  const openPeek = (session: LostOrder) => setPeek({ id: session.id, open: true });
  const convert = (session: LostOrder) => {
    closePeek();
    setConvertingId(session.id);
  };
  const remove = (session: LostOrder) => {
    closePeek();
    setRemoving(session);
  };

  /** The row's context menu (right-click, long press, Shift+F10): every action of Quick Look, one press away. */
  function menuFor(session: LostOrder): ContextMenuItem[] {
    const items: ContextMenuItem[] = [{ id: "peek", label: t.menuPeek, icon: IconQuickLook, onSelect: () => openPeek(session) }];
    const order = session.convertedOrder;
    if (order) {
      items.push({
        id: "order",
        label: fmt(t.menuOpenOrder, { order: isolate(order.orderNumber) }),
        icon: IconOrders,
        onSelect: () => navigate(`/orders/${order.id}`),
      });
    }

    const whole = dialable(session.phone);
    if (whole) {
      items.push({
        id: "call",
        label: t.menuCall,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = `tel:${session.phone}`;
        },
      });
    }
    if (whatsappMode === "store" && reachable(session.phone)) {
      items.push({
        id: "send",
        label: t.menuSend,
        icon: IconWhatsApp,
        separatorBefore: !whole,
        disabled: sending.has(session.id),
        onSelect: () => sendWhatsapp(session),
      });
    } else if (whatsappMode === "link" && whole) {
      items.push({
        id: "whatsapp",
        label: t.menuWhatsapp,
        icon: IconWhatsApp,
        onSelect: () => {
          window.open(whatsappHref(session), "_blank", "noopener,noreferrer");
          whatsappOpened(session);
        },
      });
    }
    if (isMasked(session.phone)) {
      items.push({
        id: "reveal",
        label: t.menuReveal,
        icon: IconEye,
        separatorBefore: whatsappMode !== "store",
        disabled: revealing.has(session.id),
        onSelect: () => void reveal(session),
      });
    }
    if (whole) {
      items.push({ id: "copy-phone", label: t.menuCopyPhone, icon: IconCopy, onSelect: () => void copy(session.phone, t.phoneCopied) });
    }
    const link = recoveryLink(session);
    if (link && !order) {
      items.push({ id: "copy-link", label: t.menuCopyLink, icon: IconLink, onSelect: () => void copy(link, t.linkCopied) });
    }

    if (canManage && session.status !== "converted") {
      LOST_ORDER_RECOVERY_STATUSES.filter((status) => status !== session.recoveryStatus).forEach((status, index) => {
        items.push({
          id: `mark-${status}`,
          label: fmt(t.menuMark, { status: labels.recovery(status) }),
          icon: status === "not_contacted" ? IconUndo : IconSuccess,
          separatorBefore: index === 0,
          onSelect: () => setRecovery(session, status),
        });
      });
      items.push({
        id: "review",
        label: session.reviewStatus === "completed" ? t.menuReopen : t.menuReviewed,
        icon: session.reviewStatus === "completed" ? IconUndo : IconSuccess,
        onSelect: () => toggleReview(session),
      });
      items.push({ id: "convert", label: t.menuConvert, icon: IconOrders, separatorBefore: true, onSelect: () => convert(session) });
      items.push({ id: "remove", label: t.menuRemove, icon: IconDelete, destructive: true, onSelect: () => remove(session) });
    }
    return items;
  }

  const actions: LostOrderRowActions = {
    canManage,
    whatsappMode,
    isSending: (id) => sending.has(id),
    isRevealing: (id) => revealing.has(id),
    peek: openPeek,
    sendWhatsapp,
    whatsappHref,
    whatsappOpened,
    reveal,
    setRecovery,
    toggleReview,
    convert,
    remove,
    recoveryLink,
    copy: (text, done) => void copy(text, done),
    menuFor,
  };

  return {
    /** The loaded rows, with any number revealed on this visit in place of its mask. */
    rows,
    actions,
    /** Quick Look: which row, and whether it is open (the row stays while the panel closes). */
    peek,
    closePeek,
    /** The row the convert dialog is about. */
    convertingId,
    cancelConvert: () => setConvertingId(null),
    converted,
    /** The row the delete confirmation is about. */
    removing,
    cancelRemove: () => setRemoving(null),
    confirmRemove,
    /** The row whose first WhatsApp of the session is waiting for «ابعت». */
    asking,
    cancelAsk: () => setAsking(null),
    confirmSend,
  };
}
