import { useState, type ReactNode } from "react";
import type { NetworkScore } from "@store-builder/api-client";
import { ContactActions } from "@/components/ContactActions";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { useNow } from "@/pages/confirmation/confirmationRoles";
import { NetworkRateBar } from "@/pages/fraud/NetworkRate";
import { STAGE_TONE } from "../orderLabels";
import { OrderFlag, type OrderRowView } from "./orderRow";

const STRINGS = {
  en: {
    listLabel: "Orders",
    selectOrder: "Select order {number}",
    menuLabel: "Actions for order {number}",
    more: "+{n}",
    moreLabel: "Show {n} more",
  },
  ar: {
    listLabel: "الطلبات",
    selectOrder: "تحديد الطلب {number}",
    menuLabel: "إجراءات الطلب {number}",
    more: "+{n}",
    moreLabel: "عرض {n} أخرى",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** How many chips a card shows under its two lines before the rest wait behind "+n". */
const CHIPS_SHOWN = 2;

export interface OrderCardsProps {
  rows: readonly OrderRowView[];
  selected: ReadonlySet<string>;
  onToggle: (orderId: string) => void;
  /** Delivery rates by customer id (useNetworkScores). */
  scores: Record<string, NetworkScore>;
  menuFor: (view: OrderRowView) => ContextMenuItem[];
  /** Quick Look. */
  onPeek: (view: OrderRowView) => void;
  /** The order's own page. */
  onOpen: (view: OrderRowView) => void;
}

/**
 * The orders on a phone: one card each (ListRowCard). Who and how much on the
 * first line; where it stands, where it goes and how long ago on the second,
 * with call and WhatsApp one tap away; then at most two chips — what to be
 * careful about first (flagged, risk), then its tags — and "+n" for the rest.
 *
 * A tap opens Quick Look; a long press, the order's menu; Enter on a focused
 * card, the order's page. The tick box selects it for the bulk bar.
 */
export function OrderCards({ rows, selected, onToggle, scores, menuFor, onPeek, onOpen }: OrderCardsProps) {
  const t = useT(STRINGS);
  // One clock for the whole list, so every card's "3 hours ago" moves together.
  const now = useNow(60_000);
  return (
    <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
      {rows.map((view) => (
        <OrderCard
          key={view.order.id}
          view={view}
          selected={selected.has(view.order.id)}
          onToggle={onToggle}
          score={scores[view.order.customerId]}
          menu={menuFor(view)}
          onPeek={onPeek}
          onOpen={onOpen}
          now={now}
          t={t}
        />
      ))}
    </ul>
  );
}

function OrderCard({
  view,
  selected,
  onToggle,
  score,
  menu,
  onPeek,
  onOpen,
  now,
  t,
}: {
  view: OrderRowView;
  selected: boolean;
  onToggle: (orderId: string) => void;
  score: NetworkScore | undefined;
  menu: ContextMenuItem[];
  onPeek: (view: OrderRowView) => void;
  onOpen: (view: OrderRowView) => void;
  now: number;
  t: Strings;
}) {
  const { order, name, phone, place, money, stageLabel, meta, flags } = view;
  // "+n" opens the card's own chips in place: everything a row can say is one tap away.
  const [allChips, setAllChips] = useState(false);

  const chips: ReactNode[] = [
    ...flags.map((flag) => <OrderFlag key={flag.id} flag={flag} />),
    ...meta.tags.map((tag) => <StatusBadge key={`tag:${tag}`} value={tag} tone="info" text={tag} />),
  ];
  if (score) chips.push(<NetworkRateBar key="rate" score={score} />);
  const shown = allChips ? chips : chips.slice(0, CHIPS_SHOWN);
  const hidden = chips.length - shown.length;

  return (
    <ContextMenu items={menu} label={fmt(t.menuLabel, { number: order.orderNumber })}>
      {/* The card and its parts are the source of the journey into the order's page (lib/viewTransition.ts). */}
      <li data-order-row={order.id}>
        <ListRowCard
          title={
            <span data-vt-part="title">
              <bdi>{name}</bdi>
            </span>
          }
          amount={
            <span data-vt-part="amount" className="inline-block">
              <bdi>{money}</bdi>
            </span>
          }
          status={
            order.stage && stageLabel ? (
              <span data-vt-part="status" className="inline-flex">
                <StatusBadge value={order.stage} tone={STAGE_TONE[order.stage]} text={stageLabel} />
              </span>
            ) : undefined
          }
          meta={
            // The age never gives way; the place takes what is left beside the two buttons.
            <span className="flex min-w-0 items-center gap-1.5">
              {place && (
                <>
                  <span className="min-w-0 truncate">{place}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)} className="shrink-0">
                {formatRelative(order.createdAt, now, getIntlLocale())}
              </time>
            </span>
          }
          // A masked number offers neither: there is nothing to dial.
          action={phone ? <ContactActions phone={phone} name={order.contactSnapshot?.fullName} variant="icon" /> : undefined}
          footer={
            chips.length > 0 ? (
              <>
                {shown}
                {hidden > 0 && (
                  <button
                    type="button"
                    aria-label={fmt(t.moreLabel, { n: hidden })}
                    aria-expanded={false}
                    onClick={(e) => {
                      // The card under it is one big button: this press is the chip's alone.
                      e.stopPropagation();
                      setAllChips(true);
                    }}
                    className="zimos-order-flag inline-flex h-5 cursor-pointer items-center rounded-full bg-paper-sunken px-2 text-[11px] leading-none font-semibold text-ink-soft tabular-nums before:absolute before:-inset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {fmt(t.more, { n: hidden })}
                  </button>
                )}
              </>
            ) : undefined
          }
          selected={selected}
          onSelectedChange={() => onToggle(order.id)}
          selectLabel={fmt(t.selectOrder, { number: order.orderNumber })}
          onOpen={() => onPeek(view)}
          unread={!meta.isSeen}
          aria-haspopup="dialog"
          onKeyDown={(e) => {
            // Space peeks (the card's own key); Enter, on the card itself, opens the order's page.
            if (e.key !== "Enter" || e.target !== e.currentTarget || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            onOpen(view);
          }}
        />
      </li>
    </ContextMenu>
  );
}
