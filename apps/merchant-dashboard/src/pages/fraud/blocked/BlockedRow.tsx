import type { BlockedEntry } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconCopy, IconUnlock, IconUser } from "@/components/icons";
import { ListRowCard } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatDate } from "@/lib/format";
import { useViewNavigate } from "@/lib/viewTransition";
import { useCopy } from "@/pages/returns/rowkit/clipboard";
import { DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { BLOCKED_STRINGS, SCOPE_TONE } from "./blockedText";

/** The columns of the blocked sheet: what is blocked, from what, why, since when, and the way back. */
export const BLOCKED_COLUMNS = "grid-cols-[minmax(0,1.4fr)_max-content_minmax(0,1.3fr)_max-content_max-content]";

const LINK =
  "rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * One blocked entry: what is blocked and its kind, what it is blocked from,
 * the reason, who added it and when — and the ONE action, «فك الحظر», which
 * asks first. Everything about an entry is on the row, so it opens nothing;
 * its menu (right-click, a long press, Shift+F10) copies the value, opens the
 * customer a phone belongs to, and unblocks.
 */
export function BlockedRow({ entry, compact, onRemove }: { entry: BlockedEntry; compact: boolean; onRemove: () => void }) {
  const t = useT(BLOCKED_STRINGS);
  const navigate = useViewNavigate();
  const copy = useCopy();
  const customerTo = entry.customerId ? `/customers/${entry.customerId}` : null;

  const menu: ContextMenuItem[] = [{ id: "copy", label: t.menuCopy, icon: IconCopy, onSelect: () => copy(entry.label, t.copied) }];
  if (customerTo) menu.push({ id: "customer", label: t.viewCustomer, icon: IconUser, onSelect: () => navigate(customerTo) });
  menu.push({ id: "remove", label: t.remove, icon: IconUnlock, destructive: true, separatorBefore: true, onSelect: onRemove });

  // A name and address is in the language it was typed in; everything else (a phone, an IP, an email) reads left to right.
  const value = <bdi dir={entry.type === "name_address" ? "auto" : "ltr"}>{entry.label}</bdi>;
  const scope = <StatusBadge value={entry.scope} tone={SCOPE_TONE[entry.scope]} text={t[`scope_${entry.scope}`]} />;
  const action = <RowAction tone="quiet" label={t.remove} icon={IconUnlock} onClick={onRemove} />;
  const customer = customerTo && (
    <ViewLink to={customerTo} className={LINK}>
      {t.viewCustomer}
    </ViewLink>
  );

  if (compact) {
    return (
      <li>
        <ContextMenu items={menu} label={t.menuLabel}>
          <ListRowCard
            title={value}
            status={scope}
            meta={t[`type_${entry.type}`]}
            action={action}
            footer={
              <div className="min-w-0 space-y-0.5 text-xs leading-5 text-ink-soft">
                {entry.reason && (
                  <p dir="auto" className="wrap-anywhere text-ink">
                    {entry.reason}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-1.5">
                  <span>{fmt(t.addedOn, { date: formatDate(entry.createdAt) })}</span>
                  {entry.createdBy && <span>{fmt(t.by, { name: entry.createdBy })}</span>}
                  {customer && (
                    <>
                      <span aria-hidden>·</span>
                      {customer}
                    </>
                  )}
                </p>
              </div>
            }
          />
        </ContextMenu>
      </li>
    );
  }

  return (
    <DeskRow menu={menu} menuLabel={t.menuLabel}>
      <div className="min-w-0">
        <p className="truncate text-[15px] leading-6 font-medium text-ink">{value}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
          <span>{t[`type_${entry.type}`]}</span>
          {customer && (
            <>
              <span aria-hidden>·</span>
              {customer}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center">{scope}</div>

      {entry.reason ? (
        <p dir="auto" className="line-clamp-2 min-w-0 text-sm leading-5 wrap-anywhere text-ink">
          {entry.reason}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">{t.noReason}</p>
      )}

      <div className="text-xs leading-5 whitespace-nowrap text-ink-soft">
        <p>{formatDate(entry.createdAt)}</p>
        {entry.createdBy && <p className="max-w-40 truncate">{fmt(t.by, { name: entry.createdBy })}</p>}
      </div>

      <div className="flex items-center justify-end">{action}</div>
    </DeskRow>
  );
}
