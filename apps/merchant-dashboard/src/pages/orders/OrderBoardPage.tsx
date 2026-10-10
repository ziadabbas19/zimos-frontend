import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import {
  ordersChangeStatus,
  ordersNextStages,
  type Order,
  type OrderPipeline,
  type OrderStage,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconColumns, IconCopy, IconOrders, IconPhone, IconPlus, IconRefresh, IconSpinner, IconSwap, IconWhatsApp } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, type ChipItem } from "@/components/list";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { formatRelative } from "@/lib/orderTimeline";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { markViewSource, useViewNavigate } from "@/lib/viewTransition";
import { refreshWorkCounts } from "@/lib/workCounts";
import { useNow } from "@/pages/confirmation/confirmationRoles";
import { OrderQuickLook, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { moveNeedsDialog, movesBackQuietly } from "./detail/orderMoves";
import { OrderFlag, copyText, orderRowElement, useOrderRowViews, type OrderRowView } from "./list/orderRow";
import { useIsDesktop } from "./list/useIsDesktop";
import { useOrderErrorMessage } from "./orderErrors";
import { STAGE_TONE, useOrderLabels, type BadgeTone } from "./orderLabels";

const STRINGS = {
  en: {
    title: "Orders board",
    description: "Every order in its stage. Drag a card to another column, or press “Move”, to move it on.",
    back: "Orders",
    refresh: "Refresh",
    stagesLabel: "Jump to a stage",
    boardLabel: "Orders by stage",
    columnEmpty: "No orders here",
    columnFailed: "We couldn't load this column.",
    moreFailed: "We couldn't load more orders.",
    retry: "Try again",
    move: "Move",
    moveOrder: "Move order {number} to another stage",
    moveTitle: "Move order {number} to…",
    moveHint: "Pick the stage it goes to. If a move isn't allowed, we'll tell you why.",
    moveGroup: "Stages",
    moved: "{order} moved to “{stage}”.",
    menuLabel: "Actions for order {number}",
    menuOpen: "Open the order",
    menuCall: "Call",
    menuWhatsapp: "WhatsApp",
    menuCopyPhone: "Copy the number",
    menuCopyOrder: "Copy the order number",
    menuMove: "Move to…",
    copiedPhone: "The customer's number is copied",
    copiedOrder: "The order number is copied",
    copyFailed: "We couldn't copy that. Try again.",
    openOrder: "Open order {number}",
    emptyTitle: "No orders on the board",
    emptyBody: "Orders waiting for confirmation, shipping or delivery show up here, each in its stage.",
    emptyNoneTitle: "No orders yet",
    emptyNoneBody: "The board fills up as orders come in: each one in its stage, from confirmation to delivery.",
    newOrder: "New order",
    seeAll: "See all orders",
  },
  ar: {
    title: "لوحة الطلبات",
    description: "كل طلب في مرحلته. اسحب البطاقة إلى عمود آخر، أو اضغط «نقل»، لنقلها.",
    back: "الطلبات",
    refresh: "تحديث",
    stagesLabel: "الانتقال إلى مرحلة",
    boardLabel: "الطلبات حسب المرحلة",
    columnEmpty: "لا توجد طلبات هنا",
    columnFailed: "تعذّر تحميل هذا العمود.",
    moreFailed: "تعذّر جلب طلبات أخرى.",
    retry: "إعادة المحاولة",
    move: "نقل",
    moveOrder: "نقل الطلب {number} إلى مرحلة أخرى",
    moveTitle: "نقل الطلب {number} إلى…",
    moveHint: "اختر المرحلة التي ينتقل إليها. إذا لم تكن النقلة مسموحة فسنوضح السبب.",
    moveGroup: "المراحل",
    moved: "تم نقل {order} إلى «{stage}».",
    menuLabel: "إجراءات الطلب {number}",
    menuOpen: "فتح الطلب",
    menuCall: "اتصال",
    menuWhatsapp: "واتساب",
    menuCopyPhone: "نسخ الرقم",
    menuCopyOrder: "نسخ رقم الطلب",
    menuMove: "نقل إلى…",
    copiedPhone: "تم نسخ رقم العميل",
    copiedOrder: "تم نسخ رقم الطلب",
    copyFailed: "تعذّر النسخ. حاول مرة أخرى.",
    openOrder: "فتح الطلب {number}",
    emptyTitle: "لا توجد طلبات على اللوحة",
    emptyBody: "الطلبات التي تنتظر التأكيد أو الشحن أو التوصيل تظهر هنا، كل طلب في مرحلته.",
    emptyNoneTitle: "لا توجد طلبات بعد",
    emptyNoneBody: "عند وصول الطلبات ستجدها هنا، كل طلب في مرحلته من التأكيد حتى التسليم.",
    newOrder: "طلب جديد",
    seeAll: "عرض كل الطلبات",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

// The stages an order is worked through; cancelled and awaiting-payment orders stay in the list.
const COLUMNS = [
  "pending_confirmation",
  "needs_follow_up",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "returned",
] as const satisfies readonly OrderStage[];
type BoardStage = (typeof COLUMNS)[number];

const PAGE = 20;
const DRAG_TYPE = "application/x-zimos-order";
/** How long a jump to a column may take: the chips do not follow the columns passing by meanwhile. */
const JUMP_MS = 600;

function isBoardStage(value: string | null | undefined): value is BoardStage {
  return value != null && (COLUMNS as readonly string[]).includes(value);
}

interface ColumnState {
  orders: Order[];
  cursor: string | null;
  /** The first page is on its way and there is nothing to show yet. */
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
}
type Columns = Record<BoardStage, ColumnState>;

function emptyColumns(): Columns {
  const out = {} as Columns;
  for (const stage of COLUMNS) out[stage] = { orders: [], cursor: null, loading: true, loadingMore: false, error: null };
  return out;
}

/** Takes the order out of whatever column holds it and puts it in `to`, at `at` (the top by default). */
function placeOrder(columns: Columns, order: Order, to: BoardStage, at = 0): Columns {
  const next = { ...columns };
  for (const stage of COLUMNS) {
    if (next[stage].orders.some((o) => o.id === order.id)) {
      next[stage] = { ...next[stage], orders: next[stage].orders.filter((o) => o.id !== order.id) };
    }
  }
  const orders = [...next[to].orders];
  orders.splice(Math.min(Math.max(at, 0), orders.length), 0, order);
  next[to] = { ...next[to], orders };
  return next;
}

/** The server's version of an order, where the card already is; at the top of `stage` when it is not there. */
function settleOrder(columns: Columns, order: Order, stage: BoardStage): Columns {
  const at = columns[stage].orders.findIndex((o) => o.id === order.id);
  return placeOrder(columns, order, stage, at < 0 ? 0 : at);
}

function dropOrder(columns: Columns, orderId: string): Columns {
  const next = { ...columns };
  for (const stage of COLUMNS) {
    if (next[stage].orders.some((o) => o.id === orderId)) {
      next[stage] = { ...next[stage], orders: next[stage].orders.filter((o) => o.id !== orderId) };
    }
  }
  return next;
}

// A stage's dot, in the colours of its chip everywhere else (components/StatusBadge.tsx).
const DOT: Record<BadgeTone, string> = {
  neutral: "bg-ink-soft",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-accent",
  danger: "bg-danger",
};

const CHIP_TONE: Partial<Record<BoardStage, ChipItem<BoardStage>["tone"]>> = {
  pending_confirmation: "attention",
  needs_follow_up: "attention",
  delivery_failed: "danger",
};

const FINE_POINTER = "(pointer: fine)";
function subscribeFinePointer(onChange: () => void): () => void {
  const query = window.matchMedia?.(FINE_POINTER);
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function hasFinePointer(): boolean {
  return window.matchMedia?.(FINE_POINTER).matches === true;
}

function isRtl(element: Element): boolean {
  return window.getComputedStyle(element).direction === "rtl";
}

/**
 * The orders pipeline as a board (SPEC §4.3 "Pipeline page"): each column
 * pages its own stage from GET /orders?stage= with the cursor, and a move —
 * dragged with a mouse, or picked from «انقل» on the card (and its menu) — is
 * PATCH /orders/:id/status, so the server's stage rules decide what is
 * allowed.
 *
 * The columns scroll sideways inside their own box and snap; the chips over
 * them jump to a column and say how many orders it holds. A card is the
 * orders list's phone card: a tap opens Quick Look, Enter the order. A move
 * shows at once — the card is already in its new column while the request is
 * out — goes back if the server says no, and offers Undo when the way back is
 * as plain as the way there.
 */
export function OrderBoardPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const labels = useOrderLabels();
  const errorMessage = useOrderErrorMessage();
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  // Dragging is the mouse's way; under a finger a long press is the card's menu, so the card is not draggable there.
  const canDrag = useSyncExternalStore(subscribeFinePointer, hasFinePointer, () => true);
  const now = useNow(60_000);

  const counts = useAsync<OrderPipeline>(() => apiClient.getOrderPipeline(workspaceId), [workspaceId]);
  const [columns, setColumns] = useState<Columns>(emptyColumns);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  // The newest request of each column: an older answer is dropped.
  const calls = useRef<Partial<Record<BoardStage, number>>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState<ReadonlySet<string>>(() => new Set<string>());
  const movingRef = useRef(moving);
  movingRef.current = moving;
  // The card that has just landed in a column: it settles in, and its column shows it.
  const [arrived, setArrived] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ order: Order; open: boolean } | null>(null);
  const [asking, setAsking] = useState<{ order: Order; open: boolean } | null>(null);

  const load = useCallback(
    async (stage: BoardStage, opts: { after?: string | null; silent?: boolean } = {}) => {
      const id = (calls.current[stage] ?? 0) + 1;
      calls.current[stage] = id;
      const after = opts.after ?? null;
      setColumns((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], loading: !after && !opts.silent, loadingMore: Boolean(after), error: null },
      }));
      try {
        const page = await apiClient.listOrders(workspaceId, { stage, limit: PAGE, ...(after ? { cursor: after } : {}) });
        if (calls.current[stage] !== id) return;
        setColumns((prev) => {
          const have = new Set(prev[stage].orders.map((o) => o.id));
          const orders = after ? [...prev[stage].orders, ...page.orders.filter((o) => !have.has(o.id))] : page.orders;
          return { ...prev, [stage]: { orders, cursor: page.nextCursor, loading: false, loadingMore: false, error: null } };
        });
      } catch (err) {
        if (calls.current[stage] !== id) return;
        setColumns((prev) => ({ ...prev, [stage]: { ...prev[stage], loading: false, loadingMore: false, error: err } }));
      }
    },
    [workspaceId]
  );

  // Another store is another board.
  useEffect(() => {
    setColumns(emptyColumns());
    for (const stage of COLUMNS) void load(stage);
  }, [load]);

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        counts.refresh({ silent: true }),
        // What is on screen stays there while it is read again; an empty column shows its placeholder.
        ...COLUMNS.map((stage) => load(stage, { silent: columnsRef.current[stage].orders.length > 0 })),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function shiftCount(from: BoardStage, to: BoardStage) {
    const snapshot = counts.data;
    if (!snapshot) return;
    counts.setData((prev) => {
      const base = prev ?? snapshot;
      return {
        ...base,
        stages: { ...base.stages, [from]: Math.max(0, (base.stages[from] ?? 0) - 1), [to]: (base.stages[to] ?? 0) + 1 },
      };
    });
  }

  function setBusy(orderId: string, busy: boolean) {
    setMoving((prev) => {
      const next = new Set(prev);
      if (busy) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }

  async function move(order: Order, to: BoardStage) {
    const from = order.stage;
    if (!isBoardStage(from) || to === from || movingRef.current.has(order.id)) return;
    const index = columnsRef.current[from].orders.findIndex((o) => o.id === order.id);
    setBusy(order.id, true);
    // At once: the card is in its new column before the server answers.
    setColumns((prev) => placeOrder(prev, { ...order, stage: to }, to));
    shiftCount(from, to);
    setArrived(order.id);
    try {
      // Status alone, as before: the store's own rules and settings decide the rest.
      const updated = await ordersChangeStatus(apiClient, workspaceId, order.id, { status: to });
      // The list's own fields (what a row shows) stay where the answer does not carry them.
      const settled: Order = { ...order, ...updated };
      const landed = updated.stage ?? to;
      setColumns((prev) => (isBoardStage(landed) ? settleOrder(prev, { ...settled, stage: landed }, landed) : dropOrder(prev, order.id)));
      void counts.refresh({ silent: true });
      refreshWorkCounts();
      const message = fmt(t.moved, { order: order.orderNumber, stage: labels.stage(landed) });
      // Undo only where the way back is as plain as the way here, and tells the customer nothing.
      if (ordersNextStages(updated).includes(from) && !moveNeedsDialog(updated, from) && movesBackQuietly(from)) {
        toast.undo(message, async () => {
          const back = await ordersChangeStatus(apiClient, workspaceId, order.id, { status: from });
          setColumns((prev) => placeOrder(prev, { ...settled, ...back, stage: from }, from, index));
          void counts.refresh({ silent: true });
          refreshWorkCounts();
        });
      } else {
        toast.success(message);
      }
    } catch (err) {
      // The server said no: the card goes back where it was.
      setColumns((prev) => placeOrder(prev, order, from, index));
      shiftCount(to, from);
      setArrived(null);
      toast.error(errorMessage(err));
    } finally {
      setBusy(order.id, false);
    }
  }

  function findOrder(orderId: string): Order | null {
    for (const stage of COLUMNS) {
      const hit = columnsRef.current[stage].orders.find((o) => o.id === orderId);
      if (hit) return hit;
    }
    return null;
  }

  // ---- Quick Look, the order's page, the move sheet ----
  const peekOrder = (view: OrderRowView) => {
    markViewSource(orderRowElement(view.order.id));
    setPeek({ order: view.order, open: true });
  };
  const openOrder = (view: OrderRowView) => {
    markViewSource(orderRowElement(view.order.id));
    navigate(view.to);
  };
  const setPeekOpen = (open: boolean) => {
    setPeek((current) => (current ? { ...current, open } : current));
    if (open) return;
    // Closed without going to the order: the card is no longer the source of anything.
    window.setTimeout(() => {
      if (!("vt" in document.documentElement.dataset)) markViewSource(null);
    }, 0);
  };
  const askMove = (order: Order) => {
    // Two sheets are never stacked: Quick Look steps aside for the question.
    setPeek((current) => (current ? { ...current, open: false } : current));
    setAsking({ order, open: true });
  };
  const peeked = peek ? (findOrder(peek.order.id) ?? peek.order) : null;

  const copy = async (value: string, done: string) => {
    if (await copyText(value)) toast.success(done);
    else toast.error(t.copyFailed);
  };

  function menuFor(view: OrderRowView): ContextMenuItem[] {
    const { order, phone, whatsapp } = view;
    const items: ContextMenuItem[] = [{ id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => openOrder(view) }];
    if (phone) {
      items.push({
        id: "call",
        label: t.menuCall,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = orderTelHref(phone);
        },
      });
    }
    if (whatsapp) {
      items.push({
        id: "whatsapp",
        label: t.menuWhatsapp,
        icon: IconWhatsApp,
        separatorBefore: !phone,
        onSelect: () => {
          window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
        },
      });
    }
    if (phone) {
      items.push({ id: "copy-phone", label: t.menuCopyPhone, icon: IconCopy, separatorBefore: true, onSelect: () => void copy(phone, t.copiedPhone) });
    }
    items.push({
      id: "copy-order",
      label: t.menuCopyOrder,
      icon: IconCopy,
      separatorBefore: !phone,
      onSelect: () => void copy(order.orderNumber, t.copiedOrder),
    });
    items.push({
      id: "move",
      label: t.menuMove,
      icon: IconSwap,
      separatorBefore: true,
      disabled: moving.has(order.id),
      onSelect: () => askMove(order),
    });
    return items;
  }

  // ---- the chips: which column is at the start of the box, and jumping to one ----
  const boardRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<BoardStage>(COLUMNS[0]);
  const jumpUntil = useRef(0);
  // The column a chip asked for stays the chosen one while it is wholly in view (the last columns never reach the start edge).
  const pinned = useRef<BoardStage | null>(null);

  const syncActive = useCallback(() => {
    const board = boardRef.current;
    if (!board || performance.now() < jumpUntil.current) return;
    const box = board.getBoundingClientRect();
    if (box.width === 0) return;
    const rtl = isRtl(board);
    const edge = rtl ? box.right : box.left;
    let best: BoardStage | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const column of Array.from(board.querySelectorAll<HTMLElement>("[data-board-column]"))) {
      const stage = column.dataset.boardColumn;
      if (!isBoardStage(stage)) continue;
      const rect = column.getBoundingClientRect();
      if (stage === pinned.current) {
        if (rect.left >= box.left - 2 && rect.right <= box.right + 2) {
          setActive(stage);
          return;
        }
        pinned.current = null;
      }
      const gap = Math.abs((rtl ? rect.right : rect.left) - edge);
      if (gap < bestGap) {
        bestGap = gap;
        best = stage;
      }
    }
    if (best) setActive(best);
  }, []);

  function jumpTo(stage: BoardStage) {
    const board = boardRef.current;
    const column = board?.querySelector<HTMLElement>(`[data-board-column="${stage}"]`);
    setActive(stage);
    if (!board || !column) return;
    const box = board.getBoundingClientRect();
    const rect = column.getBoundingClientRect();
    const style = window.getComputedStyle(board);
    const rtl = style.direction === "rtl";
    const pad = Number.parseFloat(style.paddingInlineStart) || 0;
    // Physical pixels: the box moves by how far the column's start edge is from its own.
    const by = rtl ? rect.right - (box.right - pad) : rect.left - (box.left + pad);
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    pinned.current = stage;
    jumpUntil.current = performance.now() + (calm ? 0 : JUMP_MS);
    if (Math.abs(by) >= 1) board.scrollBy({ left: by, behavior: calm ? "auto" : "smooth" });
  }

  const boardTotal = counts.data ? COLUMNS.reduce((sum, stage) => sum + (counts.data?.stages[stage] ?? 0), 0) : null;
  const allRead = COLUMNS.every((stage) => !columns[stage].loading);
  const nothingOnBoard = boardTotal === 0 && allRead && COLUMNS.every((stage) => columns[stage].orders.length === 0 && columns[stage].error == null);

  // The board's box is in the page only while there is something to lay out in it: listen to whichever box is there now.
  const boardShown = !nothingOnBoard && !(counts.data === null && counts.error != null);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncActive);
    };
    board.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      board.removeEventListener("scroll", onScroll);
    };
  }, [syncActive, boardShown]);

  const chips = COLUMNS.map((stage): ChipItem<BoardStage> => ({
    value: stage,
    label: labels.stage(stage),
    count: counts.data ? (counts.data.stages[stage] ?? 0) : null,
    tone: CHIP_TONE[stage],
  }));

  const pill = "min-h-11 rounded-full px-5";

  return (
    <div>
      <PageHeader
        title={t.title}
        // A phone keeps the first screen for the board: the sentence is for wider screens.
        description={desktop ? t.description : undefined}
        back={{ to: "/orders", label: t.back }}
        actions={
          <Button
            type="button"
            variant="outline"
            aria-label={t.refresh}
            title={t.refresh}
            aria-busy={refreshing || undefined}
            onClick={() => void refreshAll()}
            className="size-11 rounded-full p-0 md:w-auto md:gap-2 md:ps-3.5 md:pe-4"
          >
            {refreshing ? (
              <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <IconRefresh className="size-5" aria-hidden />
            )}
            <span className="hidden md:inline">{t.refresh}</span>
          </Button>
        }
      />

      <DataState loading={false} error={counts.data ? null : counts.error} onRetry={() => void refreshAll()}>
        {nothingOnBoard ? (
          <EmptyState
            icon={<IconColumns aria-hidden />}
            title={counts.data?.total === 0 ? t.emptyNoneTitle : t.emptyTitle}
            description={counts.data?.total === 0 ? t.emptyNoneBody : t.emptyBody}
            action={
              counts.data?.total === 0 ? (
                <Button asChild className={pill}>
                  <Link to="/orders/new">
                    <IconPlus className="size-4" aria-hidden />
                    {t.newOrder}
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className={pill}>
                  <Link to="/orders">{t.seeAll}</Link>
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <ChipRow
              items={chips}
              value={active}
              onChange={jumpTo}
              label={t.stagesLabel}
              collapseEmpty={false}
              countsLoading={counts.loading && !counts.data}
            />

            {/* The board scrolls inside its own box: the page never moves sideways. On a phone it runs to the
                screen's edges and each column snaps into place, the next one peeking in. */}
            <div
              ref={boardRef}
              role="group"
              aria-label={t.boardLabel}
              data-slot="order-board"
              className="zimos-board -my-2 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain py-2 [scrollbar-width:thin] max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 sm:-mx-1 sm:scroll-px-1 sm:px-1 md:snap-proximity"
            >
              {COLUMNS.map((stage) => (
                <BoardColumn
                  key={stage}
                  stage={stage}
                  state={columns[stage]}
                  count={counts.data ? (counts.data.stages[stage] ?? 0) : null}
                  moving={moving}
                  arrived={arrived}
                  dragging={dragging}
                  canDrag={canDrag}
                  now={now}
                  t={t}
                  menuFor={menuFor}
                  onPeek={peekOrder}
                  onOpen={openOrder}
                  onAskMove={askMove}
                  onDragState={setDragging}
                  onDropOrder={(orderId) => {
                    const order = findOrder(orderId);
                    if (order) void move(order, stage);
                  }}
                  onRetry={() => void load(stage)}
                  onMore={() => void load(stage, { after: columns[stage].cursor })}
                />
              ))}
            </div>
          </div>
        )}
      </DataState>

      <OrderQuickLook order={peeked} open={Boolean(peek?.open)} onOpenChange={setPeekOpen} />

      <MoveSheet
        order={asking?.order ?? null}
        open={Boolean(asking?.open)}
        counts={counts.data}
        onClose={() => setAsking((current) => (current ? { ...current, open: false } : current))}
        onPick={(order, stage) => {
          setAsking((current) => (current ? { ...current, open: false } : current));
          // The card as the board holds it now (a move made meanwhile is not undone by an old copy).
          void move(findOrder(order.id) ?? order, stage);
        }}
      />
    </div>
  );
}

function BoardColumn({
  stage,
  state,
  count,
  moving,
  arrived,
  dragging,
  canDrag,
  now,
  t,
  menuFor,
  onPeek,
  onOpen,
  onAskMove,
  onDragState,
  onDropOrder,
  onRetry,
  onMore,
}: {
  stage: BoardStage;
  state: ColumnState;
  /** Null while the counts are on their way. */
  count: number | null;
  moving: ReadonlySet<string>;
  arrived: string | null;
  dragging: string | null;
  canDrag: boolean;
  now: number;
  t: Strings;
  menuFor: (view: OrderRowView) => ContextMenuItem[];
  onPeek: (view: OrderRowView) => void;
  onOpen: (view: OrderRowView) => void;
  onAskMove: (order: Order) => void;
  onDragState: (orderId: string | null) => void;
  onDropOrder: (orderId: string) => void;
  onRetry: () => void;
  onMore: () => void;
}) {
  const labels = useOrderLabels();
  const views = useOrderRowViews(state.orders);
  const [over, setOver] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingId = `board-column-${stage}`;

  // A card that has just landed sits at the top: bring the top of the column back into view.
  const first = state.orders[0]?.id;
  useEffect(() => {
    if (arrived && first === arrived) bodyRef.current?.scrollTo({ top: 0 });
  }, [arrived, first]);

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(false);
    const orderId = event.dataTransfer.getData(DRAG_TYPE);
    if (orderId) onDropOrder(orderId);
  }

  return (
    <section
      aria-labelledby={headingId}
      data-board-column={stage}
      data-over={over ? "" : undefined}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(event) => {
        // Leaving for a card inside the column is not leaving the column.
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setOver(false);
      }}
      onDrop={onDrop}
      className={cn(
        "zimos-board-col flex w-[min(20rem,calc(100vw_-_3.5rem))] shrink-0 snap-start flex-col rounded-[1.5rem] bg-paper-sunken ring-1 ring-line",
        "transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        over && "bg-primary-soft ring-2 ring-primary"
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 px-4">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[STAGE_TONE[stage]])} />
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {labels.stage(stage)}
        </h2>
        {count !== null && (
          <span className="zimos-chip-count inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-paper-raised px-1.5 text-xs leading-none font-semibold text-ink-soft tabular-nums">
            {fmt("{n}", { n: count })}
          </span>
        )}
      </header>

      {/* Each column keeps its own place: it scrolls inside itself, and the page under it stays put. */}
      <div
        ref={bodyRef}
        className="zimos-board-body max-h-[max(18rem,calc(100dvh_-_23.5rem))] min-h-24 overflow-y-auto px-2 pb-2 [scrollbar-width:thin] md:max-h-[max(18rem,calc(100dvh_-_22rem))]"
      >
        {state.loading ? (
          <ListSkeleton variant="card" rows={3} />
        ) : state.error != null && state.orders.length === 0 ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-ink-soft">
            <p>{t.columnFailed}</p>
            <Button type="button" size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={onRetry}>
              {t.retry}
            </Button>
          </div>
        ) : state.orders.length === 0 ? (
          <p className="zimos-board-empty rounded-[1.25rem] border border-dashed border-line px-3 py-8 text-center text-sm text-ink-soft">{t.columnEmpty}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {views.map((view) => {
                const { order } = view;
                const busy = moving.has(order.id);
                return (
                  <li
                    key={order.id}
                    data-order-row={order.id}
                    draggable={canDrag && !busy}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_TYPE, order.id);
                      event.dataTransfer.effectAllowed = "move";
                      onDragState(order.id);
                    }}
                    onDragEnd={() => onDragState(null)}
                    aria-busy={busy || undefined}
                    className={cn(
                      "rounded-[1.25rem] transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                      canDrag && !busy && "cursor-grab active:cursor-grabbing",
                      (busy || dragging === order.id) && "opacity-60",
                      arrived === order.id && "motion-safe:animate-[page-in_220ms_var(--ease-out)_backwards]"
                    )}
                  >
                    <ContextMenu items={menuFor(view)} label={fmt(t.menuLabel, { number: order.orderNumber })}>
                      <ListRowCard
                        title={
                          <span data-vt-part="title">
                            <bdi>{view.name}</bdi>
                          </span>
                        }
                        amount={
                          <span data-vt-part="amount" className="inline-block">
                            <bdi>{view.money}</bdi>
                          </span>
                        }
                        meta={
                          // The number and the age never give way; the place takes what is left beside the button.
                          <span className="flex min-w-0 items-center gap-1.5">
                            <ViewLink
                              to={view.to}
                              draggable={false}
                              aria-label={fmt(t.openOrder, { number: order.orderNumber })}
                              onClick={() => markViewSource(orderRowElement(order.id))}
                              className="shrink-0 rounded-sm font-medium text-ink tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <bdi dir="ltr">{order.orderNumber}</bdi>
                            </ViewLink>
                            {view.place && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="min-w-0 truncate">{view.place}</span>
                              </>
                            )}
                            <span aria-hidden>·</span>
                            <time dateTime={order.createdAt} title={formatDateTime(order.createdAt)} className="shrink-0">
                              {formatRelative(order.createdAt, now, getIntlLocale())}
                            </time>
                          </span>
                        }
                        // The one action of a card on a board: move it.
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            data-tone="quiet"
                            aria-haspopup="dialog"
                            aria-label={fmt(t.moveOrder, { number: order.orderNumber })}
                            aria-busy={busy || undefined}
                            disabled={busy}
                            onClick={() => onAskMove(order)}
                            className="zimos-row-action h-11 gap-1.5 rounded-full px-3.5 text-[13px] pointer-fine:h-9 pointer-fine:px-3"
                          >
                            {busy ? (
                              <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                            ) : (
                              <IconSwap className="size-4" aria-hidden />
                            )}
                            <span>{t.move}</span>
                          </Button>
                        }
                        footer={view.flags.length > 0 ? view.flags.slice(0, 2).map((flag) => <OrderFlag key={flag.id} flag={flag} />) : undefined}
                        onOpen={() => onPeek(view)}
                        aria-haspopup="dialog"
                        onKeyDown={(event) => {
                          // Space peeks (the card's own key); Enter, on the card itself, opens the order's page.
                          if (event.key !== "Enter" || event.target !== event.currentTarget) return;
                          if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
                          event.preventDefault();
                          onOpen(view);
                        }}
                      />
                    </ContextMenu>
                  </li>
                );
              })}
            </ul>
            {state.error != null && (
              <p role="alert" className="flex flex-wrap items-center justify-center gap-2 pt-3 text-center text-sm text-danger">
                {t.moreFailed}
                <Button type="button" size="sm" variant="outline" className="min-h-11 rounded-full px-4" onClick={onMore}>
                  {t.retry}
                </Button>
              </p>
            )}
            <LoadMore hasMore={Boolean(state.cursor)} loading={state.loadingMore} onClick={onMore} />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * «انقل لـ…»: the way to move a card without dragging it — under a finger the
 * only one. Every other column is offered, as the old menu of the card did;
 * the server's stage rules answer a move that is not allowed.
 */
function MoveSheet({
  order,
  open,
  counts,
  onClose,
  onPick,
}: {
  /** Kept while the sheet closes, so its title does not empty on the way out. */
  order: Order | null;
  open: boolean;
  counts: OrderPipeline | null;
  onClose: () => void;
  onPick: (order: Order, stage: BoardStage) => void;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const targets = COLUMNS.filter((stage) => stage !== order?.stage);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={fmt(t.moveTitle, { number: order?.orderNumber ?? "" })}
      description={t.moveHint}
      size="sm"
    >
      <ul aria-label={t.moveGroup} className="flex flex-col gap-1">
        {targets.map((stage) => (
          <li key={stage}>
            <button
              type="button"
              onClick={() => {
                if (order) onPick(order, stage);
              }}
              className="zimos-board-stage flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 text-start text-[15px] font-medium text-ink transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary active:bg-paper-sunken motion-safe:active:scale-[0.98] motion-reduce:transition-none"
            >
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", DOT[STAGE_TONE[stage]])} />
              <span className="min-w-0 flex-1 truncate">{labels.stage(stage)}</span>
              {counts && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{fmt("{n}", { n: counts.stages[stage] ?? 0 })}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
