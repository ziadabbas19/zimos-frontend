import { useEffect, useRef } from "react";
import { cn } from "@store-builder/ui";
import type { LostOrder, LostOrderRecoveryStatus } from "@store-builder/api-client";
import { SkeletonBar } from "@/components/DataState";
import { IconCheck, IconEye, IconMinus, IconOrders, IconPhone, IconSpinner, IconWhatsApp } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useLostOrderLabels } from "./lostOrderLabels";
import { RECOVERY_TONE, isMasked, reachable, type LostOrderRowActions } from "./lostOrderModel";

const STRINGS = {
  en: {
    send: "Send WhatsApp",
    sendTo: "Send the store's recovery message to {name} on WhatsApp",
    sending: "Sending…",
    reveal: "Show number",
    revealHint: "Showing the number is recorded in the activity log",
    revealing: "Getting the number…",
    call: "Call",
    callName: "Call {name}",
    whatsapp: "WhatsApp",
    whatsappName: "Open WhatsApp with {name}, the recovery message ready",
    openOrder: "Open order {order}",
  },
  ar: {
    send: "إرسال واتساب",
    sendTo: "إرسال رسالة الاسترجاع الخاصة بالمتجر إلى {name} عبر واتساب",
    sending: "جارٍ الإرسال…",
    reveal: "إظهار الرقم",
    revealHint: "إظهار الرقم يُسجَّل في سجل النشاط",
    revealing: "جارٍ جلب الرقم…",
    call: "اتصال",
    callName: "الاتصال بـ {name}",
    whatsapp: "واتساب",
    whatsappName: "فتح واتساب مع {name} ورسالة الاسترجاع جاهزة",
    openOrder: "فتح الطلب {order}",
  },
} satisfies Messages;

/* ---------------------------------------------------------------- *
 * Pills. The same shapes as components/ContactActions.tsx (it cannot
 * be used as it is: here WhatsApp carries the recovery message, or
 * sends the store's template), and the same glass hooks — the
 * `contact-call` / `contact-whatsapp` slots of glass/states.css.
 * A thumb gets 44px; a mouse the compact 36px.
 * ---------------------------------------------------------------- */

export const PILL =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-progress aria-busy:cursor-progress";
export const PILL_LABELLED = "h-11 gap-1.5 px-4 text-sm pointer-fine:h-9 pointer-fine:px-3.5 pointer-fine:text-[13px]";
export const PILL_ICON = "size-11 pointer-fine:size-9";
export const PILL_CALL = "bg-primary-soft text-primary-dark hover:bg-primary hover:text-primary-foreground";
export const PILL_WHATSAPP = "bg-success-soft text-success hover:bg-success hover:text-paper-raised";
/** A quiet pane: «اظهر الرقم», the link to the order a checkout became. Its glass is `.zimos-lost-pill` (glass/recovery.css). */
export const PILL_QUIET = "zimos-lost-pill bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/** The recovery status as a chip; its tints on glass are in glass/recovery.css, keyed by `data-recovery` on the wrapper. */
export function RecoveryChip({ status, className }: { status: LostOrderRecoveryStatus; className?: string }) {
  const labels = useLostOrderLabels();
  return (
    <span data-slot="recovery-chip" data-recovery={status} className={cn("inline-flex shrink-0", className)}>
      <StatusBadge value={status} tone={RECOVERY_TONE[status]} text={labels.recovery(status)} />
    </span>
  );
}

/**
 * A tick box with a 44px target (36px with a mouse) around a 20px box: the
 * table's column and its head. The box is the kit's own (`zimos-row-check`),
 * so a ticked row looks the same in the table and on a phone card.
 */
export function RowCheck({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean;
  /** Some rows ticked, not all: the head shows a dash. */
  mixed?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed && !checked;
  }, [mixed, checked]);
  const on = checked || mixed;
  return (
    <label className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center pointer-fine:size-9">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
      />
      <span
        aria-hidden
        data-checked={on ? "" : undefined}
        className={cn(
          "zimos-row-check pointer-events-none flex size-5 items-center justify-center rounded-[6px]",
          "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-active:scale-[0.92] motion-reduce:peer-active:scale-100",
          on ? "bg-primary text-primary-foreground" : "bg-paper-raised ring-[1.5px] ring-line-strong ring-inset"
        )}
      >
        {checked ? (
          <IconCheck className="size-3.5" aria-hidden />
        ) : mixed ? (
          <IconMinus className="size-3.5" aria-hidden />
        ) : null}
      </span>
    </label>
  );
}

/**
 * A row's ONE recovery action — what the merchant most likely does next:
 *
 *  - the checkout became an order → a link to that order;
 *  - the store's WhatsApp is connected → «ابعت واتساب», which SENDS the store's
 *    recovery template (and asks first, once a session — WhatsappSendConfirm);
 *  - otherwise, with a whole number → call and a WhatsApp link that opens a
 *    chat with the recovery message typed;
 *  - otherwise, with a masked number → «اظهر الرقم», the audited reveal, after
 *    which call and WhatsApp appear.
 *
 * Everything else (status, convert, delete) is in Quick Look and the context
 * menu. Nothing is drawn for a lost order with no number at all.
 */
export function LostOrderAction({ session, actions }: { session: LostOrder; actions: LostOrderRowActions }) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const name = labels.name(session);

  if (session.convertedOrder) {
    const order = session.convertedOrder;
    return (
      <ViewLink
        to={`/orders/${order.id}`}
        aria-label={fmt(t.openOrder, { order: order.orderNumber })}
        className={cn(PILL, PILL_LABELLED, PILL_QUIET)}
      >
        <IconOrders className="size-4" aria-hidden />
        <bdi dir="ltr" className="tabular-nums">
          {order.orderNumber}
        </bdi>
      </ViewLink>
    );
  }

  if (!reachable(session.phone)) return null;

  if (actions.whatsappMode === "unknown") {
    // Until the page knows how this store's WhatsApp works, a placeholder of the pill's size: nothing to press by mistake.
    return (
      <span aria-hidden className="flex h-11 w-28 items-center pointer-fine:h-9">
        <SkeletonBar className="h-full w-full" />
      </span>
    );
  }

  if (actions.whatsappMode === "store") {
    const busy = actions.isSending(session.id);
    return (
      <button
        type="button"
        data-slot="contact-whatsapp"
        aria-busy={busy || undefined}
        aria-label={fmt(t.sendTo, { name })}
        title={fmt(t.sendTo, { name })}
        onClick={() => {
          if (!busy) actions.sendWhatsapp(session);
        }}
        className={cn(PILL, PILL_LABELLED, PILL_WHATSAPP)}
      >
        {busy ? (
          <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconWhatsApp className="size-4" aria-hidden />
        )}
        <span aria-hidden>{t.send}</span>
        {busy && <span className="sr-only">{t.sending}</span>}
      </button>
    );
  }

  if (isMasked(session.phone)) {
    const busy = actions.isRevealing(session.id);
    return (
      <button
        type="button"
        aria-busy={busy || undefined}
        title={t.revealHint}
        onClick={() => {
          if (!busy) void actions.reveal(session);
        }}
        className={cn(PILL, PILL_LABELLED, PILL_QUIET)}
      >
        {busy ? (
          <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconEye className="size-4" aria-hidden />
        )}
        {t.reveal}
        {busy && <span className="sr-only">{t.revealing}</span>}
      </button>
    );
  }

  return (
    <div data-slot="contact-actions" className="flex items-center gap-2">
      <a
        href={`tel:${session.phone}`}
        aria-label={fmt(t.callName, { name })}
        title={t.call}
        data-slot="contact-call"
        className={cn(PILL, PILL_ICON, PILL_CALL)}
      >
        {/* A phone is not a direction: it is never mirrored. */}
        <IconPhone className="size-5" aria-hidden />
      </a>
      <a
        href={actions.whatsappHref(session)}
        target="_blank"
        rel="noreferrer"
        aria-label={fmt(t.whatsappName, { name })}
        title={t.whatsapp}
        data-slot="contact-whatsapp"
        onClick={() => actions.whatsappOpened(session)}
        className={cn(PILL, PILL_ICON, PILL_WHATSAPP)}
      >
        <IconWhatsApp className="size-5" aria-hidden />
      </a>
    </div>
  );
}
