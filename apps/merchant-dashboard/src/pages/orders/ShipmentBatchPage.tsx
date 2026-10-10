import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  shipmentBatchGet,
  shipmentBatchRetry,
  type ShipmentBatch,
  type ShipmentBatchAddresses,
  type ShipmentBatchItem,
} from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { CardSkeleton, DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconCourier, IconMapPinned, IconOrders, IconSearch, IconSend, IconSpinner, IconSuccess, IconWarning } from "@/components/icons";
import { ChipRow, ListRowCard, ListSkeleton, ListToolbar, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { CourierPlacePicker } from "@/pages/shipping/CourierPlacePicker";
import { copyText } from "./list/orderRow";
import { useIsDesktop } from "./list/useIsDesktop";
import { useOrderErrorMessage } from "./orderErrors";
import { MeterBar } from "./packing/packingBits";

const STRINGS = {
  en: {
    title: "Shipping with {name}",
    titlePlain: "Courier booking",
    back: "Orders",
    queued: "Waiting to start…",
    running: "Booking orders one by one…",
    doneAll: "Finished. Every order is booked.",
    doneSome: "Finished. Still without a booking: {count}.",
    progress: "{done} of {total}",
    figBooked: "Booked",
    figFailed: "Not booked",
    figWaiting: "Waiting",
    notes: "Notes for the courier: {notes}",
    retryHint: "Nothing is sent again on its own. Fix the reason (an area, a confirmation) and send the orders that weren't booked again.",
    retry: "Send {count} again",
    retrying: "Sending…",
    retried: "Sending {count} to {name} again.",
    chipsLabel: "Orders of this booking by result",
    chipAll: "All",
    searchLabel: "Search this booking",
    searchPlaceholder: "Order number or waybill",
    listLabel: "Orders of this booking",
    colOrder: "Order",
    colStatus: "Status",
    colWaybill: "Waybill",
    colReason: "Reason",
    colAction: "Next step",
    s_pending: "Waiting",
    s_booking: "Booking",
    s_booked: "Booked",
    s_failed: "Not booked",
    waybill: "Waybill",
    openOrder: "Open order {number}",
    choose: "Choose area",
    change: "Change area",
    placeChosen: "Goes to {place}",
    fixTitle: "Area for order {number}",
    fixHint: "Pick the area from {name}'s own list. It is used when you send the order again.",
    useArea: "Use this area",
    menuLabel: "Actions for order {number}",
    menuOpen: "Open the order",
    menuCopyOrder: "Copy the order number",
    menuCopyWaybill: "Copy the waybill number",
    copiedOrder: "The order number is copied",
    copiedWaybill: "The waybill number is copied",
    copyFailed: "We couldn't copy that. Try again.",
    emptyTitle: "No orders in this booking",
    emptyBody: "Tick orders in the orders list and press “Book the courier” to send them to a courier together.",
    emptyAction: "Go to orders",
    emptyFiltered: "No orders here",
    emptySearch: "No order matches this search",
    showAll: "Show all orders",
  },
  ar: {
    title: "الشحن مع {name}",
    titlePlain: "حجز شركة الشحن",
    back: "الطلبات",
    queued: "في انتظار البدء…",
    running: "جارٍ حجز الطلبات واحدًا تلو الآخر…",
    doneAll: "انتهى. تم حجز كل الطلبات.",
    doneSome: "انتهى. ما زال بدون حجز: {count}.",
    progress: "{done} من {total}",
    figBooked: "تم الحجز",
    figFailed: "لم يُحجز",
    figWaiting: "في الانتظار",
    notes: "ملاحظات للمندوب: {notes}",
    retryHint: "لا يُعاد إرسال أي طلب تلقائيًا. أصلح السبب (المنطقة، التأكيد) ثم أعد إرسال الطلبات التي لم تُحجز.",
    retry: "إعادة إرسال {count}",
    retrying: "جارٍ الإرسال…",
    retried: "جارٍ إعادة إرسال {count} إلى {name}.",
    chipsLabel: "طلبات هذا الحجز حسب النتيجة",
    chipAll: "الكل",
    searchLabel: "ابحث في هذا الحجز",
    searchPlaceholder: "رقم الطلب أو البوليصة",
    listLabel: "طلبات هذا الحجز",
    colOrder: "الطلب",
    colStatus: "الحالة",
    colWaybill: "رقم البوليصة",
    colReason: "السبب",
    colAction: "الخطوة التالية",
    s_pending: "في الانتظار",
    s_booking: "جارٍ الحجز",
    s_booked: "تم الحجز",
    s_failed: "لم يُحجز",
    waybill: "رقم البوليصة",
    openOrder: "فتح الطلب {number}",
    choose: "اختيار المنطقة",
    change: "تغيير المنطقة",
    placeChosen: "سيُشحن إلى {place}",
    fixTitle: "منطقة الطلب {number}",
    fixHint: "اختر المنطقة من قائمة {name} نفسها. ستُستخدم عند إعادة إرسال الطلب.",
    useArea: "استخدام هذه المنطقة",
    menuLabel: "إجراءات الطلب {number}",
    menuOpen: "فتح الطلب",
    menuCopyOrder: "نسخ رقم الطلب",
    menuCopyWaybill: "نسخ رقم البوليصة",
    copiedOrder: "تم نسخ رقم الطلب",
    copiedWaybill: "تم نسخ رقم البوليصة",
    copyFailed: "تعذّر النسخ. حاول مرة أخرى.",
    emptyTitle: "لا توجد طلبات في هذا الحجز",
    emptyBody: "حدّد الطلبات في قائمة الطلبات ثم اضغط «حجز المندوب» لإرسالها إلى شركة الشحن دفعة واحدة.",
    emptyAction: "الانتقال إلى الطلبات",
    emptyFiltered: "لا توجد طلبات هنا",
    emptySearch: "لا يوجد طلب مطابق لهذا البحث",
    showAll: "عرض كل الطلبات",
  },
} satisfies Messages;

const TONE: Record<ShipmentBatchItem["status"], "neutral" | "info" | "success" | "danger"> = {
  pending: "neutral",
  booking: "info",
  booked: "success",
  failed: "danger",
};

/** What the chips sort the orders of a booking by. "waiting" is both still to start and being booked right now. */
type Filter = "all" | "failed" | "booked" | "waiting";

function inFilter(item: ShipmentBatchItem, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "waiting") return item.status === "pending" || item.status === "booking";
  return item.status === filter;
}

/** Lower case, and Arabic-Indic digits as Latin ones: «١٠٢٤» finds #1024. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** The columns of the sheet from md up: the order, where it stands, its waybill, why it failed, what to do. */
const COLUMNS = "grid-cols-[minmax(0,0.8fr)_max-content_minmax(0,0.9fr)_minmax(0,1.8fr)_max-content]";

/** Above this many orders a search earns its line. */
const SEARCH_FROM = 10;

/**
 * One "Ship selected" batch: live progress, each order's result, and sending
 * the failed ones again.
 *
 * Top to bottom: how far the booking is (one bar, three figures), then the
 * orders — cards on a phone, a sheet of rows from md up — sorted by result
 * with the chips. An order the courier could not place gets «اختار المنطقة»,
 * which opens the courier's own list in a sheet; «ابعت … تاني» (the header's
 * one action, above the dock on a phone) then sends every order that was not
 * booked, with the areas chosen.
 */
export function ShipmentBatchPage() {
  const t = useT(STRINGS);
  const { batchId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const navigate = useViewNavigate();
  const desktop = useIsDesktop();
  const batch = useAsync(() => shipmentBatchGet(apiClient, workspaceId, batchId), [workspaceId, batchId]);
  const carriers = useAsync(() => apiClient.listCarriers(workspaceId), [workspaceId]);
  const [addresses, setAddresses] = useState<ShipmentBatchAddresses>({});
  const [places, setPlaces] = useState<Record<string, string>>({});
  // The order whose area is being chosen; it stays here while the sheet closes, so the sheet does not empty on its way out.
  const [fixing, setFixing] = useState<{ orderId: string; open: boolean } | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const data = batch.data;
  const running = data ? data.status !== "done" : false;
  const { refresh } = batch;
  // Live while the queue works on it.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void refresh({ silent: true }), 2000);
    return () => window.clearInterval(id);
  }, [running, refresh]);

  const courier = carriers.data?.carriers.find((c) => c.code === data?.carrierCode);
  const name = courier?.name ?? data?.carrierCode ?? "";
  const levelsKey = (courier?.capabilities?.addressLevels ?? []).join(">");
  const levels = useMemo(() => (levelsKey ? levelsKey.split(">") : []), [levelsKey]);
  const items = useMemo(() => data?.items ?? [], [data]);
  const failed = items.filter((i) => i.status === "failed");
  const done = data?.status === "done";

  async function retry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await shipmentBatchRetry(apiClient, workspaceId, batchId, { addresses });
      toast.success(fmt(t.retried, { count: countOf("order", failed.length), name }));
      setAddresses({});
      setPlaces({});
      await batch.refresh({ silent: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const copy = async (value: string, said: string) => {
    if (await copyText(value)) toast.success(said);
    else toast.error(t.copyFailed);
  };

  const closeFix = () => setFixing((current) => (current ? { ...current, open: false } : current));
  const openFix = (orderId: string) => {
    setPickerError(null);
    setFixing({ orderId, open: true });
  };
  const fixedItem = fixing ? (items.find((i) => i.orderId === fixing.orderId) ?? null) : null;

  const query = fold(search.trim());
  const visible = items.filter(
    (item) =>
      inFilter(item, filter) &&
      (!query || [item.orderNumber, item.waybillNumber].some((part) => part && fold(part).includes(query)))
  );

  const chips: ChipItem<Filter>[] = [
    { value: "all", label: t.chipAll, count: data?.counts.total ?? null },
    { value: "failed", label: t.s_failed, count: data?.counts.failed ?? null, tone: "danger" },
    { value: "booked", label: t.s_booked, count: data?.counts.booked ?? null, tone: "success" },
    { value: "waiting", label: t.s_pending, count: data?.counts.pending ?? null },
  ];

  const numberOf = (item: ShipmentBatchItem) => item.orderNumber ?? item.orderId;
  const reasonOf = (item: ShipmentBatchItem) =>
    item.status === "failed" ? errorMessage({ code: item.errorCode ?? "", message: item.errorMessage ?? "" }) : "";
  // An order the courier could not place can be given an area from the courier's own list, once the queue is done with it.
  const fixable = (item: ShipmentBatchItem) =>
    item.status === "failed" && item.errorCode === "CARRIER_ADDRESS_UNMATCHED" && done && levels.length > 0;

  function menuFor(item: ShipmentBatchItem): ContextMenuItem[] {
    const menu: ContextMenuItem[] = [
      { id: "open", label: t.menuOpen, icon: IconOrders, onSelect: () => navigate(`/orders/${item.orderId}`) },
      { id: "copy-order", label: t.menuCopyOrder, icon: IconCopy, separatorBefore: true, onSelect: () => void copy(numberOf(item), t.copiedOrder) },
    ];
    const waybill = item.waybillNumber;
    if (waybill) menu.push({ id: "copy-waybill", label: t.menuCopyWaybill, icon: IconCopy, onSelect: () => void copy(waybill, t.copiedWaybill) });
    if (fixable(item)) {
      menu.push({
        id: "area",
        label: places[item.orderId] ? t.change : t.choose,
        icon: IconMapPinned,
        separatorBefore: true,
        onSelect: () => openFix(item.orderId),
      });
    }
    return menu;
  }

  function areaButton(item: ShipmentBatchItem) {
    if (!fixable(item)) return null;
    return (
      <Button
        type="button"
        variant="outline"
        data-tone="quiet"
        aria-haspopup="dialog"
        onClick={() => openFix(item.orderId)}
        className="zimos-row-action h-11 max-w-full gap-1.5 rounded-full px-4 text-[13px] pointer-fine:h-9 pointer-fine:px-3.5"
      >
        <IconMapPinned className="size-4" aria-hidden />
        <span className="min-w-0 truncate">{places[item.orderId] ? t.change : t.choose}</span>
      </Button>
    );
  }

  const badge = (item: ShipmentBatchItem) => <StatusBadge value={item.status} tone={TONE[item.status]} text={t[`s_${item.status}`]} />;
  const placeLine = (item: ShipmentBatchItem) =>
    places[item.orderId] ? (
      <p className="text-xs leading-5 font-medium text-success">
        {/* The place is the courier's own wording, in whatever language its list is written. */}
        {fmt(t.placeChosen, { place: places[item.orderId] })}
      </p>
    ) : null;

  const retryAction =
    done && failed.length > 0 ? (
      <Button className="min-h-11 rounded-full px-5" onClick={() => void retry()} disabled={busy} aria-busy={busy || undefined}>
        {busy ? (
          <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconSend className="size-4 rtl:-scale-x-100" aria-hidden />
        )}
        {busy ? t.retrying : fmt(t.retry, { count: countOf("order", failed.length) })}
      </Button>
    ) : undefined;

  return (
    <div className="max-w-5xl">
      <PageHeader title={name ? fmt(t.title, { name }) : t.titlePlain} back={{ to: "/orders", label: t.back }} primaryAction={retryAction} />

      <DataState
        loading={batch.loading && !data}
        error={data ? null : batch.error}
        onRetry={() => void batch.refresh()}
        skeleton={
          <div className="flex flex-col gap-3">
            <CardSkeleton lines={2} />
            <ListSkeleton rows={5} />
          </div>
        }
      >
        {data && (
          <div className="flex flex-col gap-3">
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}

            <BatchProgress data={data} failed={failed.length} t={t} />

            {failed.length > 0 && done && (
              <p className="zimos-batch-hint flex items-start gap-2.5 rounded-[var(--radius-card)] bg-accent-soft px-4 py-3 text-sm leading-6 text-ink">
                <IconWarning className="mt-0.5 size-5 shrink-0 text-accent-dark" aria-hidden />
                <span>{t.retryHint}</span>
              </p>
            )}

            {items.length === 0 ? (
              <EmptyState
                icon={<IconCourier aria-hidden />}
                title={t.emptyTitle}
                description={t.emptyBody}
                action={
                  <Button asChild className="rounded-full px-5">
                    <Link to="/orders">{t.emptyAction}</Link>
                  </Button>
                }
              />
            ) : (
              <>
                {items.length > SEARCH_FROM && (
                  <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }} />
                )}
                <ChipRow items={chips} value={filter} onChange={setFilter} label={t.chipsLabel} collapseEmpty={false} />

                {visible.length === 0 ? (
                  <EmptyState
                    icon={<IconSearch aria-hidden />}
                    title={query ? t.emptySearch : t.emptyFiltered}
                    action={
                      <Button
                        variant="outline"
                        className="rounded-full px-5"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        {t.showAll}
                      </Button>
                    }
                  />
                ) : desktop ? (
                  <DeskList
                    columns={COLUMNS}
                    label={t.listLabel}
                    head={[
                      { label: t.colOrder },
                      { label: t.colStatus },
                      { label: t.colWaybill },
                      { label: t.colReason },
                      { label: t.colAction, end: true },
                    ]}
                  >
                    {visible.map((item) => {
                      const reason = reasonOf(item);
                      return (
                        <DeskRow key={item.orderId} menu={menuFor(item)} menuLabel={fmt(t.menuLabel, { number: numberOf(item) })}>
                          <div className="min-w-0">
                            <ViewLink
                              to={`/orders/${item.orderId}`}
                              aria-label={fmt(t.openOrder, { number: numberOf(item) })}
                              className="inline-flex min-h-9 max-w-full items-center rounded-sm text-[15px] font-medium text-ink tabular-nums hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              <bdi dir="ltr" className="truncate">
                                {numberOf(item)}
                              </bdi>
                            </ViewLink>
                          </div>
                          <div className="flex items-center">{badge(item)}</div>
                          <div className="min-w-0 truncate text-sm text-ink tabular-nums">
                            {item.waybillNumber ? <bdi dir="ltr">{item.waybillNumber}</bdi> : <span className="text-ink-soft">—</span>}
                          </div>
                          <div className="min-w-0">
                            {reason && <p className="text-sm leading-5 text-ink-soft">{reason}</p>}
                            {placeLine(item)}
                          </div>
                          <div className="flex items-center justify-end">{areaButton(item)}</div>
                        </DeskRow>
                      );
                    })}
                  </DeskList>
                ) : (
                  <ul aria-label={t.listLabel} className="flex flex-col gap-2.5">
                    {visible.map((item) => {
                      const reason = reasonOf(item);
                      const place = placeLine(item);
                      return (
                        <li key={item.orderId}>
                          <ContextMenu items={menuFor(item)} label={fmt(t.menuLabel, { number: numberOf(item) })}>
                            <ListRowCard
                              title={<bdi dir="ltr">{numberOf(item)}</bdi>}
                              status={badge(item)}
                              meta={
                                item.waybillNumber ? (
                                  <>
                                    {t.waybill}{" "}
                                    <bdi dir="ltr" className="font-medium text-ink tabular-nums">
                                      {item.waybillNumber}
                                    </bdi>
                                  </>
                                ) : undefined
                              }
                              action={areaButton(item) ?? undefined}
                              footer={
                                reason || place ? (
                                  <div className="w-full min-w-0">
                                    {reason && <p className="text-[13px] leading-5 text-ink-soft">{reason}</p>}
                                    {place}
                                  </div>
                                ) : undefined
                              }
                              onOpen={() => navigate(`/orders/${item.orderId}`)}
                              openLabel={fmt(t.openOrder, { number: numberOf(item) })}
                            />
                          </ContextMenu>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </DataState>

      <Sheet
        open={Boolean(fixing?.open)}
        onOpenChange={(open) => {
          if (!open) closeFix();
        }}
        title={fmt(t.fixTitle, { number: fixedItem ? numberOf(fixedItem) : "" })}
        description={fmt(t.fixHint, { name })}
        size="md"
      >
        {pickerError && (
          <Alert variant="danger" role="alert" className="mb-3">
            {pickerError}
          </Alert>
        )}
        {fixing && data && (
          // The courier's picker is the Shipping page's own piece: in the sheet it drops its box, and its controls grow to a thumb's size.
          <div className="[&>div]:mt-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:rounded-full [&_[data-slot=button]]:px-5 [&_select]:h-11 [&_select]:text-base">
            <CourierPlacePicker
              key={fixing.orderId}
              carrierCode={data.carrierCode}
              name={name}
              levels={levels}
              initialPath={addresses[fixing.orderId]?.path ?? []}
              saveLabel={t.useArea}
              onCancel={closeFix}
              onError={(err) => setPickerError(errorMessage(err))}
              onSave={async (path, place) => {
                setAddresses((prev) => ({ ...prev, [fixing.orderId]: { path } }));
                setPlaces((prev) => ({ ...prev, [fixing.orderId]: place }));
                closeFix();
              }}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}

/**
 * How far the booking is: one bar that fills as orders are answered (booked
 * or not), the sentence that says what is happening, and the three figures.
 * The bar grows by transform alone, from the start edge.
 */
function BatchProgress({ data, failed, t }: { data: ShipmentBatch; failed: number; t: Record<keyof (typeof STRINGS)["en"], string> }) {
  const { total, booked, pending } = data.counts;
  const answered = Math.max(0, total - pending);
  const done = data.status === "done";
  const sentence = done
    ? failed > 0
      ? fmt(t.doneSome, { count: countOf("order", failed) })
      : t.doneAll
    : data.status === "running"
      ? t.running
      : t.queued;
  const figures = [
    { key: "booked", label: t.figBooked, value: booked, ink: "text-success" },
    { key: "failed", label: t.figFailed, value: data.counts.failed, ink: data.counts.failed > 0 ? "text-danger" : "text-ink" },
    { key: "waiting", label: t.figWaiting, value: pending, ink: "text-ink" },
  ];

  return (
    <section className="zimos-batch-hero rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5">
      <div className="flex items-center gap-2.5">
        {done ? (
          failed > 0 ? (
            <IconWarning className="size-5 shrink-0 text-accent-dark" aria-hidden />
          ) : (
            <IconSuccess className="size-5 shrink-0 text-success" aria-hidden />
          )
        ) : (
          <IconSpinner className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
        )}
        <p role="status" aria-live="polite" className="min-w-0 flex-1 text-[15px] leading-6 font-semibold text-ink">
          {sentence}
        </p>
        <p className="shrink-0 text-sm font-medium text-ink-soft tabular-nums">
          <bdi>{fmt(t.progress, { done: answered, total })}</bdi>
        </p>
      </div>

      <MeterBar value={answered} max={total} label={fmt(t.progress, { done: answered, total })} done={done && failed === 0} className="mt-3" />

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {figures.map((figure) => (
          <div key={figure.key} className="zimos-batch-figure min-w-0 rounded-[0.875rem] bg-paper-sunken px-3 py-2.5">
            <dt className="truncate text-xs leading-4 font-medium text-ink-soft">{figure.label}</dt>
            <dd className={cn("mt-0.5 text-xl leading-7 font-semibold tabular-nums", figure.ink)}>{fmt("{n}", { n: figure.value })}</dd>
          </div>
        ))}
      </dl>

      {data.notes && (
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          {/* The note is the merchant's own words, in whatever language they were typed. */}
          <bdi dir="auto">{fmt(t.notes, { notes: data.notes })}</bdi>
        </p>
      )}
    </section>
  );
}
