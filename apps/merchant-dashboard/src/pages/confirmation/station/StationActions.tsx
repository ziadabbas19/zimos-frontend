import type { ConfirmationChannel, ConfirmationOutcome } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconArrowRight, IconNote, IconPhone, IconSpinner, IconWhatsApp, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { OUTCOME_ICON } from "../queueModel";
import { useStationStrings } from "./stationStrings";
import { STATION_KEYCAPS } from "./useStationKeys";

type ButtonKind = "confirm" | "call" | "whatsapp" | "quiet" | "danger";
/** What is on its way to the server: the control that started it shows the spinner, the rest wait. */
export type StationPending = "call" | "whatsapp" | "skip" | ConfirmationOutcome;

// The big buttons. The solid look (glass off) is here; glass/confirm.css gives the brand fill its sheen,
// the tints their panes and the two quiet ones the small-pane material (`data-kind`).
const BUTTON =
  "zimos-station-btn relative inline-flex h-14 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-[15px] leading-5 font-semibold select-none " +
  "transition-[scale,background-color,color,opacity] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-55";
const BUTTON_KIND: Record<ButtonKind, string> = {
  confirm: "bg-primary text-base text-primary-foreground",
  call: "bg-primary-soft text-primary-dark",
  whatsapp: "bg-success-soft text-success",
  quiet: "bg-paper-raised text-ink ring-1 ring-line",
  danger: "bg-danger-soft text-danger",
};
/** The three smaller results share one row: on a narrow card the word sits under its icon. */
const BUTTON_STACKED =
  "@max-lg:flex-col @max-lg:gap-0.5 @max-lg:rounded-[1.25rem] @max-lg:px-1 @max-lg:text-[13px] @max-lg:leading-4";

const QUIET_LINK =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] leading-5 font-medium text-ink-soft select-none " +
  "transition-[background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-white/8";

/** A keycap on a button: only where there is a keyboard to press it on (md up, a fine pointer). */
function Keycap({ children, onFill = false }: { children: string; onFill?: boolean }) {
  return (
    <kbd
      aria-hidden
      data-on-fill={onFill ? "" : undefined}
      className={cn(
        "zimos-station-key hidden h-5 min-w-5 shrink-0 items-center justify-center rounded-[6px] border border-b-2 px-1 font-mono text-[11px] leading-none font-medium md:pointer-fine:inline-flex",
        // On the brand fill: a darker bead (a lighter one in the dark theme, where the fill is light), so the letter keeps its contrast.
        onFill ? "border-transparent bg-black/20 text-primary-foreground dark:bg-white/30" : "border-line-strong/45 bg-paper-raised text-ink-soft"
      )}
    >
      {children}
    </kbd>
  );
}

/** What is inside a big button: its icon (a spinner while its call is in flight), its word, its keycap. */
function Face({
  icon: Icon,
  label,
  keycap,
  busy,
  onFill,
  small,
}: {
  icon: IconComponent;
  label: string;
  keycap: string;
  busy: boolean;
  onFill?: boolean;
  small?: boolean;
}) {
  const glyph = small ? "size-[18px] shrink-0 @lg:size-5" : "size-5 shrink-0";
  return (
    <>
      {busy ? (
        <IconSpinner className={cn(glyph, "animate-spin motion-reduce:animate-none")} aria-hidden />
      ) : (
        <Icon className={glyph} aria-hidden />
      )}
      <span className="min-w-0 truncate">{label}</span>
      <Keycap onFill={onFill}>{keycap}</Keycap>
    </>
  );
}

/**
 * Everything the agent presses on the station card. First row: "Call" and
 * "WhatsApp" — the one used last carries a dot and a ring, and is the channel
 * the result is recorded with. Then the results: "Confirmed", the main action,
 * across the row; "No answer", "Call later" and "Cancelled" under it. Last, the
 * quiet line: open the order to edit it, add a note, skip.
 *
 * All 56px tall; each also has a key on a desktop (useStationKeys.ts), printed
 * on it from md up. While one of them is working, the rest wait.
 */
export function StationActions({
  orderId,
  canCall,
  noPhoneLabel,
  whatsAppUrl,
  whatsAppLabel,
  usedChannel,
  pending,
  locked,
  hasNote,
  confirmHeldReason,
  onCall,
  onWhatsApp,
  onRecord,
  onLater,
  onCancel,
  onNote,
  onSkip,
}: {
  orderId: string;
  /** The number is whole: it can be dialled. */
  canCall: boolean;
  noPhoneLabel: string;
  /** The click-to-chat link with the store's message, or null when the number cannot be placed in a country. */
  whatsAppUrl: string | null;
  whatsAppLabel: string;
  usedChannel: ConfirmationChannel | null;
  pending: StationPending | null;
  /** Something is on its way to the server, or this is the card that is sliding away. */
  locked: boolean;
  hasNote: boolean;
  /** Why the order cannot be confirmed yet (its payment is not approved), or null. */
  confirmHeldReason: string | null;
  onCall: () => void;
  /** The WhatsApp link was followed (the browser opens it): note the channel and claim the order. */
  onWhatsApp: () => void;
  /** A result recorded in one press: confirmed, or no answer. */
  onRecord: (outcome: "confirmed" | "unreachable") => void;
  onLater: () => void;
  onCancel: () => void;
  onNote: () => void;
  onSkip: () => void;
}) {
  const t = useStationStrings();

  const usedMark = (
    <>
      <span aria-hidden className="absolute end-2.5 top-2 size-2 rounded-full bg-current opacity-80" />
      <span className="sr-only"> — {t.used}</span>
    </>
  );

  return (
    <>
      {/* The grid is one level under the group: the dashboard pads every button that is a direct child of a group. */}
      <div role="group" aria-label={t.contactLabel}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-kind="call"
            data-used={usedChannel === "call" ? "" : undefined}
            aria-keyshortcuts={STATION_KEYCAPS.call}
            title={canCall ? undefined : noPhoneLabel}
            onClick={onCall}
            disabled={locked || !canCall}
            className={cn(BUTTON, BUTTON_KIND.call, !whatsAppUrl && "col-span-2")}
          >
            <Face icon={IconPhone} label={t.call} keycap={STATION_KEYCAPS.call} busy={pending === "call"} />
            {usedChannel === "call" && usedMark}
          </button>
          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-kind="whatsapp"
              data-used={usedChannel === "whatsapp" ? "" : undefined}
              aria-label={whatsAppLabel}
              aria-keyshortcuts={STATION_KEYCAPS.whatsapp}
              onClick={onWhatsApp}
              className={cn(BUTTON, BUTTON_KIND.whatsapp)}
            >
              <Face icon={IconWhatsApp} label={t.whatsapp} keycap={STATION_KEYCAPS.whatsapp} busy={pending === "whatsapp"} />
              {usedChannel === "whatsapp" && usedMark}
            </a>
          )}
        </div>
      </div>

      <div role="group" aria-label={t.outcomesLabel}>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-kind="confirm"
            aria-keyshortcuts="Enter"
            onClick={() => onRecord("confirmed")}
            title={confirmHeldReason ?? undefined}
            disabled={locked || confirmHeldReason !== null}
            className={cn(BUTTON, BUTTON_KIND.confirm, "col-span-3")}
          >
            <Face icon={OUTCOME_ICON.confirmed} label={t.confirmed} keycap={t.keyEnter} busy={pending === "confirmed"} onFill />
          </button>
          <button
            type="button"
            data-kind="quiet"
            aria-keyshortcuts={STATION_KEYCAPS.noAnswer}
            onClick={() => onRecord("unreachable")}
            disabled={locked}
            className={cn(BUTTON, BUTTON_KIND.quiet, BUTTON_STACKED)}
          >
            <Face
              icon={OUTCOME_ICON.unreachable}
              label={t.noAnswer}
              keycap={STATION_KEYCAPS.noAnswer}
              busy={pending === "unreachable"}
              small
            />
          </button>
          <button
            type="button"
            data-kind="quiet"
            aria-haspopup="dialog"
            aria-keyshortcuts={STATION_KEYCAPS.later}
            onClick={onLater}
            disabled={locked}
            className={cn(BUTTON, BUTTON_KIND.quiet, BUTTON_STACKED)}
          >
            <Face icon={OUTCOME_ICON.postponed} label={t.later} keycap={STATION_KEYCAPS.later} busy={pending === "postponed"} small />
          </button>
          <button
            type="button"
            data-kind="danger"
            aria-haspopup="dialog"
            aria-keyshortcuts={STATION_KEYCAPS.cancelled}
            onClick={onCancel}
            disabled={locked}
            className={cn(BUTTON, BUTTON_KIND.danger, BUTTON_STACKED)}
          >
            <Face
              icon={OUTCOME_ICON.rejected}
              label={t.cancelled}
              keycap={STATION_KEYCAPS.cancelled}
              busy={pending === "rejected"}
              small
            />
          </button>
        </div>
      </div>

      <div className="-mx-1.5 -mb-1 flex items-center gap-1">
        <ViewLink to={`/orders/${orderId}`} className={cn(QUIET_LINK, "min-w-0")}>
          <span className="min-w-0 truncate">{t.openOrder}</span>
        </ViewLink>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onNote}
          disabled={locked}
          className={cn(QUIET_LINK, "ms-auto shrink-0", hasNote && "text-ink")}
        >
          <IconNote className="size-4 shrink-0" aria-hidden />
          {hasNote ? t.noteAdded : t.note}
        </button>
        <button
          type="button"
          aria-label={t.skipLabel}
          aria-keyshortcuts={STATION_KEYCAPS.skip}
          onClick={onSkip}
          disabled={locked}
          className={cn(QUIET_LINK, "shrink-0")}
        >
          {pending === "skip" && (
            <IconSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {t.skip}
          <IconArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          <Keycap>{STATION_KEYCAPS.skip}</Keycap>
        </button>
      </div>
    </>
  );
}
