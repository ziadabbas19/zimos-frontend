import { Fragment, type KeyboardEvent, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@store-builder/ui";
import { IconEye, IconMoreActions, IconSpinner } from "@/components/icons";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { ViewLink } from "@/components/ViewLink";
import { ListSkeleton } from "@/components/list";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * What every screen an offers-hub card opens is built from, so they read as
 * one product with the hub: the page frame (the shared header with the way
 * back to «العروض»), the list of the merchant's offers — a card per offer on a
 * phone, one sheet of rows from md up — with its state switch and «…» menu,
 * the pane that shows what the shopper will see, and the footer of a sheet.
 *
 * Material (the rows, the preview pane) is in glass/sweep-offers.css; without
 * the glass layer everything stands on its own solid Tailwind classes.
 */

const STRINGS = {
  en: {
    back: "Offers",
    more: "More actions: {name}",
    menu: "Actions: {name}",
    open: "Edit {name}",
    turnOn: "Turn on {name}",
    turnOff: "Turn off {name}",
    shopperSees: "The shopper sees",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
  },
  ar: {
    back: "العروض",
    more: "إجراءات أخرى: {name}",
    menu: "إجراءات: {name}",
    open: "تعديل {name}",
    turnOn: "تفعيل {name}",
    turnOff: "إيقاف {name}",
    shopperSees: "ما يراه العميل",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
  },
} satisfies Messages;

/** A select or a field under a thumb: 44px and 16px type on a phone (no zoom on focus), the desktop size from md. */
export const TOUCH_FIELD = "h-11 text-base md:h-10 md:text-sm";
/** A button in a page or a sheet: 44px on a phone. */
export const TOUCH_BUTTON = "min-h-11 md:min-h-9";

const WIDTH = {
  /** A list of offers. */
  list: "max-w-4xl",
  /** One short settings form. */
  form: "max-w-2xl",
  /** A form beside its preview. */
  wide: "max-w-5xl",
} as const;

interface OfferPageProps {
  title: string;
  /** One line of what the page is for. Shown from md up: on a phone the first screen is the content. */
  description?: string;
  /** Where the back link goes. Default: the offers hub. */
  back?: { to: string; label: string };
  titleBadge?: ReactNode;
  /** Secondary actions (a results link, a «…» menu). */
  actions?: ReactNode;
  /** The page's ONE creation action: in the header from md up, above the dock on a phone. */
  primaryAction?: ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}

/** The frame of a screen under the offers hub: the shared header with the way back, then the content. */
export function OfferPage({ title, description, back, titleBadge, actions, primaryAction, width = "list", className, children }: OfferPageProps) {
  const t = useT(STRINGS);
  const desktop = useMediaQuery("(min-width: 48rem)");
  return (
    <div className={cn("min-w-0", WIDTH[width], className)}>
      <PageHeader
        title={title}
        description={desktop ? description : undefined}
        back={back ?? { to: "/offers", label: t.back }}
        titleBadge={titleBadge}
        actions={actions}
        primaryAction={primaryAction}
      />
      {children}
    </div>
  );
}

interface OfferSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** What the switch turns on or off, for a screen reader and the tooltip. */
  label: string;
  /** The change is being saved: the thumb shows a spinner and a second press waits. */
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * The state switch of a row: the same track and thumb as a settings switch
 * (its material is shared, glass/settings.css) inside a 44px target. It never
 * opens the row it sits in.
 */
export function OfferSwitch({ checked, onChange, label, busy = false, disabled = false, className }: OfferSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      data-slot="offer-switch"
      onClick={(event) => {
        event.stopPropagation();
        if (!busy) onChange(!checked);
      }}
      className={cn(
        "group/switch relative z-10 inline-flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none",
        "transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-safe:active:scale-[0.97] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed aria-busy:cursor-progress",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/switch:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        >
          {busy && <IconSpinner className="size-3.5 animate-spin text-black/55 motion-reduce:animate-none" aria-hidden />}
        </span>
      </span>
    </button>
  );
}

/** A menu line: 36px with a mouse, 44px under a finger. */
const MENU_ITEM = "min-h-9 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";

/** «…» at the end of a row or in a header: the same items a right-click or a long press gives. */
export function OfferMenu({ items, label, className }: { items: readonly ContextMenuItem[]; label: string; className?: string }) {
  const { dir } = useLocale();
  if (items.length === 0) return null;
  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={label}
              title={label}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "relative z-10 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-ink/8 aria-expanded:text-ink motion-reduce:transition-none motion-reduce:active:scale-100",
                className
              )}
            />
          }
        >
          <IconMoreActions className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-auto min-w-52 rounded-[1.125rem] p-1.5">
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <Fragment key={item.id}>
                {item.separatorBefore && index > 0 && <DropdownMenuSeparator className="mx-1.5" />}
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  className={MENU_ITEM}
                >
                  {ItemIcon && <ItemIcon className="size-[18px]" aria-hidden />}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}

/**
 * The merchant's offers of one kind: cards with air between them on a phone,
 * one sheet with hairlines between its rows from md up.
 */
export function OfferList({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ul
      aria-label={label}
      data-slot="offer-list"
      className={cn(
        "zimos-offer-list flex min-w-0 flex-col gap-2.5 md:gap-0 md:rounded-[var(--radius-card)] md:bg-paper-raised md:shadow-[var(--shadow-card)] md:ring-1 md:ring-line",
        className
      )}
    >
      {children}
    </ul>
  );
}

export interface OfferRowProps {
  /** The offer's name, as plain words: it also names the row's switch and menu. */
  name: string;
  /** Shown instead of `name` when the title needs markup (a `<bdi>`, a code). */
  title?: ReactNode;
  /** A chip beside the name: a warning, a status that is not simply on / off. */
  badge?: ReactNode;
  /** What it gives, in one line (two at most). */
  line?: ReactNode;
  /** Quiet facts under it: the offer's numbers, its dates, small chips. */
  details?: ReactNode;
  /** A 40px tile before the words. */
  leading?: ReactNode;
  /** A press anywhere on the row: open its sheet. */
  onOpen?: () => void;
  /** Or: the row is a link to the offer's own page (a long form that stays a page). */
  to?: string;
  /** Label of that press, when "Edit {name}" is not what it does. */
  openLabel?: string;
  /** The state switch. Left out for a row that cannot be switched (a viewer's role, an ended sale). */
  toggle?: { checked: boolean; onChange: (next: boolean) => void; busy?: boolean; disabled?: boolean };
  /** Something else at the row's end, before the menu (a copy button). */
  end?: ReactNode;
  /** The row's actions: behind «…», and on right-click / long press. */
  menu?: readonly ContextMenuItem[];
}

/**
 * One offer in an `OfferList`: its name (and a chip), what it gives in one
 * line, quiet facts under it, then the state switch and «…». The row is one
 * big target that opens the offer's sheet; the switch and the menu are their
 * own controls drawn above it, in reading order.
 */
export function OfferRow({ name, title, badge, line, details, leading, onOpen, to, openLabel, toggle, end, menu = [] }: OfferRowProps) {
  const t = useT(STRINGS);

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpen || event.target !== event.currentTarget || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen();
  }

  return (
    <ContextMenu items={menu} label={fmt(t.menu, { name })}>
      <li
        data-slot="offer-row"
        data-off={toggle && !toggle.checked ? "" : undefined}
        className={cn(
          "zimos-offer-row relative flex min-h-[72px] items-center gap-3 rounded-[1.25rem] bg-paper-raised px-3.5 py-3 text-ink shadow-[var(--shadow-card)] ring-1 ring-line",
          "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "motion-safe:max-md:has-[[data-row-open]:active]:scale-[0.985]",
          "md:min-h-16 md:rounded-none md:border-b md:border-line md:bg-transparent md:px-5 md:shadow-none md:ring-0 md:first:rounded-t-[var(--radius-card)] md:last:rounded-b-[var(--radius-card)] md:last:border-b-0"
        )}
      >
        {to !== undefined && (
          <ViewLink
            to={to}
            aria-label={openLabel ?? fmt(t.open, { name })}
            data-row-open=""
            className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          />
        )}
        {to === undefined && onOpen && (
          <div
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={openLabel ?? fmt(t.open, { name })}
            data-row-open=""
            onClick={onOpen}
            onKeyDown={key}
            className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          />
        )}

        {leading !== undefined && leading !== null && (
          <div className="zimos-offer-row-tile flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-primary-soft text-primary [&>svg]:size-5">
            {leading}
          </div>
        )}

        {/* The words lie under the row's button; a link or a button among them is lifted over it and keeps working. */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 [&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="max-w-full min-w-0 truncate text-[15px] leading-[1.375rem] font-semibold text-ink">{title ?? <bdi>{name}</bdi>}</div>
            {badge}
          </div>
          {line !== undefined && line !== null && line !== "" && <div className="line-clamp-2 text-[13px] leading-5 text-ink-soft">{line}</div>}
          {details !== undefined && details !== null && details !== false && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs leading-5 text-ink-soft">{details}</div>
          )}
        </div>

        {(toggle || end || menu.length > 0) && (
          <div className="relative z-10 -me-1.5 flex shrink-0 items-center gap-0.5">
            {end}
            {toggle && (
              <OfferSwitch
                checked={toggle.checked}
                onChange={toggle.onChange}
                busy={toggle.busy}
                disabled={toggle.disabled}
                label={fmt(toggle.checked ? t.turnOff : t.turnOn, { name })}
              />
            )}
            <OfferMenu items={menu} label={fmt(t.more, { name })} />
          </div>
        )}
      </li>
    </ContextMenu>
  );
}

/**
 * The states of a list of offers: placeholders in the shape of its rows while
 * it loads; what happened and a retry when it fails; "who can grant it" for a
 * role that may not read it (DataState's own wording).
 */
export function OfferListState({
  loading,
  error,
  onRetry,
  rows = 4,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  rows?: number;
  children: ReactNode;
}) {
  return (
    <DataState loading={loading} error={error} onRetry={onRetry} skeleton={<ListSkeleton rows={rows} />}>
      {children}
    </DataState>
  );
}

/**
 * What the shopper will see, said while the form is filled: a quiet "paper"
 * pane (solid, like the storefront it stands for) with a small heading.
 */
export function OfferPreview({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  const t = useT(STRINGS);
  return (
    <div
      data-slot="offer-preview"
      aria-live="polite"
      className={cn("zimos-offer-preview space-y-1.5 rounded-[1rem] bg-paper-sunken p-3.5 text-sm leading-6 text-ink ring-1 ring-line", className)}
    >
      <p className="flex items-center gap-1.5 text-xs leading-5 font-medium text-ink-soft">
        <IconEye className="size-3.5 shrink-0" aria-hidden />
        {label ?? t.shopperSees}
      </p>
      {children}
    </div>
  );
}

/** The two actions of a form sheet: cancel, then save (the main one last, as the sheet's footer asks). */
export function SheetActions({
  busy,
  onCancel,
  onSave,
  saveLabel,
  disabled = false,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  return (
    <>
      <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={busy} onClick={onCancel}>
        {t.cancel}
      </Button>
      <Button type="button" className="min-h-11 rounded-full px-5" disabled={busy || disabled} onClick={onSave}>
        {busy ? t.saving : (saveLabel ?? t.save)}
      </Button>
    </>
  );
}

/** Why a form was not saved, in words — under the fields, announced when it appears. */
export function FormProblem({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === false || children === "") return null;
  return (
    <Alert variant="danger" role="alert">
      {children}
    </Alert>
  );
}

/** Scroll to the first field marked invalid inside `scope` and put the caret in it. */
export function focusFirstInvalid(scope: HTMLElement | null) {
  window.setTimeout(() => {
    const field = scope?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.scrollIntoView({ block: "center" });
    field?.focus({ preventScroll: true });
  }, 0);
}
