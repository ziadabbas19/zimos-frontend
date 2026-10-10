import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, buttonVariants, cn } from "@store-builder/ui";
import type { LostOrder, LostOrderRecoveryStatus } from "@store-builder/api-client";
import { LOST_ORDER_RECOVERY_STATUSES } from "@store-builder/api-client";
import {
  IconArrowOut,
  IconCopy,
  IconDelete,
  IconEye,
  IconLink,
  IconOrders,
  IconPhone,
  IconPlace,
  IconSpinner,
  IconSuccess,
  IconUndo,
  IconWhatsApp,
} from "@/components/icons";
import { FilterChoice } from "@/components/list";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { fmt, getLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney, humanize, placeName } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { isPlainNavigationClick, useViewNavigate } from "@/lib/viewTransition";
import { PILL, PILL_CALL, PILL_ICON, PILL_LABELLED, PILL_QUIET, PILL_WHATSAPP, RecoveryChip } from "./LostOrderParts";
import { useLostOrderLabels } from "./lostOrderLabels";
import { dialable, isMasked, reachable, type LostOrderRowActions } from "./lostOrderModel";

const STRINGS = {
  en: {
    lastActivity: "Last activity {when}",
    customer: "Customer",
    noPhone: "No phone number",
    phoneHidden: "Part of the number is hidden",
    reveal: "Show number",
    revealHint: "Showing the number is recorded in the activity log.",
    call: "Call",
    send: "Send WhatsApp",
    sendHint: "Sends your store's ready recovery message from its WhatsApp number.",
    whatsapp: "WhatsApp",
    whatsappHint: "Opens the chat with the recovery message typed; you press send.",
    copyPhone: "Copy the number",
    phoneCopied: "Number copied.",
    basket: "Basket",
    counted: "{label} · {count}",
    times: "× {n}",
    subtotal: "Basket value",
    payment: "Payment: {method}",
    address: "Address typed so far",
    noAddress: "No address typed yet",
    addressNote: "Note: {note}",
    origin: "Where it came from",
    f_channel: "Channel",
    f_country: "Country (by IP)",
    f_ip: "IP address",
    f_started: "Started",
    f_last: "Last activity",
    f_contacted: "Contacted",
    recovery: "Recovery status",
    review: "Review",
    markReviewed: "Done reviewing",
    reopen: "Back to review",
    link: "Recovery link",
    linkHint: "It takes the customer back to their basket to finish the order.",
    copyLink: "Copy the link",
    linkCopied: "Recovery link copied.",
    convert: "Convert to an order",
    openOrder: "Open the order",
    remove: "Delete",
  },
  ar: {
    lastActivity: "آخر نشاط {when}",
    customer: "العميل",
    noPhone: "لا يوجد رقم هاتف",
    phoneHidden: "جزء من الرقم مخفي",
    reveal: "إظهار الرقم",
    revealHint: "إظهار الرقم يُسجَّل في سجل النشاط.",
    call: "اتصال",
    send: "إرسال واتساب",
    sendHint: "يرسل رسالة الاسترجاع الجاهزة من رقم واتساب المتجر.",
    whatsapp: "واتساب",
    whatsappHint: "يفتح المحادثة والرسالة مكتوبة، وأنت من يضغط إرسال.",
    copyPhone: "نسخ الرقم",
    phoneCopied: "تم نسخ الرقم.",
    basket: "السلة",
    counted: "{label} · {count}",
    times: "× {n}",
    subtotal: "قيمة السلة",
    payment: "الدفع: {method}",
    address: "العنوان الذي كتبه",
    noAddress: "لم يكتب عنوانًا بعد",
    addressNote: "ملاحظة: {note}",
    origin: "من أين جاء",
    f_channel: "القناة",
    f_country: "الدولة (من عنوان الإنترنت)",
    f_ip: "عنوان الإنترنت",
    f_started: "بدأ",
    f_last: "آخر نشاط",
    f_contacted: "تم التواصل",
    recovery: "حالة الاسترجاع",
    review: "المراجعة",
    markReviewed: "تمت المراجعة",
    reopen: "إعادة للمراجعة",
    link: "رابط الإكمال",
    linkHint: "يعيد العميل إلى سلته ليكمل الطلب.",
    copyLink: "نسخ الرابط",
    linkCopied: "تم نسخ رابط الإكمال.",
    convert: "تحويل إلى طلب",
    openOrder: "فتح الطلب",
    remove: "حذف",
  },
} satisfies Messages;

/** Things that use Space themselves: on one of these the key is theirs, not Quick Look's (as in components/QuickLook.tsx). */
const CONTROLS =
  "input, textarea, select, button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='menuitem'], [role='tab'], [contenteditable]:not([contenteditable='false'])";

function isPlainSpace(e: KeyboardEvent<HTMLElement>): boolean {
  return e.key === " " && !e.defaultPrevented && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey;
}

/** A small quiet label over a block of the preview. */
function BlockLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs leading-4 font-medium text-ink-soft">{children}</h3>;
}

function Rule() {
  return <div role="separator" data-slot="lost-peek-rule" className="h-px bg-line" />;
}

/** One line of the "where it came from" list; drawn only when it has something to say. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="shrink-0 text-xs leading-5 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-[13px] leading-5 wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

/**
 * Who to reach and how. The number is shown as it came: masked, it says so
 * and offers «اظهر الرقم» — an explicit press, logged by the server — before
 * calling or a WhatsApp link is possible. With the store's WhatsApp connected,
 * «ابعت واتساب» is offered even on a masked number (the server sends it) and a
 * line under it says that it sends.
 */
function PeekCustomer({ session, actions }: { session: LostOrder; actions: LostOrderRowActions }) {
  const t = useT(STRINGS);
  const phone = session.phone?.trim() ?? "";
  const masked = isMasked(phone);
  const whole = dialable(phone);
  const sendsFromStore = actions.whatsappMode === "store" && reachable(phone);
  const sending = actions.isSending(session.id);
  const revealing = actions.isRevealing(session.id);

  return (
    <section>
      <BlockLabel>{t.customer}</BlockLabel>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {phone ? (
          <p className="text-[17px] leading-7 font-semibold text-ink tabular-nums">
            <bdi dir="ltr">{phone}</bdi>
          </p>
        ) : (
          <p className="text-sm leading-7 text-ink-soft">{t.noPhone}</p>
        )}
        {/* A masked number is shown as it came, and said to be masked: never dressed up as whole. */}
        {masked && <span className="text-xs leading-5 text-ink-soft">{t.phoneHidden}</span>}
      </div>
      {session.email && (
        <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">
          <a
            href={`mailto:${session.email}`}
            className="rounded-sm underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <bdi dir="ltr">{session.email}</bdi>
          </a>
        </p>
      )}

      {(masked || whole || sendsFromStore) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {masked && (
            <button
              type="button"
              aria-busy={revealing || undefined}
              onClick={() => {
                if (!revealing) void actions.reveal(session);
              }}
              className={cn(PILL, PILL_LABELLED, PILL_QUIET)}
            >
              {revealing ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconEye className="size-4" aria-hidden />
              )}
              {t.reveal}
            </button>
          )}
          {whole && (
            <a href={`tel:${phone}`} data-slot="contact-call" className={cn(PILL, PILL_LABELLED, PILL_CALL)}>
              {/* A phone is not a direction: it is never mirrored. */}
              <IconPhone className="size-4" aria-hidden />
              {t.call}
            </a>
          )}
          {sendsFromStore ? (
            <button
              type="button"
              data-slot="contact-whatsapp"
              aria-busy={sending || undefined}
              onClick={() => {
                if (!sending) actions.sendWhatsapp(session);
              }}
              className={cn(PILL, PILL_LABELLED, PILL_WHATSAPP)}
            >
              {sending ? (
                <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <IconWhatsApp className="size-4" aria-hidden />
              )}
              {t.send}
            </button>
          ) : (
            whole &&
            actions.whatsappMode === "link" && (
              <a
                href={actions.whatsappHref(session)}
                target="_blank"
                rel="noreferrer"
                data-slot="contact-whatsapp"
                onClick={() => actions.whatsappOpened(session)}
                className={cn(PILL, PILL_LABELLED, PILL_WHATSAPP)}
              >
                <IconWhatsApp className="size-4" aria-hidden />
                {t.whatsapp}
              </a>
            )
          )}
          {whole && (
            <button
              type="button"
              aria-label={t.copyPhone}
              title={t.copyPhone}
              onClick={() => actions.copy(phone, t.phoneCopied)}
              className={cn(PILL, PILL_ICON, PILL_QUIET)}
            >
              <IconCopy className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {/* What the buttons above do, in a line: nothing here acts without saying so. */}
      {(masked || sendsFromStore || (whole && actions.whatsappMode === "link")) && (
        <p className="mt-2 text-xs leading-5 text-ink-soft">
          {[masked ? t.revealHint : null, sendsFromStore ? t.sendHint : whole && actions.whatsappMode === "link" ? t.whatsappHint : null]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </section>
  );
}

/** The basket as the shopper left it: each line with its options and offer, then what it comes to. */
function PeekBasket({ session }: { session: LostOrder }) {
  const t = useT(STRINGS);
  const pieces = session.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section>
      <BlockLabel>{session.items.length > 0 ? fmt(t.counted, { label: t.basket, count: countOf("piece", pieces) }) : t.basket}</BlockLabel>
      <ul className="space-y-2">
        {session.items.map((item, i) => {
          const options = item.options ? Object.values(item.options).filter(Boolean).join(" · ") : "";
          const details = [options, item.offerName].filter(Boolean).join(" · ");
          return (
            <li key={`${item.variantId}-${i}`} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 font-medium wrap-anywhere text-ink">
                  <bdi>{item.productName}</bdi>
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-ink-soft">
                  <span className="shrink-0 tabular-nums">{fmt(t.times, { n: item.quantity })}</span>
                  {details && (
                    <>
                      <span aria-hidden>·</span>
                      <bdi className="min-w-0 truncate">{details}</bdi>
                    </>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-sm leading-5 font-medium whitespace-nowrap text-ink tabular-nums">
                <bdi>{formatMoney(item.lineTotalAmount, session.currency)}</bdi>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs leading-4 font-medium text-ink-soft">{t.subtotal}</p>
          {session.paymentMethod && (
            <p className="mt-1 text-[13px] leading-5 text-ink">{fmt(t.payment, { method: humanize(session.paymentMethod) })}</p>
          )}
        </div>
        <p className="shrink-0 text-[22px] leading-7 font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums">
          <bdi>{formatMoney(session.subtotalAmount, session.currency)}</bdi>
        </p>
      </div>
    </section>
  );
}

/** The address as far as the shopper got with it; present only once the form was submitted. */
function PeekAddress({ session }: { session: LostOrder }) {
  const t = useT(STRINGS);
  const address = session.shippingAddress;
  const street = address?.addressLine?.trim() || "";
  const town = address
    ? [placeName(address.city), placeName(address.province), address.postalCode, address.country === "EG" ? null : address.country]
        .filter((part): part is string => Boolean(part))
        .filter((part, i, all) => all.indexOf(part) === i)
        .join(getLocale() === "ar" ? "، " : ", ")
    : "";
  const note = address?.notes?.trim() || "";
  return (
    <section>
      <BlockLabel>{t.address}</BlockLabel>
      <div className="flex items-start gap-3">
        <span aria-hidden data-slot="lost-peek-tile" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-ink-soft">
          <IconPlace className="size-[18px]" />
        </span>
        {street || town ? (
          <div className="min-w-0 flex-1 self-center">
            {street && (
              <p className="text-sm leading-5 wrap-anywhere text-ink">
                <bdi>{street}</bdi>
              </p>
            )}
            {town && <p className={cn("leading-5", street ? "text-[13px] text-ink-soft" : "text-sm text-ink")}>{town}</p>}
            {note && <p className="mt-1 text-[13px] leading-5 wrap-anywhere text-ink-soft">{fmt(t.addressNote, { note })}</p>}
          </div>
        ) : (
          <p className="min-w-0 flex-1 self-center text-sm leading-5 text-ink-soft">{t.noAddress}</p>
        )}
      </div>
    </section>
  );
}

/** Where the checkout was started and when: the channel, the country, the session's own dates. Empty lines are left out. */
function PeekOrigin({ session }: { session: LostOrder }) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const ltr = (text: string | null | undefined) => (text ? <bdi dir="ltr">{text}</bdi> : null);
  const when = (iso: string | null) => (iso ? <time dateTime={iso}>{formatDateTime(iso)}</time> : null);
  const lines: { label: string; value: ReactNode }[] = [
    { label: t.f_channel, value: labels.source(session.source) },
    { label: t.f_country, value: ltr(session.ipCountry) },
    { label: t.f_ip, value: ltr(session.ipAddress) },
    { label: t.f_started, value: when(session.createdAt) },
    { label: t.f_last, value: when(session.lastActivityAt) },
    { label: t.f_contacted, value: when(session.contactedAt) },
  ];
  return (
    <section>
      <BlockLabel>{t.origin}</BlockLabel>
      <dl>
        {lines
          .filter((line) => line.value !== null)
          .map((line) => (
            <Fact key={line.label} label={line.label}>
              {line.value}
            </Fact>
          ))}
      </dl>
    </section>
  );
}

export interface LostOrderQuickLookProps {
  /** The lost order as the list has it. Null draws nothing (the page keeps the last one while the panel closes). */
  session: LostOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: LostOrderRowActions;
}

/**
 * A lost order at a glance, without leaving the list: who it is and how to
 * reach them, the basket, the address typed so far, where they came from —
 * and every action the row has. Everything shown is on the row the list
 * already loaded, so opening it costs no request.
 *
 * It is the Quick Look of the dashboard — the same frame, header, body and
 * footer as components/QuickLook.tsx, a bottom sheet on the phone and a panel
 * on the end edge from 640px, closed again by Space — put together here from
 * the Sheet parts, because that component always ends in "open fully" and a
 * lost order has no page of its own. Its footer ends instead in what turns a
 * lost order into something: «حوّله لأوردر» (the existing dialog) for a
 * checkout with a phone, or the link to the order once it became one.
 */
export function LostOrderQuickLook({ session, open, onOpenChange, actions }: LostOrderQuickLookProps) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  if (!session) return null;

  const stillLost = session.status !== "converted";
  const manages = actions.canManage && stillLost;
  const why = labels.why(session);
  const stage = labels.stage(session);
  const link = stillLost ? actions.recoveryLink(session) : null;

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      side="auto-end"
      popupProps={{
        onKeyDown(e) {
          if (!isPlainSpace(e)) return;
          if (e.target instanceof Element && e.target.closest(CONTROLS)) return;
          e.preventDefault();
          onOpenChange(false);
        },
      }}
    >
      <SheetHeader
        title={<bdi>{labels.name(session)}</bdi>}
        subtitle={<bdi className="tabular-nums">{formatMoney(session.subtotalAmount, session.currency)}</bdi>}
        status={<RecoveryChip status={session.recoveryStatus} />}
      />
      <SheetBody>
        <div data-slot="lost-peek" className="space-y-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
            {why && (
              <>
                <span className={why.warn ? "font-medium text-accent-dark" : undefined}>{why.text}</span>
                <span aria-hidden>·</span>
              </>
            )}
            {stage && (
              <>
                <span>{stage}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <time dateTime={session.lastActivityAt} title={formatDateTime(session.lastActivityAt)}>
              {fmt(t.lastActivity, { when: labels.ago(session.lastActivityAt) })}
            </time>
            {session.reviewStatus === "completed" && (
              <>
                <span aria-hidden>·</span>
                <span>{labels.review("completed")}</span>
              </>
            )}
          </p>

          <PeekCustomer session={session} actions={actions} />
          <Rule />
          <PeekBasket session={session} />
          <Rule />
          <PeekAddress session={session} />

          {manages && (
            <>
              <Rule />
              <section>
                <BlockLabel>{t.recovery}</BlockLabel>
                <FilterChoice<LostOrderRecoveryStatus>
                  label={t.recovery}
                  options={LOST_ORDER_RECOVERY_STATUSES.map((status) => ({ value: status, label: labels.recovery(status) }))}
                  value={session.recoveryStatus}
                  onChange={(next) => {
                    if (next) actions.setRecovery(session, next);
                  }}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="text-[13px] leading-5 text-ink-soft">
                    {fmt(t.counted, { label: t.review, count: labels.review(session.reviewStatus) })}
                  </p>
                  <button type="button" onClick={() => actions.toggleReview(session)} className={cn(PILL, PILL_LABELLED, PILL_QUIET)}>
                    {session.reviewStatus === "completed" ? (
                      <IconUndo className="size-4 rtl:-scale-x-100" aria-hidden />
                    ) : (
                      <IconSuccess className="size-4" aria-hidden />
                    )}
                    {session.reviewStatus === "completed" ? t.reopen : t.markReviewed}
                  </button>
                </div>
              </section>
            </>
          )}

          {link && (
            <>
              <Rule />
              <section>
                <BlockLabel>{t.link}</BlockLabel>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <p className="min-w-0 flex-1 basis-40 text-[13px] leading-5 text-ink-soft">{t.linkHint}</p>
                  <button type="button" onClick={() => actions.copy(link, t.linkCopied)} className={cn(PILL, PILL_LABELLED, PILL_QUIET)}>
                    <IconLink className="size-4" aria-hidden />
                    {t.copyLink}
                  </button>
                </div>
              </section>
            </>
          )}

          <Rule />
          <PeekOrigin session={session} />
        </div>
      </SheetBody>
      <PeekFooter session={session} actions={actions} onClose={() => onOpenChange(false)} />
    </SheetFrame>
  );
}

/**
 * Pinned under the preview, as in every Quick Look: the quiet actions first,
 * then the one that leaves. A manager's lost order ends in «حوّله لأوردر» — the
 * main button when there is a number to deliver to, a quiet one otherwise —
 * with «امسح» beside it (each opens its own dialog, and the preview steps
 * aside for it). Once it became an order, the footer is the link to that order.
 * A role that can only look gets no footer: the body already holds call and
 * WhatsApp.
 */
function PeekFooter({ session, actions, onClose }: { session: LostOrder; actions: LostOrderRowActions; onClose: () => void }) {
  const t = useT(STRINGS);
  const navigate = useViewNavigate();
  const order = session.convertedOrder;
  const manages = actions.canManage && session.status !== "converted";
  if (!manages && !order) return null;
  const convertIsMain = manages && reachable(session.phone);

  return (
    <SheetFooter className="flex-col sm:flex-nowrap sm:justify-between">
      {manages && (
        <div data-slot="quick-look-actions" className="flex min-w-0 flex-wrap items-center gap-2 max-sm:*:flex-1 sm:flex-1">
          <Button
            type="button"
            variant="ghost"
            data-destructive=""
            className="zimos-lost-danger h-auto min-h-11 gap-2 rounded-full px-4 text-danger hover:bg-danger-soft hover:text-danger sm:min-h-10"
            onClick={() => actions.remove(session)}
          >
            <IconDelete className="size-4" aria-hidden />
            {t.remove}
          </Button>
          {!convertIsMain && (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 gap-2 rounded-full px-5 sm:min-h-10"
              onClick={() => actions.convert(session)}
            >
              <IconOrders className="size-4" aria-hidden />
              {t.convert}
            </Button>
          )}
        </div>
      )}
      {convertIsMain && (
        <Button type="button" className="gap-2 rounded-full px-5 sm:ms-auto" onClick={() => actions.convert(session)}>
          <IconOrders className="size-4" aria-hidden />
          <span className="min-w-0 truncate">{t.convert}</span>
        </Button>
      )}
      {order && (
        <Link
          to={`/orders/${order.id}`}
          data-slot="button"
          data-variant="default"
          className={cn(buttonVariants(), "gap-2 rounded-full px-5 sm:ms-auto")}
          onClick={(e) => {
            // A new tab or window is the browser's; the preview stays where it is.
            if (!isPlainNavigationClick(e)) return;
            e.preventDefault();
            onClose();
            navigate(`/orders/${order.id}`);
          }}
        >
          <span className="min-w-0 truncate">
            {t.openOrder} <bdi dir="ltr">{order.orderNumber}</bdi>
          </span>
          <IconArrowOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      )}
    </SheetFooter>
  );
}
