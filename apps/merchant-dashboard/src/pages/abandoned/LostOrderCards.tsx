import { cn } from "@store-builder/ui";
import type { LostOrder } from "@store-builder/api-client";
import { ContextMenu } from "@/components/ContextMenu";
import { ListRowCard } from "@/components/list";
import { useQuickLookRow } from "@/components/QuickLook";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { LostOrderSelection } from "./LostOrdersBulk";
import { LostOrderAction, RecoveryChip } from "./LostOrderParts";
import { useLostOrderLabels } from "./lostOrderLabels";
import { needsAttention, type LostOrderRowActions } from "./lostOrderModel";

const STRINGS = {
  en: {
    list: "Lost orders",
    select: "Select {name}",
    menu: "Actions for {name}",
    open: "Quick look: {name}, {amount}",
    toggle: "Select or let go of {name}",
  },
  ar: {
    list: "الطلبات المفقودة",
    select: "تحديد {name}",
    menu: "إجراءات {name}",
    open: "نظرة سريعة: {name}، {amount}",
    toggle: "تحديد {name} أو إلغاء تحديده",
  },
} satisfies Messages;

/**
 * The list on a phone: one card per lost order (the kit's ListRowCard).
 * First line — who, and what the basket is worth. Second — the recovery chip,
 * how long ago, and the row's ONE action. Third — why it was lost, in words,
 * and what is in the basket (at 390px the second line has no room for the
 * reason beside the action). A tap opens Quick Look; a long press, the
 * context menu. While «حدّد» is on, each card grows a tick box and a tap on
 * the card ticks it instead.
 */
export function LostOrderCards({
  rows,
  selection,
  selecting,
  actions,
}: {
  rows: readonly LostOrder[];
  selection: LostOrderSelection;
  /** The toolbar's «حدّد» is on: the cards show their tick boxes. */
  selecting: boolean;
  actions: LostOrderRowActions;
}) {
  const t = useT(STRINGS);
  return (
    <ul aria-label={t.list} data-slot="lost-cards" className="flex flex-col gap-2.5">
      {rows.map((session) => (
        <Card
          key={session.id}
          session={session}
          selected={selection.has(session.id)}
          onSelected={(on) => selection.toggle(session.id, on)}
          selecting={selecting}
          actions={actions}
        />
      ))}
    </ul>
  );
}

function Card({
  session,
  selected,
  onSelected,
  selecting,
  actions,
}: {
  session: LostOrder;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  selecting: boolean;
  actions: LostOrderRowActions;
}) {
  const t = useT(STRINGS);
  const labels = useLostOrderLabels();
  const name = labels.name(session);
  const amount = formatMoney(session.subtotalAmount, session.currency);
  const quiet = !needsAttention(session);
  const why = labels.why(session);
  const stage = labels.stage(session);
  const basket = labels.basket(session);
  const peekProps = useQuickLookRow(() => actions.peek(session));
  // A row still waiting for the merchant is written at full strength; the others step back.
  const strong = quiet ? "font-medium text-ink-soft" : undefined;

  return (
    <ContextMenu items={actions.menuFor(session)} label={fmt(t.menu, { name })}>
      <li>
        <ListRowCard
          className={cn("zimos-lost-card", quiet && "zimos-lost-quiet")}
          title={<bdi className={strong}>{name}</bdi>}
          amount={<bdi className={strong}>{amount}</bdi>}
          status={<RecoveryChip status={session.recoveryStatus} />}
          meta={
            <time dateTime={session.lastActivityAt} title={formatDateTime(session.lastActivityAt)}>
              {labels.ago(session.lastActivityAt)}
            </time>
          }
          action={<LostOrderAction session={session} actions={actions} />}
          footer={
            <>
              {(why || basket) && (
                <p className="w-full min-w-0 truncate text-xs leading-5 text-ink-soft">
                  {why && <span className={why.warn ? "font-medium text-accent-dark" : undefined}>{why.text}</span>}
                  {why && basket && " · "}
                  {basket && <bdi>{basket}</bdi>}
                </p>
              )}
              {stage && <StatusBadge value={session.status} tone="info" text={stage} />}
              {session.source === "funnel" && <StatusBadge value="funnel" tone="neutral" text={labels.source("funnel")} />}
            </>
          }
          selected={selected}
          onSelectedChange={selecting ? onSelected : undefined}
          selectLabel={fmt(t.select, { name })}
          openLabel={selecting ? fmt(t.toggle, { name }) : fmt(t.open, { name, amount })}
          onOpen={selecting ? () => onSelected(!selected) : () => actions.peek(session)}
          // Space peeks, as on a table row — except while selecting, where the card is a tick box.
          {...(selecting ? undefined : peekProps)}
        />
      </li>
    </ContextMenu>
  );
}
