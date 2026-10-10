import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import type { SettlementDetail, SettlementListItem } from "@store-builder/api-client";
import { CardSkeleton, DataState } from "@/components/DataState";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate, formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { SETTLEMENT_STRINGS } from "./settlementStrings";
// What each line of a confirmed settlement really added to its order.
import { AppliedAmount, AppliedLessNote } from "./AppliedAmount";

/** Deleting a draft is written in the danger colour here; the question it opens carries the full danger fill. */
const DANGER_TEXT = "text-danger hover:text-danger";

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div data-slot="settlement-figure" className="min-w-0 rounded-2xl bg-paper-sunken px-3 py-2.5">
      <p className="truncate text-xs leading-5 text-ink-soft">{label}</p>
      <p className={cn("text-[15px] leading-6 wrap-anywhere text-ink tabular-nums", strong ? "font-semibold" : "font-medium")}>
        <bdi dir="ltr">{value}</bdi>
      </p>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-end text-ink">{children}</dd>
    </div>
  );
}

/**
 * One settlement, in a panel over the list (a bottom sheet on the phone): the
 * three amounts, its reference and dates, the orders in it — each a link to
 * its order — and, for a draft, the two things that can be done to it. The
 * list underneath never leaves.
 *
 * `summary` is the row that was pressed: it names the panel and fills the
 * amounts at once, while the orders are on their way.
 */
export function SettlementSheet({
  open,
  onClose,
  summary,
  detail,
  loading,
  error,
  onRetry,
  currency,
  onConfirm,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  summary: SettlementListItem | null;
  detail: SettlementDetail | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** For a settlement the server stored before it recorded a currency. */
  currency: string;
  onConfirm: () => void;
  onDelete: () => void;
}) {
  const t = useT(SETTLEMENT_STRINGS);
  const head = detail ?? summary;
  const money = (minor: number) => formatMoney(minor, head?.currency ?? currency);

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="auto-end"
    >
      <SheetHeader
        title={head ? fmt(t.detailTitle, { carrier: providerName(head.carrierCode) }) : t.viewSettlements}
        status={head ? <StatusBadge value={head.status} text={head.status === "draft" ? t.status_draft : t.status_confirmed} /> : undefined}
      />
      <SheetBody>
        <div data-slot="settlement-peek" className="space-y-4">
          {head && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Figure label={t.colCollected} value={money(head.collectedAmount)} />
                <Figure label={t.colFees} value={money(head.feesAmount)} />
                <Figure label={t.colNet} value={money(head.netAmount)} strong />
              </div>
              <dl className="text-sm">
                <Fact label={t.createdOn}>{formatDate(head.createdAt)}</Fact>
                {head.confirmedAt && <Fact label={t.confirmedOn}>{formatDate(head.confirmedAt)}</Fact>}
                {head.reference && (
                  <Fact label={t.reference}>
                    <bdi className="wrap-anywhere">{head.reference}</bdi>
                  </Fact>
                )}
                {(head.periodStart || head.periodEnd) && (
                  <Fact label={t.period}>{fmt(t.periodRange, { from: formatDate(head.periodStart), to: formatDate(head.periodEnd) })}</Fact>
                )}
              </dl>
            </>
          )}

          <div role="separator" className="h-px bg-line" />

          <DataState loading={loading && !detail} error={detail ? null : error} onRetry={onRetry} skeleton={<CardSkeleton lines={5} />}>
            {detail && (
              <>
                <section>
                  <h3 className="mb-1 text-xs leading-5 font-medium text-ink-soft">
                    {t.linesTitle} · {countOf("order", detail.lines.length)}
                  </h3>
                  <ul className="divide-y divide-line">
                    {detail.lines.map((line) => (
                      <li key={line.orderId} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 font-medium text-ink">
                            {line.orderNumber ? (
                              <ViewLink
                                to={`/orders/${line.orderId}`}
                                aria-label={fmt(t.openOrder, { number: line.orderNumber })}
                                className="inline-flex min-h-11 items-center rounded-sm text-primary tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-0"
                              >
                                <bdi dir="ltr">{line.orderNumber}</bdi>
                              </ViewLink>
                            ) : (
                              <span className="text-ink-soft">{t.orderGone}</span>
                            )}
                            {line.financialState && <StatusBadge value={line.financialState} />}
                          </p>
                          <p className="truncate text-[13px] leading-5 text-ink-soft">
                            <bdi>{line.customerName ?? "—"}</bdi>
                          </p>
                          <AppliedLessNote line={line} />
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="text-sm leading-6 font-semibold text-ink tabular-nums">
                            <bdi dir="ltr">{money(line.collectedAmount)}</bdi>
                            {line.orderTotal !== null && (
                              <span className="ms-1.5 text-xs font-normal text-ink-soft">
                                {t.lineOf}{" "}
                                <bdi dir="ltr">{money(line.orderTotal)}</bdi>
                              </span>
                            )}
                          </p>
                          {line.feeAmount > 0 && (
                            <p className="text-xs leading-5 text-ink-soft tabular-nums">
                              {t.courierFee}{" "}
                              <bdi dir="ltr">{money(line.feeAmount)}</bdi>
                            </p>
                          )}
                          <AppliedAmount line={line} money={money} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                {detail.notes && (
                  <section>
                    <h3 className="mb-1 text-xs leading-5 font-medium text-ink-soft">{t.notes}</h3>
                    <p dir="auto" className="text-sm leading-6 wrap-anywhere whitespace-pre-line text-ink">
                      {detail.notes}
                    </p>
                  </section>
                )}
              </>
            )}
          </DataState>
        </div>
      </SheetBody>
      {head?.status === "draft" && (
        <SheetFooter>
          <Button type="button" variant="outline" className={cn("rounded-full px-5", DANGER_TEXT)} onClick={onDelete}>
            {t.delete}
          </Button>
          <Button type="button" className="rounded-full px-5" onClick={onConfirm} disabled={!detail}>
            {t.confirm}
          </Button>
        </SheetFooter>
      )}
    </SheetFrame>
  );
}
