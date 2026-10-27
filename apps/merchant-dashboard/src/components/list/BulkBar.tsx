import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn, ZLoader } from "@store-builder/ui";
import { IconCaretUp, IconClose, type IconComponent } from "@/components/icons";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    toolbar: "Actions for what you selected",
    clear: "Clear selection",
    more: "More",
    working: "Working on it…",
  },
  ar: {
    toolbar: "إجراءات على العناصر المحددة",
    clear: "إلغاء التحديد",
    more: "المزيد",
    working: "جارٍ التنفيذ…",
  },
} satisfies Messages;

export interface BulkAction {
  id: string;
  label: string;
  icon?: IconComponent;
  onSelect: () => void;
  /** Written in the danger colour: delete, cancel. */
  destructive?: boolean;
  disabled?: boolean;
  /** Why it is off, in a sentence: the tooltip of the pill, a second line in the «كمان» menu. */
  disabledReason?: string;
}

export interface BulkBarProps {
  /** How many rows are selected; the bar shows only when > 0. */
  count: number;
  /** "3 selected" in words, from the caller (it knows the noun and the plural). */
  label: string;
  onClear: () => void;
  actions: ReadonlyArray<BulkAction>;
  /** How many actions are drawn as buttons before the rest fold into «كمان». Default 3 on desktop, 2 on a phone. */
  maxInline?: number;
  /** Optional extra line, e.g. "select all 240 matching". */
  extra?: ReactNode;
  busy?: boolean;
}

/** How long the bar stays mounted after the selection is cleared, to leave the way it came. */
const EXIT_MS = 200;
/** Air between the bar and the edges of the page pane. */
const INSET = 12;
/** One row of the bar is 48–56px tall; taller than this, it has wrapped. */
const ONE_ROW_MAX = 64;
/** Below Tailwind's md: where the dock is, and where two inline actions are all that fit. */
const PHONE_QUERY = "(max-width: 47.99rem)";

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the corners of the menu. */
const MENU_ITEM = "min-h-9 cursor-pointer items-start gap-2.5 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11 data-disabled:opacity-100";

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(PHONE_QUERY);
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function isPhoneNow(): boolean {
  return window.matchMedia?.(PHONE_QUERY).matches === true;
}

// The page's own action bar (PageHeader's primaryAction, `[data-page-action]`) sits where this bar rises on a
// phone. While a bulk bar is up, <html data-bulk-open> hides it — the one layout rule at the end of glass/list.css.
let barsUp = 0;
function holdPageAction(): () => void {
  const root = document.documentElement;
  barsUp += 1;
  root.setAttribute("data-bulk-open", "");
  return () => {
    barsUp = Math.max(0, barsUp - 1);
    if (barsUp === 0) root.removeAttribute("data-bulk-open");
  };
}

/**
 * The bar that rises when rows are selected: how many, a way to let go of
 * them, and what can be done to all of them at once. The first action is the
 * main one (the brand pill); `maxInline` are drawn as pills and the rest wait
 * in «كمان».
 *
 * It floats over the list — above the dock on a phone, at the foot of the page
 * pane from md — and is frosted, because the rows scroll beneath it. It rises
 * on the house spring when the count leaves zero and sinks the same way when
 * the selection is cleared (no movement for people who asked for less). While
 * it is up the page's own action bar steps aside.
 *
 * It is `position: fixed`, so where it is written does not change where it is
 * drawn; put it just after the list's toolbar, so Tab reaches it before the
 * rows. Keep it out of anything transformed or clipped.
 */
export function BulkBar({ count, label, onClear, actions, maxInline, extra, busy = false }: BulkBarProps) {
  const open = count > 0;
  // In the page a little longer than it is open, so it can leave.
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  // What it last said while rows were selected: on its way out it keeps saying that, not "0 selected".
  const [said, setSaid] = useState(label);
  if (open && said !== label) setSaid(label);

  useEffect(() => {
    if (open || !present) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const timer = window.setTimeout(() => setPresent(false), calm ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  useEffect(() => {
    if (!present) return;
    return holdPageAction();
  }, [present]);

  if (!present) return null;
  return (
    <BulkPane open={open} label={open ? label : said} onClear={onClear} actions={actions} maxInline={maxInline} extra={extra} busy={busy} />
  );
}

interface BulkPaneProps {
  open: boolean;
  label: string;
  onClear: () => void;
  actions: ReadonlyArray<BulkAction>;
  maxInline: number | undefined;
  extra: ReactNode;
  busy: boolean;
}

function BulkPane({ open, label, onClear, actions, maxInline, extra, busy }: BulkPaneProps) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const phone = useSyncExternalStore(subscribeToPhone, isPhoneNow, () => false);
  const frameRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState(false);

  // Centred over the page pane, not over the screen: from md the side menu takes a strip of the screen,
  // and a bar centred on the window would sit off the middle of the list. Without a <main> around it
  // (a preview, a test) it keeps the 12px insets of its classes.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = frame?.closest("main");
    if (!frame || !page) return;
    const place = () => {
      const box = page.getBoundingClientRect();
      const screen = document.documentElement.clientWidth;
      frame.style.left = `${Math.max(0, box.left) + INSET}px`;
      frame.style.right = `${Math.max(0, screen - box.right) + INSET}px`;
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(page);
    window.addEventListener("resize", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  // A single row is a full pill; once the actions wrap under the label the corners are 1.5rem.
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const measure = () => setWrapped(pane.offsetHeight > ONE_ROW_MAX);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  const limit = Math.max(0, Math.floor(maxInline ?? (phone ? 2 : 3)));
  const inline = actions.slice(0, limit);
  const folded = actions.slice(limit);

  return (
    <div
      ref={frameRef}
      data-slot="bulk-bar-frame"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center md:bottom-6"
    >
      <div
        ref={paneRef}
        role="toolbar"
        aria-label={t.toolbar}
        aria-busy={busy || undefined}
        // On its way out it is only a picture: nothing in it can be pressed or tabbed to.
        inert={!open}
        data-slot="bulk-bar"
        data-leaving={open ? undefined : ""}
        data-wrapped={wrapped ? "" : undefined}
        className={cn(
          "zimos-bulk-bar pointer-events-auto flex max-w-[44rem] min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-full bg-paper-raised p-1.5 text-ink shadow-[var(--shadow-pop)] ring-1 ring-line data-[wrapped]:rounded-[1.5rem]",
          // Up on the spring from a little below, clear to solid; down the same way. Translate and opacity only.
          "translate-y-0 transition-[translate,opacity] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none",
          "starting:translate-y-6 starting:opacity-0 data-[leaving]:pointer-events-none data-[leaving]:translate-y-6 data-[leaving]:opacity-0"
        )}
      >
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          aria-label={t.clear}
          title={t.clear}
          // 36px to the eye, 44px to the thumb: the ring of air around it is part of the target.
          className="zimos-bulk-clear relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/6 text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1 hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <IconClose className="size-4" aria-hidden />
        </button>

        <p aria-live="polite" aria-atomic="true" className="flex min-w-0 items-center gap-2 ps-1 pe-2 text-sm font-semibold text-ink tabular-nums">
          <span className="min-w-0 truncate">{label}</span>
          {busy && (
            <>
              <ZLoader size="sm" className="shrink-0 text-ink-soft" aria-hidden />
              <span className="sr-only">{t.working}</span>
            </>
          )}
        </p>

        {actions.length > 0 && (
          <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            {inline.map((action, index) => (
              <ActionPill key={action.id} action={action} primary={index === 0} busy={busy} />
            ))}
            {folded.length > 0 && (
              <DirectionProvider direction={dir}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        className="zimos-bulk-action h-9 gap-1 rounded-full ps-3.5 pe-2.5 pointer-coarse:h-11"
                      />
                    }
                  >
                    {t.more}
                    {/* The menu opens upward, away from the foot of the screen. */}
                    <IconCaretUp className="size-4 text-ink-soft" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-auto max-w-[min(20rem,calc(100vw_-_1.5rem))] min-w-52 rounded-[1.125rem] p-1.5">
                    {folded.map((action) => {
                      const ActionIcon = action.icon;
                      const off = busy || action.disabled === true;
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          variant={action.destructive ? "destructive" : "default"}
                          disabled={off}
                          onClick={() => {
                            if (!off) action.onSelect();
                          }}
                          className={MENU_ITEM}
                        >
                          {ActionIcon && (
                            <ActionIcon
                              className="mt-px size-[18px] group-data-disabled/dropdown-menu-item:opacity-50"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block group-data-disabled/dropdown-menu-item:opacity-50">{action.label}</span>
                            {/* The reason stays at full strength: it is the part to read. */}
                            {action.disabled && action.disabledReason && (
                              <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{action.disabledReason}</span>
                            )}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </DirectionProvider>
            )}
          </div>
        )}

        {shown(extra) && (
          <div data-slot="bulk-bar-extra" className="basis-full px-2.5 pb-1 text-[13px] leading-5 text-ink-soft">
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}

/** One action drawn in the bar. The first is the main one: the brand pill (the danger fill if it destroys). */
function ActionPill({ action, primary, busy }: { action: BulkAction; primary: boolean; busy: boolean }) {
  const ActionIcon = action.icon;
  const off = busy || action.disabled === true;
  return (
    <Button
      type="button"
      variant={!primary ? "ghost" : action.destructive ? "destructive" : "default"}
      disabled={off}
      // Off, it can still be reached with Tab, so its reason can be read.
      focusableWhenDisabled
      title={action.disabled ? action.disabledReason : undefined}
      data-primary={primary ? "" : undefined}
      data-destructive={action.destructive ? "" : undefined}
      onClick={() => {
        if (!off) action.onSelect();
      }}
      className={cn(
        "zimos-bulk-action h-9 max-w-full gap-1.5 rounded-full px-3.5 pointer-coarse:h-11 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        !primary && action.destructive && "text-danger hover:bg-danger-soft hover:text-danger"
      )}
    >
      {ActionIcon && <ActionIcon className="size-4" aria-hidden />}
      <span className="min-w-0 truncate">{action.label}</span>
    </Button>
  );
}
