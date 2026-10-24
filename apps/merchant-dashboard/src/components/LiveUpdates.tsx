import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { REALTIME_ENABLED } from "@/lib/features";
import { ORDER_EVENTS, subscribeLiveMessages, useLiveConnection, useLiveEvents } from "@/lib/liveUpdates";
import { playChime, soundSetting } from "@/lib/newOrderChime";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { refreshWorkCounts } from "@/lib/workCounts";

const STRINGS = {
  en: {
    created_one: "New order",
    created_other: "{n} new orders",
    paid_one: "An order was paid",
    paid_other: "{n} orders were paid",
    moved_one: "An order changed stage",
    moved_other: "{n} orders changed stage",
    view: "View",
  },
  ar: {
    created_one: "طلب جديد",
    created_other: "طلبات جديدة: {n}",
    paid_one: "تم دفع طلب",
    paid_other: "طلبات تم دفعها: {n}",
    moved_one: "تغيّرت مرحلة طلب",
    moved_other: "طلبات تغيّرت مرحلتها: {n}",
    view: "عرض",
  },
} satisfies Messages;

/** Events of one kind arriving within this window are one toast. */
const GROUP_MS = 1_200;
const KIND = { "order.created": "created", "order.paid": "paid", "order.status_changed": "moved" } as const;
type Kind = (typeof KIND)[keyof typeof KIND];

/**
 * The live updates' part of the shell (VITE_REALTIME_ENABLED; renders nothing).
 * Opens the one connection; on a new, paid or moved order of this store it
 * refreshes the counts (side menu, dock, the Confirmation queue badge) and
 * says so in a toast — "New order", never who or how much — with the
 * new-order sound for a new or paid order when the teammate turned it on.
 * While the connection is down, the counts are read every 30 seconds.
 */
export function LiveUpdates() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const navigate = useNavigate();

  useLiveConnection();
  useLiveEvents(workspaceId, ORDER_EVENTS, refreshWorkCounts);

  useEffect(() => {
    if (!REALTIME_ENABLED || !workspaceId) return;
    const waiting: Record<Kind, string[]> = { created: [], paid: [], moved: [] };
    const timers: Partial<Record<Kind, number>> = {};
    const show = (kind: Kind) => {
      const ids = [...new Set(waiting[kind])];
      waiting[kind] = [];
      if (ids.length === 0) return;
      const message = ids.length === 1 ? t[`${kind}_one`] : t[`${kind}_other`].replace("{n}", String(ids.length));
      const to = ids.length === 1 ? `/orders/${ids[0]}` : "/orders";
      toast.notify("success", message, { action: { label: t.view, onClick: () => navigate(to) }, duration: 6000 });
      if (kind !== "moved" && soundSetting()) playChime();
    };
    const off = subscribeLiveMessages((message) => {
      if (message.workspaceId !== workspaceId) return;
      const kind = KIND[message.type as keyof typeof KIND];
      if (!kind) return;
      waiting[kind].push(message.entity.id);
      window.clearTimeout(timers[kind]);
      timers[kind] = window.setTimeout(() => show(kind), GROUP_MS);
    });
    return () => {
      off();
      Object.values(timers).forEach((id) => window.clearTimeout(id));
    };
  }, [workspaceId, t, toast, navigate]);

  return null;
}
