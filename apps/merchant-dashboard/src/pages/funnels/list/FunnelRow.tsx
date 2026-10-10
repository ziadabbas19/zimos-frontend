import type { ReactNode } from "react";
import { Spinner, cn } from "@store-builder/ui";
import type { FunnelAnalyticsRow, FunnelDto, FunnelStatus } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, getIntlLocale } from "@/i18n/LocaleContext";
import { percentToRatio } from "@/lib/analytics";
import { formatDate, formatMoney, formatPercentValue } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { useViewNavigate } from "@/lib/viewTransition";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import type { FunnelListStrings } from "./funnelListStrings";

export const FUNNEL_STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

export function funnelStatusLabel(t: FunnelListStrings, status: FunnelStatus): string {
  return status === "published" ? t.statusPublished : status === "paused" ? t.statusPaused : t.statusDraft;
}

/** The columns of the desktop sheet: funnel, status, steps, visits, orders, conversion, revenue, actions. */
export const FUNNEL_COLUMNS =
  "grid-cols-[minmax(0,2.4fr)_max-content_max-content_max-content_max-content_max-content_max-content_max-content]";

/** The same sheet for a role that sees no numbers: funnel, status, steps, actions. */
export const FUNNEL_COLUMNS_PLAIN = "grid-cols-[minmax(0,2.4fr)_max-content_max-content_max-content]";

/** The "Open" pill: a real link, so it prefetches the editor and opens in a new tab like any link. */
const OPEN_PILL =
  "zimos-funnel-open inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-paper-raised px-4 text-sm font-medium whitespace-nowrap text-ink ring-1 ring-line select-none pointer-fine:h-9 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]";

const CHIP = "inline-flex max-w-full items-center rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium text-ink-soft tabular-nums";

export interface FunnelRowProps {
  t: FunnelListStrings;
  funnel: FunnelDto;
  /** True under the wide breakpoint: the row is a card. */
  compact: boolean;
  /** How many steps it has; undefined while that is still loading. */
  stepCount: number | undefined;
  /** Its numbers in the chosen period; undefined when it had none or they are not this role's to see. */
  stats: FunnelAnalyticsRow | undefined;
  /** False for a role without the reports permission: the number columns are not drawn at all. */
  showStats: boolean;
  currency: string;
  /** The row's menu — the same list for "…", a right-click and a long press. */
  menu: ContextMenuItem[];
  /** An action on this funnel is running. */
  busy: boolean;
}

/**
 * One funnel in the list. On a phone it is a card: the name and its status on
 * the first line; when it was last edited and "Open" on the second; steps,
 * visits and orders as small chips under them. From a wide screen it is a line
 * of the sheet. Either way the whole row opens the editor, and "…" — or a
 * right-click, or a long press — holds everything else.
 */
export function FunnelRow({ t, funnel: f, compact, stepCount, stats, showStats, currency, menu, busy }: FunnelRowProps) {
  const navigate = useViewNavigate();
  const to = `/funnels/${f.id}`;
  const digits = new Intl.NumberFormat(getIntlLocale());
  const menuLabel = fmt(t.menuLabel, { name: f.name });
  const openLabel = fmt(t.openFunnel, { name: f.name });
  const status = <StatusBadge value={f.status} text={funnelStatusLabel(t, f.status)} tone={FUNNEL_STATUS_TONE[f.status]} />;
  const edited = fmt(t.edited, { date: formatDate(f.updatedAt) });
  const hadTraffic = stats !== undefined && (stats.sessions > 0 || stats.orders > 0);
  const more = busy ? (
    <span className="flex size-11 items-center justify-center pointer-fine:size-9" role="status">
      <Spinner className="size-4" />
    </span>
  ) : (
    <ItemMenu items={menu} label={menuLabel} />
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={menuLabel}>
          <ListRowCard
            title={<bdi dir="auto">{f.name}</bdi>}
            amount={status}
            meta={edited}
            action={
              <>
                <ViewLink to={to} className={OPEN_PILL} aria-label={openLabel}>
                  {t.open}
                </ViewLink>
                {more}
              </>
            }
            footer={
              <>
                {stepCount !== undefined && <span className={CHIP}>{pluralOf(t, "steps", stepCount)}</span>}
                {showStats && hadTraffic && stats && (
                  <>
                    <span className={CHIP}>{pluralOf(t, "visits", stats.sessions)}</span>
                    <span className={CHIP}>{pluralOf(t, "orders", stats.orders)}</span>
                  </>
                )}
              </>
            }
            onOpen={() => navigate(to)}
            openLabel={openLabel}
          />
        </ContextMenu>
      </li>
    );
  }

  const figure = (value: number | null | undefined, render: (v: number) => string): ReactNode =>
    value === null || value === undefined ? <span aria-hidden>—</span> : <bdi dir="ltr">{render(value)}</bdi>;
  const NUMBER = "text-end text-sm whitespace-nowrap text-ink-soft tabular-nums";

  return (
    <ContextMenu items={menu} label={menuLabel}>
      <li
        data-slot="queue-row"
        data-pressable=""
        className={cn(
          "relative col-span-full grid min-h-[3.75rem] grid-cols-subgrid items-center border-b border-line px-4 py-1.5 text-sm text-ink last:border-b-0",
          "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken/60 has-[[data-row-open]:focus-visible]:bg-paper-sunken/60 motion-reduce:transition-none"
        )}
      >
        <div className="min-w-0">
          {/* The link is the row: its ::after covers the whole line, so it must not be positioned itself. */}
          <ViewLink
            to={to}
            data-row-open=""
            className="block truncate text-[15px] leading-6 font-medium text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
          >
            <bdi dir="auto">{f.name}</bdi>
          </ViewLink>
          <p className="flex min-w-0 items-center gap-2 text-xs leading-5 text-ink-soft">
            {f.subdomain && (
              <bdi dir="ltr" className="min-w-0 truncate">
                {f.subdomain}
              </bdi>
            )}
            <span className="shrink-0 whitespace-nowrap">{edited}</span>
          </p>
        </div>

        <div className="flex items-center">{status}</div>

        <div className={NUMBER}>{figure(stepCount, digits.format)}</div>

        {showStats && (
          <>
            <div className={NUMBER}>{figure(stats?.sessions, digits.format)}</div>
            <div className={NUMBER}>{figure(stats?.orders, digits.format)}</div>
            <div className={NUMBER}>{figure(hadTraffic ? stats?.conversionRate : null, (v) => formatPercentValue(percentToRatio(v)))}</div>
            <div className={cn(NUMBER, "text-ink")}>{figure(stats?.revenue, (v) => formatMoney(v, currency))}</div>
          </>
        )}

        <div className="relative z-10 flex items-center justify-end gap-1">
          <ViewLink to={to} className={OPEN_PILL} tabIndex={-1} aria-hidden>
            {t.open}
          </ViewLink>
          {more}
        </div>
      </li>
    </ContextMenu>
  );
}

/**
 * The desktop sheet around the rows: a quiet head and a line per funnel. It
 * carries the same hooks as the other queue sheets (`queue-sheet`,
 * `queue-head`, `queue-row`), so it takes their material.
 */
export function FunnelDesk({ t, showStats, children }: { t: FunnelListStrings; showStats: boolean; children: ReactNode }) {
  const HEAD = "min-w-0 truncate";
  return (
    <div
      data-slot="queue-sheet"
      className={cn(
        "zimos-list-sheet grid gap-x-4 overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line",
        showStats ? FUNNEL_COLUMNS : FUNNEL_COLUMNS_PLAIN
      )}
    >
      <div data-slot="queue-head" className="col-span-full grid h-11 grid-cols-subgrid items-center border-b border-line bg-paper-sunken/60 px-4 text-xs font-medium text-ink-soft">
        <span aria-hidden className={HEAD}>
          {t.colFunnel}
        </span>
        <span aria-hidden className={HEAD}>
          {t.colStatus}
        </span>
        <span aria-hidden className={cn(HEAD, "text-end")}>
          {t.colSteps}
        </span>
        {showStats && (
          <>
            <span aria-hidden className={cn(HEAD, "text-end")}>
              {t.colVisits}
            </span>
            <span aria-hidden className={cn(HEAD, "text-end")}>
              {t.colOrders}
            </span>
            <span aria-hidden className={cn(HEAD, "text-end")}>
              {t.colConversion}
            </span>
            <span aria-hidden className={cn(HEAD, "text-end")}>
              {t.colRevenue}
            </span>
          </>
        )}
        <span aria-hidden />
      </div>
      <ul aria-label={t.list} className="col-span-full grid grid-cols-subgrid">
        {children}
      </ul>
    </div>
  );
}
