import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretRight, IconTip, IconTrendDown, IconTrendUp, IconWarning, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import type { ReportTone } from "./types";

/** What to do about the sentence: a link to the page where it is done, or something done here. */
export interface ReportTakeawayAction {
  label: string;
  /** Where the action is taken. Leave out for an action done in place (`onClick`). */
  to?: string;
  onClick?: () => void;
}

export interface ReportTakeawayProps {
  /** good: green · bad: red · warn: amber · info: the brand. */
  tone: ReportTone;
  /** The ONE sentence: what the numbers mean and what to do. Plain words, the viewer's digits. */
  children: ReactNode;
  action?: ReportTakeawayAction;
  className?: string;
}

// The strip on its own (glass off): the soft token fills with a hairline of the tone.
// glass/reports.css lays the tint over glass through data-tone.
const TONE: Record<ReportTone, { icon: IconComponent; box: string; ink: string }> = {
  good: { icon: IconTrendUp, box: "bg-success-soft ring-success/20", ink: "text-success" },
  bad: { icon: IconTrendDown, box: "bg-danger-soft ring-danger/20", ink: "text-danger" },
  warn: { icon: IconWarning, box: "bg-accent-soft ring-accent/30", ink: "text-accent-dark" },
  info: { icon: IconTip, box: "bg-primary-soft ring-primary/20", ink: "text-primary" },
};

const ACTION =
  "inline-flex h-10 max-w-full shrink-0 cursor-pointer items-center gap-1 rounded-full bg-paper-raised px-4 text-sm font-semibold whitespace-nowrap text-ink ring-1 ring-line pointer-coarse:h-11 " +
  "transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";

/**
 * The one sentence of a report tab, in plain words: what the numbers mean and
 * what to do about it («التوصيل في أسيوط بينجح ٥ من كل ١٠ — جرّب شركة شحن تانية
 * هناك»). A soft strip in the tone of the news, a filled icon, the sentence in
 * ink, and — when there is something to do — one small pill at the end.
 *
 * `role="note"`: it is read with the page, not announced as an alert. The tone
 * is carried by the icon's shape as well as its colour.
 */
export function ReportTakeaway({ tone, children, action, className }: ReportTakeawayProps) {
  const look = TONE[tone];
  const ToneIcon = look.icon;
  return (
    <div
      role="note"
      data-slot="report-takeaway"
      data-tone={tone}
      // The radius is written without var() on purpose: liquid-glass.css re-tints any soft-filled
      // box whose class names rounded-[var(--radius-card)], and this strip has its own tint there.
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-(--radius-card) px-4 py-3.5 ring-1 sm:flex-row sm:items-center sm:gap-4",
        look.box,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ToneIcon
          data-slot="report-takeaway-icon"
          // Half a line down, so the icon sits on the first line of a sentence that wraps.
          className={cn("mt-0.5 size-5 shrink-0", look.ink)}
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-[15px] leading-6 text-pretty text-ink">{children}</p>
      </div>
      {action && (
        // Under the sentence on a phone, in line with its text; at the end of the strip from sm up.
        <div className="flex min-w-0 ps-8 sm:ps-0">
          {action.to ? (
            <ViewLink to={action.to} onClick={action.onClick} data-slot="report-takeaway-action" className={ACTION}>
              <span className="truncate">{action.label}</span>
              <IconCaretRight className="size-3.5 shrink-0 rtl:-scale-x-100" aria-hidden />
            </ViewLink>
          ) : (
            <button type="button" onClick={action.onClick} data-slot="report-takeaway-action" className={ACTION}>
              <span className="truncate">{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
