import { useId, type ReactNode } from "react";
import { cn, ZLoader } from "@store-builder/ui";
import { IconCaretRight, IconExternal, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SettingsIconTile, type SettingsTone } from "./SettingsPane";

const STRINGS = {
  en: { newTab: "Opens in a new tab" },
  ar: { newTab: "يفتح في تبويب جديد" },
} satisfies Messages;

/**
 * What every row of a group shares: the 52px floor, the padding, the corners
 * it takes from the card at the first and last place, and the hairline over
 * it — drawn by the row itself, inset from the start, and left out over the
 * first row. (No `overflow-hidden` on the card: a field's focus glow and a
 * switch's glow must not be cut.)
 */
const ROW =
  "zimos-settings-row relative min-h-13 px-4 py-3 first:rounded-t-[1.25rem] last:rounded-b-[1.25rem] " +
  "before:pointer-events-none before:absolute before:end-0 before:top-0 before:h-px before:bg-line before:content-[''] first:before:hidden";

/** A row that is pressed as a whole (a link, a switch). The focus ring is drawn inside it, so the card never cuts it. */
const PRESSABLE =
  "cursor-pointer text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

export interface SettingsGroupProps {
  /** A small heading over the card. */
  title?: string;
  /** One or two quiet lines under the heading: what these settings are for. */
  description?: string;
  /** A quiet line under the card: a consequence, a link to learn more. */
  footer?: ReactNode;
  /** `SettingsRow`, `SettingsLinkRow`, `SettingsSwitch` — as direct children, so the hairlines fall between them. */
  children: ReactNode;
  className?: string;
  /** Marks the block for the dashboard's search: brought into view and marked when a search result opens it (lib/search/reveal.ts). */
  searchAnchor?: string;
}

/**
 * Grouped rows, the way System Settings draws simple settings: one card whose
 * rows are separated by hairlines inset from the start, an optional small
 * heading over it and a quiet line under it.
 *
 * The card is a pane like every other (`data-slot="card"`: the glass layer
 * gives it its material) with a 1.25rem corner, and it is the container the
 * rows measure themselves against: in a narrow card a row with a text field
 * puts the field under its label by itself.
 */
export function SettingsGroup({ title, description, footer, children, className, searchAnchor }: SettingsGroupProps) {
  const titleId = useId();
  return (
    <section
      data-slot="settings-group"
      data-search-anchor={searchAnchor}
      aria-labelledby={title ? titleId : undefined}
      // A titled group after another block gets a little more air over its heading than the page gap alone.
      className={cn("min-w-0", title && "[&:not(:first-child)]:pt-2", className)}
    >
      {(title || description) && (
        <div className="mb-2 px-4">
          {title && (
            <h3 id={titleId} className="text-[13px] leading-5 font-semibold text-ink-soft">
              {title}
            </h3>
          )}
          {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{description}</p>}
        </div>
      )}
      <div
        data-slot="card"
        // --radius-card is set on the card itself: the dashboard rounds every card to that variable.
        className="zimos-settings-card @container flex flex-col rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]"
      >
        {children}
      </div>
      {shown(footer) && <div className="mt-2 px-4 text-[13px] leading-5 text-ink-soft">{footer}</div>}
    </section>
  );
}

export interface SettingsRowProps {
  label: string;
  /** A quiet line under the label. */
  hint?: string;
  /** The id of the control, so the label is its `<label>`. Without it the row is a group named by the label. */
  htmlFor?: string;
  /** What changes the setting: a field, a select, a segmented control, a button. */
  control: ReactNode;
  /** Put the control under the label at full width (text areas, long fields). */
  stacked?: boolean;
  /** Said under the control in danger ink. */
  error?: string;
  className?: string;
  /** Marks the block for the dashboard's search: brought into view and marked when a search result opens it (lib/search/reveal.ts). */
  searchAnchor?: string;
}

/**
 * One setting: its label and hint on the start side, its control on the end
 * side of the same line (the control takes 60% of the row at most).
 *
 * `stacked` puts the control under the label at full width. A row that holds
 * a text field stacks by itself where there is no room beside the label:
 * below `sm`, and in any card narrower than 32rem (the pane beside the
 * section list on a small laptop) — nothing to pass.
 *
 * The three long class names below are one selector written three times
 * ("a control that holds a text field"); Tailwind reads class names as whole
 * literals, so they cannot be built from a shared piece.
 */
export function SettingsRow({ label, hint, htmlFor, control, stacked = false, error, className, searchAnchor }: SettingsRowProps) {
  const labelId = useId();
  return (
    <div
      data-slot="settings-row"
      data-search-anchor={searchAnchor}
      data-stacked={stacked ? "" : undefined}
      data-invalid={error ? "" : undefined}
      role={htmlFor ? undefined : "group"}
      aria-labelledby={htmlFor ? undefined : labelId}
      className={cn(ROW, "flex flex-wrap items-center gap-x-4 gap-y-2 before:start-4", className)}
    >
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm leading-5 font-medium text-ink">
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-sm leading-5 font-medium text-ink">
            {label}
          </p>
        )}
        {hint && <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{hint}</p>}
      </div>
      <div
        data-slot="settings-row-control"
        className={cn(
          "flex min-w-0 flex-col gap-1.5",
          stacked
            ? "min-w-full items-stretch"
            : cn(
                "max-w-[60%] items-end",
                // A text field beside its label gets a steady width instead of the browser's 20 characters…
                "has-[textarea,input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=hidden])]:w-80",
                // …and takes the line under the label on a phone, and in a narrow card.
                "max-sm:has-[textarea,input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=hidden])]:min-w-full",
                "@max-lg:has-[textarea,input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=hidden])]:min-w-full"
              )
        )}
      >
        {control}
        {error && (
          <p role="alert" className="self-stretch text-[13px] leading-5 font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export interface SettingsLinkRowProps {
  /** A dashboard route, or a full address (`https://…`, `mailto:`, `tel:`) — a web address opens in a new tab. */
  to: string;
  label: string;
  hint?: string;
  icon?: IconComponent;
  /** The icon tile's colour. Default "blue" (the brand). */
  tone?: SettingsTone;
  /** What the setting is now, in quiet ink before the caret («٣ أعضاء», «شغّال»). */
  value?: ReactNode;
  className?: string;
}

/**
 * A row that leads somewhere: the whole row is the link, with the current
 * value and a caret at the end. A dashboard route is a `ViewLink` (fetched
 * ahead of the press, changed in a view transition).
 */
export function SettingsLinkRow({ to, label, hint, icon, tone = "blue", value, className }: SettingsLinkRowProps) {
  const t = useT(STRINGS);
  const web = /^(https?:)?\/\//i.test(to);
  const outside = web || /^(mailto|tel):/i.test(to);
  const rowClass = cn(
    ROW,
    PRESSABLE,
    "flex items-center gap-3 hover:bg-ink/4 active:bg-ink/8",
    // The hairline starts where the words do: past the tile when there is one.
    icon ? "before:start-14" : "before:start-4",
    className
  );
  const body = (
    <>
      {icon && <SettingsIconTile icon={icon} tone={tone} />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-5 text-ink-soft">{hint}</span>}
      </span>
      {shown(value) && <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-soft">{value}</span>}
      {web ? (
        <IconExternal className="size-4 shrink-0 text-ink-soft" aria-hidden />
      ) : (
        // A caret points where the row leads: it flips with the reading direction.
        <IconCaretRight className="size-4 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />
      )}
      {web && <span className="sr-only">{t.newTab}</span>}
    </>
  );
  if (outside) {
    return (
      <a
        href={to}
        target={web ? "_blank" : undefined}
        rel={web ? "noreferrer noopener" : undefined}
        data-slot="settings-row"
        className={rowClass}
      >
        {body}
      </a>
    );
  }
  return (
    <ViewLink to={to} data-slot="settings-row" className={rowClass}>
      {body}
    </ViewLink>
  );
}

export interface SettingsSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  /** Cannot be changed here (a role without the right, a plan without the feature): dimmed, out of the Tab order. */
  disabled?: boolean;
  /** The change is being saved: the thumb shows the Z loader and a second press waits. The row keeps the focus. */
  busy?: boolean;
  className?: string;
  /** Marks the block for the dashboard's search: brought into view and marked when a search result opens it (lib/search/reveal.ts). */
  searchAnchor?: string;
}

/**
 * A setting that is on or off, as a full row: the label and hint at the start,
 * the switch at the end, and the whole row is the switch (`role="switch"`,
 * Space or Enter). The thumb slides on `--ease-pop`; the track clips it, so at
 * the end of the slide it presses into the wall instead of leaving the track.
 *
 * The track is off = a grey well, on = the selection fill (the brand).
 */
export function SettingsSwitch({ checked, onChange, label, hint, disabled = false, busy = false, className, searchAnchor }: SettingsSwitchProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (!busy) onChange(!checked);
      }}
      data-slot="settings-switch"
      data-search-anchor={searchAnchor}
      className={cn(
        ROW,
        PRESSABLE,
        "group/switch flex w-full items-center gap-4 select-none before:start-4",
        "enabled:hover:bg-ink/4 enabled:active:bg-ink/8 disabled:cursor-not-allowed aria-busy:cursor-progress",
        className
      )}
    >
      <span className="min-w-0 flex-1 group-disabled/switch:opacity-55">
        <span id={labelId} className="block text-sm leading-5 font-medium text-ink">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/switch:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            // 24px in a 28 × 48 track with 2px of air: it travels 20px, toward the end side.
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        >
          {/* The thumb is white in both themes, so the Z loader is a fixed dark grey, not a theme ink. */}
          {busy && <ZLoader size="sm" className="size-3.5 text-black/55" aria-hidden />}
        </span>
      </span>
    </button>
  );
}
